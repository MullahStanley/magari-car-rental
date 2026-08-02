import { createClient } from "@supabase/supabase-js";
import { createClerkClient } from "@clerk/nextjs/server";
import crypto from "node:crypto";

if (!process.env.DIDIT_WEBHOOK_SECRET) {
  throw new Error("DIDIT_WEBHOOK_SECRET is missing from environment variables");
}

if (!process.env.CLERK_SECRET_KEY) {
  throw new Error("CLERK_SECRET_KEY is missing from environment variables");
}

// ── Canonicalisation helpers (load-bearing for X-Signature-V2 HMAC) ────────

function shortenFloats(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(shortenFloats);
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.entries(v as Record<string, unknown>).map(([k, x]) => [
        k,
        shortenFloats(x),
      ])
    );
  }
  if (typeof v === "number" && !Number.isInteger(v) && v % 1 === 0)
    return Math.trunc(v);
  return v;
}

function sortKeys(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortKeys);
  if (v && typeof v === "object") {
    return Object.keys(v as object)
      .sort()
      .reduce<Record<string, unknown>>((acc, k) => {
        acc[k] = sortKeys((v as Record<string, unknown>)[k]);
        return acc;
      }, {});
  }
  return v;
}

// ── Supabase admin client (only for the idempotency ledger) ───────────────

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

// ── Clerk client (source of truth for user verification state) ────────────

function getClerk() {
  return createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY! });
}

// ── Idempotency ────────────────────────────────────────────────────────────

const MAX_IN_MEMORY = 10_000;
const inMemorySeen = new Set<string>();

function trackInMemory(eventId: string) {
  if (inMemorySeen.size >= MAX_IN_MEMORY) {
    // Evict ~20 % oldest entries (Set iteration order = insertion order)
    const toEvict = Math.floor(MAX_IN_MEMORY * 0.2);
    let evicted = 0;
    for (const id of inMemorySeen) {
      if (evicted >= toEvict) break;
      inMemorySeen.delete(id);
      evicted++;
    }
  }
  inMemorySeen.add(eventId);
}

/**
 * Race-free idempotency via INSERT … ON CONFLICT DO NOTHING.
 * Returns `true` if this event was already processed (duplicate).
 */
async function markProcessedIfNew(
  supabase: ReturnType<typeof getSupabase>,
  eventId: string,
  sessionId: string | undefined,
  status: string | undefined,
  webhookType: string | undefined
): Promise<boolean> {
  trackInMemory(eventId);

  const { error } = await supabase.from("processed_webhooks").insert({
    event_id: eventId,
    session_id: sessionId ?? null,
    status: status ?? null,
    webhook_type: webhookType ?? null,
  });

  if (error) {
    if (error.code === "23505") return true; // unique-violation → already processed
    // Table may not exist yet — fall back to in-memory dedup
    console.warn("processed_webhooks insert failed, using in-memory dedup:", error.message);
    if (inMemorySeen.has(eventId)) return true;
    inMemorySeen.add(eventId);
  }

  return false;
}

// ── Session status handlers ────────────────────────────────────────────────
// vendor_data is the Clerk user ID. We persist verification state to the
// Clerk user's publicMetadata, which the app reads via currentUser().

async function handleApproved(
  clerk: ReturnType<typeof getClerk>,
  vendorData: string,
  decision: unknown
) {
  try {
    await clerk.users.updateUser(vendorData, {
      // Summary only in publicMetadata (client-visible, 40KB cap);
      // raw decision lives in privateMetadata (server-only).
      publicMetadata: {
        verified: true,
        verified_at: new Date().toISOString(),
        verification_status: "approved",
      },
      privateMetadata: {
        verification_decision: decision,
      },
    });
    console.log("User verified:", vendorData);
  } catch (error) {
    console.error("Failed to mark user verified:", error);
  }
}

async function handleDeclined(
  clerk: ReturnType<typeof getClerk>,
  vendorData: string,
  decision: Record<string, unknown>
) {
  const warnings: string[] = [];
  if (decision) {
    for (const key of [
      "aml_screenings",
      "id_verifications",
      "liveness_checks",
      "face_matches",
      "poa_verifications",
    ]) {
      const items = decision[key] as Array<Record<string, unknown>> | undefined;
      if (items) {
        for (const item of items) {
          if (item.warning) warnings.push(String(item.warning));
          if (item.risk_score)
            warnings.push(`${key}: risk_score=${item.risk_score}`);
        }
      }
    }
  }

  try {
    await clerk.users.updateUser(vendorData, {
      publicMetadata: {
        verified: false,
        verification_status: "declined",
        verification_declined_at: new Date().toISOString(),
        verification_warnings: warnings,
      },
      privateMetadata: {
        verification_decision: decision,
      },
    });
    console.warn("User declined:", vendorData, "warnings:", warnings);
  } catch (error) {
    console.error("Failed to mark user declined:", error);
  }
}

async function handleInReview(
  clerk: ReturnType<typeof getClerk>,
  vendorData: string
) {
  try {
    await clerk.users.updateUser(vendorData, {
      publicMetadata: { verified: false, verification_status: "pending_review" },
    });
    console.log("User pending review:", vendorData);
  } catch (error) {
    console.error("Failed to mark user pending review:", error);
  }
}

