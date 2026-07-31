"use client";

import { useState } from "react";
import { Shield, ShieldCheck, Loader2, ExternalLink } from "lucide-react";
import { DiditSdk } from "@didit-protocol/sdk-web";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface VerifyButtonProps {
  isVerified: boolean;
}

export function VerifyButton({ isVerified }: VerifyButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [consentGiven, setConsentGiven] = useState(false);

  const handleVerify = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/verify", { method: "POST" });
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to start verification");
      }

      if (data.url) {
        DiditSdk.shared.onComplete = (result) => {
          // result.type: "completed" | "cancelled" | "failed" — UI hint only.
          // The webhook is the source of truth for the verification decision.
          console.log("Verification flow finished:", result.type);
          if (result.type === "cancelled" || result.type === "failed") {
            setError(
              result.type === "cancelled"
                ? "Verification was cancelled."
                : "Verification failed. Please try again."
            );
          }
        };
        DiditSdk.shared.startVerification({ url: data.url });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {isVerified ? (
            <ShieldCheck className="h-5 w-5 text-green-500" />
          ) : (
            <Shield className="h-5 w-5 text-muted-foreground" />
          )}
          Identity Verification
          {isVerified ? (
            <Badge
              variant="default"
              className="bg-green-500 hover:bg-green-600"
            >
              Verified
            </Badge>
          ) : (
            <Badge variant="secondary">Required</Badge>
          )}
        </CardTitle>
        <CardDescription>
          {isVerified
            ? "Your identity has been verified. You can now book vehicles."
            : "Verify your identity to unlock booking privileges. This is required before you can rent a vehicle."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isVerified ? (
          <p className="text-sm text-muted-foreground">
            Your account is fully verified and ready to use.
          </p>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Verification involves a quick ID check through our secure partner
              Didit. This helps us maintain trust and safety for all users.
            </p>

            {/* Consent disclosure — shown before verification opens */}
            <div className="rounded-lg border bg-muted/50 p-3 text-xs text-muted-foreground">
              <p className="font-medium text-foreground">Before you begin</p>
              <p className="mt-1">
                You will be redirected to Didit's secure verification page where
                you'll be asked to upload a government-issued ID and complete a
                brief liveness check. Your data is processed by Didit in
                accordance with their privacy policy.
              </p>
              <label className="mt-2 flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-muted-foreground"
                  checked={consentGiven}
                  onChange={(e) => setConsentGiven(e.target.checked)}
                />
                <span>I understand and consent to the identity verification process</span>
              </label>
            </div>

            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            <Button
              onClick={handleVerify}
              disabled={loading || !consentGiven}
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Starting Verification...
                </>
              ) : (
                <>
                  Start Verification
                  <ExternalLink className="ml-2 h-4 w-4" />
                </>
              )}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
