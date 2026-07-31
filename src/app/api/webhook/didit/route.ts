import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import crypto from "node:crypto";

if (!process.env.DIDIT_WEBHOOK_SECRET) {
  throw new Error("DIDIT_WEBHOOK_SECRET is missing from environment variables");
}

// ── Canonicalisation helpers (load-bearing for X-Signature-V2 HMAC) ────────

// Whole-number floats (1.0) -> integers (1), recursively. Matches Didit's server canonicalisation.
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

// Recursive lexicographic key sort (array order preserved).
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

// ── Stub functions — replace with your actual DB logic ─────────────────────

async function alreadyProcessed(_id: string) {
  // TODO: Check a "processed_webhooks" table or Redis set for idempotency
  return false;
}

async function markProcessed(_id: string) {
  // TODO: Insert event_id into "processed_webhooks" table
}

async function setUserVerified(vendorData: string, _decision: unknown) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.auth.admin.updateUserById(vendorData, {
    user_metadata: { verified: true, verified_at: new Date().toISOString() },
  });
  if (error) console.error("Failed to mark user verified:", error);
}

async function setUserDeclined(vendorData: string, decision: unknown) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.auth.admin.updateUserById(vendorData, {
    user_metadata: {
      verified: false,
      verification_declined: true,
      verification_declined_at: new Date().toISOString(),
    },
  });
  if (error) console.error("Failed to mark user declined:", error);

  console.warn("User declined:", vendorData, decision);
}

async function setUserPendingReview(vendorData: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.auth.admin.updateUserById(vendorData, {
    user_metadata: {
      verification_status: "pending_review",
    },
  });
  if (error) console.error("Failed to mark user pending review:", error);
}

async function reopenNodes(_vendorData: string, _nodesToResubmit: unknown) {
  // TODO: Handle resubmission — reviewer asked user to retry specific steps
  console.info("Resubmit requested for:", _vendorData, _nodesToResubmit);
}

async function markReverificationNeeded(vendorData: string) {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { error } = await supabase.auth.admin.updateUserById(vendorData, {
    user_metadata: {
      verified: false,
      verification_status: "kyc_expired",
    },
  });
  if (error) console.error("Failed to mark re-verification needed:", error);
}

// ── Webhook handler ────────────────────────────────────────────────────────

export async function POST(req: Request) {
  const raw = await req.text();
  const sig = req.headers.get("x-signature-v2") ?? "";
  const ts = Number(req.headers.get("x-timestamp"));

  // 1. Freshness — reject anything older/newer than 300s (replay protection).
  if (!ts || Math.abs(Date.now() / 1000 - ts) > 300) {
    return new Response("stale", { status: 401 });
  }

  // 2. Canonicalise (shortenFloats -> sortKeys -> JSON.stringify with unescaped Unicode, the JS default).
  const parsed = JSON.parse(raw);
  const canonical = JSON.stringify(sortKeys(shortenFloats(parsed)));

  // 3. Constant-time HMAC-SHA256 compare against X-Signature-V2.
  const expected = crypto
    .createHmac("sha256", process.env.DIDIT_WEBHOOK_SECRET!)
    .update(canonical, "utf8")
    .digest("hex");

  if (
    sig.length !== expected.length ||
    !crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(sig))
  ) {
    return new Response("bad sig", { status: 401 });
  }

  // 4. Idempotency — dedupe on event_id (unique per delivery attempt).
  if (await alreadyProcessed(parsed.event_id)) return new Response("ok");
  await markProcessed(parsed.event_id);

  // 5. Apply the decision. Status strings are case-sensitive literals.
  switch (parsed.status) {
    case "Approved":
      await setUserVerified(parsed.vendor_data, parsed.decision);
      break;
    case "Declined":
      await setUserDeclined(parsed.vendor_data, parsed.decision);
      break;
    case "In Review":
      await setUserPendingReview(parsed.vendor_data);
      break;
    case "Resubmitted":
      await reopenNodes(
        parsed.vendor_data,
        parsed.resubmit_info?.nodes_to_resubmit
      );
      break;
    case "Kyc Expired":
      await markReverificationNeeded(parsed.vendor_data);
      break;
    default:
      // "Not Started" | "In Progress" | "Awaiting User" | "Abandoned" | "Expired" — log/no-op.
      console.log("Didit webhook (no-op):", parsed.status, parsed.event_id);
      break;
  }

  // 6. Return 2xx within 5 seconds. Push heavy work to a queue if needed.
  return new Response("ok");
}