async function handleInProgress(
  clerk: ReturnType<typeof getClerk>,
  vendorData: string
) {
  try {
    await clerk.users.updateUser(vendorData, {
      publicMetadata: { verified: false, verification_status: "in_progress" },
    });
    console.log("User verification in progress:", vendorData);
  } catch (error) {
    console.error("Failed to mark user in progress:", error);
  }
}

async function handleResubmitted(
  clerk: ReturnType<typeof getClerk>,
  vendorData: string,
  resubmitInfo: Record<string, unknown> | undefined
) {
  const nodesToResubmit = resubmitInfo?.nodes_to_resubmit;
  try {
    await clerk.users.updateUser(vendorData, {
      publicMetadata: {
        verified: false,
        verification_status: "resubmitted",
        resubmit_nodes: nodesToResubmit,
        resubmitted_at: new Date().toISOString(),
      },
    });
    console.log("User resubmitted:", vendorData, "nodes:", nodesToResubmit);
  } catch (error) {
    console.error("Failed to mark user resubmitted:", error);
  }
}

async function handleAbandoned(
  clerk: ReturnType<typeof getClerk>,
  vendorData: string
) {
  try {
    await clerk.users.updateUser(vendorData, {
      publicMetadata: {
        verified: false,
        verification_status: "abandoned",
        abandoned_at: new Date().toISOString(),
      },
    });
    console.log("User abandoned verification:", vendorData);
  } catch (error) {
    console.error("Failed to mark user abandoned:", error);
  }
}

function handleAwaitingUser(vendorData: string) {
  console.log("Awaiting user (KYB parent waiting):", vendorData);
}

async function handleExpired(
  clerk: ReturnType<typeof getClerk>,
  vendorData: string
) {
  try {
    await clerk.users.updateUser(vendorData, {
      publicMetadata: {
        verified: false,
        verification_status: "kyc_expired",
        expired_at: new Date().toISOString(),
      },
    });
    console.log("Session expired:", vendorData);
  } catch (error) {
    console.error("Failed to mark session expired:", error);
  }
}

// ── Entity event handlers (user.* / business.*) ────────────────────────────

async function handleUserStatusUpdated(
  clerk: ReturnType<typeof getClerk>,
  vendorData: string,
  payload: Record<string, unknown>
) {
  const entityStatus = payload.status as string | undefined;
  try {
    await clerk.users.updateUser(vendorData, {
      publicMetadata: {
        entity_status: entityStatus,
        entity_status_updated_at: new Date().toISOString(),
      },
    });
    console.log("User entity status:", vendorData, entityStatus);
  } catch (error) {
    console.error("Failed to update user entity status:", error);
  }
}

async function handleUserDataUpdated(
  clerk: ReturnType<typeof getClerk>,
  vendorData: string,
  payload: Record<string, unknown>
) {
  try {
    await clerk.users.updateUser(vendorData, {
      publicMetadata: {
        entity_data_updated_at: new Date().toISOString(),
      },
      privateMetadata: {
        entity_data: payload.data,
      },
    });
    console.log("User entity data updated:", vendorData);
  } catch (error) {
    console.error("Failed to update user entity data:", error);
  }
}

async function handleBusinessStatusUpdated(
  clerk: ReturnType<typeof getClerk>,
  vendorData: string,
  payload: Record<string, unknown>
) {
  const entityStatus = payload.status as string | undefined;
  try {
    await clerk.users.updateUser(vendorData, {
      publicMetadata: {
        business_status: entityStatus,
        business_status_updated_at: new Date().toISOString(),
      },
    });
    console.log("Business entity status:", vendorData, entityStatus);
  } catch (error) {
    console.error("Failed to update business entity status:", error);
  }
}

async function handleBusinessDataUpdated(
  clerk: ReturnType<typeof getClerk>,
  vendorData: string,
  payload: Record<string, unknown>
) {
  try {
    await clerk.users.updateUser(vendorData, {
      publicMetadata: {
        business_data_updated_at: new Date().toISOString(),
      },
      privateMetadata: {
        business_data: payload.data,
      },
    });
    console.log("Business entity data updated:", vendorData);
  } catch (error) {
    console.error("Failed to update business entity data:", error);
  }
}

// ── Transaction / activity handlers ────────────────────────────────────────

function handleTransactionCreated(
  vendorData: string,
  payload: Record<string, unknown>
) {
  console.log("Transaction created:", vendorData, {
    transaction_id: payload.transaction_id,
    session_id: payload.session_id,
  });
}

function handleTransactionStatusUpdated(
  vendorData: string,
  payload: Record<string, unknown>
) {
  console.log("Transaction status updated:", vendorData, {
    transaction_id: payload.transaction_id,
    status: payload.status,
  });
}

function handleTravelRuleStatusUpdated(
  vendorData: string,
  payload: Record<string, unknown>
) {
  console.log("Travel rule status updated:", vendorData, {
    travel_rule_id: payload.travel_rule_id,
    status: payload.status,
  });
}

