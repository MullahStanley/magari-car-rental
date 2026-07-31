import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Per-session config, NOT a secret and NOT an env var. Get a workflow_id from
// the console (Workflows) or GET /v3/workflows/, then paste it here.
const WORKFLOW_ID = "42b3511e-c941-4a7a-af7d-97d68a90902d";

if (!process.env.DIDIT_API_KEY) {
  throw new Error("DIDIT_API_KEY is missing from environment variables");
}

export async function POST() {
  // Identify the user from YOUR auth/session — never trust an id sent from the browser blindly.
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";

    const res = await fetch("https://verification.didit.me/v3/session/", {
      method: "POST",
      headers: {
        "x-api-key": process.env.DIDIT_API_KEY!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        workflow_id: WORKFLOW_ID,
        vendor_data: user.id, // stable internal user id
        callback: `${appUrl}/profile`, // where Didit returns the user after the flow
      }),
    });

    if (!res.ok) {
      // 403 => missing/invalid/revoked x-api-key
      const detail = await res.text();
      console.error("Didit session create failed:", detail);
      return NextResponse.json(
        { error: "session_create_failed", detail },
        { status: 502 }
      );
    }

    const session = await res.json();
    // Return ONLY what the client needs. session_token is for native SDKs; url is for web/iframe/redirect.
    return NextResponse.json({
      url: session.url,
      session_id: session.session_id,
    });
  } catch (error) {
    console.error("Verification error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
