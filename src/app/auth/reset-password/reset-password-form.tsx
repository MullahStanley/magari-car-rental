"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { createClient } from "@/lib/supabase/client";

type ResetStatus = "checking" | "invalid" | "ready" | "done";

export function ResetPasswordForm() {
  const router = useRouter();
  const [status, setStatus] = useState<ResetStatus>("checking");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // The recovery email links here with the session embedded in the URL
    // (#access_token=...&type=recovery) — supabase-js consumes it and fires
    // PASSWORD_RECOVERY (or SIGNED_IN). Without that marker the link is
    // invalid or expired.
    const hasRecoveryToken = /[?#].*type=recovery/.test(window.location.href);
    if (!hasRecoveryToken) {
      setStatus("invalid");
      return;
    }

    const supabase = createClient();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") {
        setStatus("ready");
      }
    });

    // The session may already be established by the time we subscribe, so
    // double-check shortly after mount. Only ever upgrade the state here —
    // the timeout below is the sole source of "invalid" so a slightly slow
    // hash parse can't reject a valid link.
    const sessionCheck = setTimeout(async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setStatus((current) => (current === "checking" ? "ready" : current));
      }
    }, 500);

    // Fallback in case the token is expired/broken and nothing fires.
    const timeout = setTimeout(() => {
      setStatus((current) => (current === "checking" ? "invalid" : current));
    }, 6000);

    return () => {
      subscription.unsubscribe();
      clearTimeout(sessionCheck);
      clearTimeout(timeout);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setSaving(true);
    const supabase = createClient();
    const { error: updateError } = await supabase.auth.updateUser({
      password,
    });
    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    // Clear the recovery session so the account returns to a clean
    // logged-out state before sending the user back to sign in.
    await supabase.auth.signOut();
    setStatus("done");
  };

  return (
    <Card className="w-full max-w-md overflow-hidden">
      <div className="h-1.5 bg-brand-gradient" aria-hidden="true" />
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 shadow-sm">
          <KeyRound className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-gradient">
          {status === "done" ? "Password updated" : "Set a new password"}
        </CardTitle>
        <CardDescription>
          {status === "done"
            ? "Your password has been changed successfully."
            : status === "invalid"
              ? "This reset link is invalid or has expired."
              : "Choose a new password for your account."}
        </CardDescription>
      </CardHeader>

      {status === "checking" && (
        <CardContent className="flex flex-col items-center gap-3 py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Checking your reset link…
          </p>
        </CardContent>
      )}

      {status === "invalid" && (
        <CardContent className="py-8">
          <p className="text-sm text-muted-foreground">
            The link you followed is invalid or has expired. You can request a
            new one from the sign-in page.
          </p>
        </CardContent>
      )}

      {status === "ready" && (
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">New password</Label>
              <Input
                id="new-password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
                autoFocus
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-password">Confirm new password</Label>
              <Input
                id="confirm-password"
                type="password"
                placeholder="••••••••"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              type="submit"
              className="w-full"
              disabled={saving || !password || !confirm}
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Update Password"
              )}
            </Button>
          </CardFooter>
        </form>
      )}

      {status === "done" && (
        <CardContent className="py-8">
          <p className="text-sm text-muted-foreground">
            You can now sign in with your new password.
          </p>
        </CardContent>
      )}

      {(status === "invalid" || status === "done") && (
        <CardFooter className="flex flex-col gap-3">
          <Button className="w-full" onClick={() => router.push("/auth/login")}>
            Go to Sign In
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}