function handleActivityCreated(
  vendorData: string,
  payload: Record<string, unknown>
) {
  console.log("Activity created:", vendorData, {
    activity_type: payload.activity_type,
    session_id: payload.session_id,
  });
}

// ── Webhook handler ────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-signature-v2") ?? "";
  const ts = Number(req.headers.get("x-timestamp"));

  // 1. Freshness — reject anything older/newer than 300 s (replay protection).
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) {
    console.warn("Webhook rejected: stale timestamp", ts);
    return new Response("stale", { status: 401 });
  }

  // 2. Canonicalise for HMAC. We parse the raw JSON solely to re-serialise
  //    in Didit's canonical form — the parsed object is NOT trusted yet.
  let canonical: string;
  try {
    canonical = JSON.stringify(sortKeys(shortenFloats(JSON.parse(raw))));
  } catch {
    console.error("Webhook rejected: invalid JSON");
    return new Response("bad json", { status: 400 });
  }

  // 3. Constant-time HMAC-SHA256 compare against X-Signature-V2.
  if (sig.length !== 64) {
    console.error("Webhook rejected: invalid signature length");
    return new Response("bad sig", { status: 401 });
  }

  const expected = crypto
    .createHmac("sha256", process.env.DIDIT_WEBHOOK_SECRET!)
    .update(canonical, "utf8")
    .digest("hex");

  if (
    !crypto.timingSafeEqual(
      Buffer.from(expected, "utf8"),
      Buffer.from(sig, "utf8")
    )
  ) {
    console.error("Webhook rejected: bad signature");
    return new Response("bad sig", { status: 401 });
  }

  // 4. Signature valid — NOW we trust the parsed payload.
  const parsed = JSON.parse(raw) as Record<string, unknown>;
  const webhookType = parsed.webhook_type as string;
  const vendorData = parsed.vendor_data as string;
  const sessionId = parsed.session_id as string | undefined;
  const status = parsed.status as string | undefined;

  // 5. Idempotency — race-free upsert; if duplicate, return 2xx silently.
  const supabase = getSupabase();
  if (
    await markProcessedIfNew(
      supabase,
      parsed.event_id as string,
      sessionId,
      status,
      webhookType
    )
  ) {
    return new Response("ok");
  }

  const clerk = getClerk();

  // 6. Process by webhook_type, then by status/event specifics.
  try {
    switch (webhookType) {
      case "status.updated":
        switch (status) {
          case "Approved":
            await handleApproved(clerk, vendorData, parsed.decision);
            break;
          case "Declined":
            await handleDeclined(
              clerk,
              vendorData,
              parsed.decision as Record<string, unknown>
            );
            break;
          case "In Review":
            await handleInReview(clerk, vendorData);
            break;
          case "In Progress":
            await handleInProgress(clerk, vendorData);
            break;
          case "Resubmitted":
            await handleResubmitted(
              clerk,
              vendorData,
              parsed.resubmit_info as Record<string, unknown> | undefined
            );
            break;
          case "Abandoned":
            await handleAbandoned(clerk, vendorData);
            break;
          case "Awaiting User":
            handleAwaitingUser(vendorData);
            break;
          case "Expired":
          case "Kyc Expired":
            await handleExpired(clerk, vendorData);
            break;
          case "Not Started":
            console.log("Session not started:", parsed.event_id);
            break;
          default:
            console.log("Unknown session status:", status, parsed.event_id);
            break;
        }
        break;

      case "data.updated":
        console.log("Session data updated:", vendorData, {
          event_id: parsed.event_id,
          session_id: sessionId,
        });
        break;

      case "user.status.updated":
        await handleUserStatusUpdated(
          clerk,
          vendorData,
          parsed as Record<string, unknown>
        );
        break;

      case "user.data.updated":
        await handleUserDataUpdated(
          clerk,
          vendorData,
          parsed as Record<string, unknown>
        );
        break;

      case "business.status.updated":
        await handleBusinessStatusUpdated(
          clerk,
          vendorData,
          parsed as Record<string, unknown>
        );
        break;

      case "business.data.updated":
        await handleBusinessDataUpdated(
          clerk,
          vendorData,
          parsed as Record<string, unknown>
        );
        break;

      case "transaction.created":
        handleTransactionCreated(
          vendorData,
          parsed as Record<string, unknown>
        );
        break;

      case "transaction.status.updated":
        handleTransactionStatusUpdated(
          vendorData,
          parsed as Record<string, unknown>
        );
        break;

      case "travel_rule.status.updated":
        handleTravelRuleStatusUpdated(
          vendorData,
          parsed as Record<string, unknown>
        );
        break;

      case "activity.created":
        handleActivityCreated(
          vendorData,
          parsed as Record<string, unknown>
        );
        break;

      default:
        console.log("Unknown webhook_type:", webhookType, parsed.event_id);
        break;
    }
  } catch (err) {
    console.error("Error processing webhook:", err);
  }

  // 7. Return 2xx within 5 s. Heavy work should be pushed to a queue.
  return new Response("ok");
}
