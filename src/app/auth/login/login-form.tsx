"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Car, Loader2 } from "lucide-react";
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

interface LoginFormProps {
  redirect: string;
}

type Mode = "signin" | "signup" | "forgot";

export function LoginForm({ redirect }: LoginFormProps) {
  const router = useRouter();

  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError(null);
    setInfo(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { data, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: { full_name: fullName || email.split("@")[0] },
          },
        });
        if (signUpError) throw signUpError;

        // If a session is returned the account was created (auto-confirm
        // on) — sign straight in. Otherwise a confirmation email was sent.
        if (data.session) {
          router.push(redirect);
          router.refresh();
        } else {
          setError(
            "Account created! Check your inbox (and spam) to confirm your email, then sign in."
          );
        }
      } else {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (signInError) throw signInError;
        router.push(redirect);
        router.refresh();
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Authentication failed";
      if (message.toLowerCase().includes("email not confirmed")) {
        setError(
          "Email not confirmed yet — check your inbox (and spam) for the confirmation link."
        );
      } else {
        setError(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);

    try {
      const supabase = createClient();
      const redirectTo = `${window.location.origin}/auth/reset-password`;
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        { redirectTo }
      );
      if (resetError) throw resetError;

      // Don't reveal whether the account exists — always show the same
      // message regardless of the outcome.
      setInfo(
        "If an account exists for this email, a password reset link has been sent. Check your inbox (and spam)."
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const title =
    mode === "signup"
      ? "Create Account"
      : mode === "forgot"
        ? "Reset Password"
        : "Welcome Back";
  const description =
    mode === "signup"
      ? "Sign up to start booking premium vehicles"
      : mode === "forgot"
        ? "Enter your email and we'll send you a reset link"
        : "Sign in to manage your bookings";

  return (
    <Card className="w-full max-w-md overflow-hidden">
      <div className="h-1.5 bg-brand-gradient" aria-hidden="true" />
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-primary/25 to-primary/5 shadow-sm">
          <Car className="h-6 w-6 text-primary" />
        </div>
        <CardTitle className="text-gradient">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>

      {mode === "forgot" ? (
        <form onSubmit={handleForgotSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="reset-email">Email</Label>
              <Input
                id="reset-email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            {error && (
              <p className="text-sm text-destructive" role="alert">
                {error}
              </p>
            )}
            {info && (
              <p className="text-sm text-primary" role="status">
                {info}
              </p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button
              type="submit"
              className="w-full"
              disabled={loading || !email}
            >
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                "Send Reset Link"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() => switchMode("signin")}
            >
              Back to sign in
            </Button>
            <Link
              href="/cars"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Continue browsing without signing in
            </Link>
          </CardFooter>
        </form>
      ) : (
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password">Password</Label>
                <button
                  type="button"
                  onClick={() => switchMode("forgot")}
                  className="text-xs font-medium text-primary hover:underline"
                >
                  Forgot password?
                </button>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
            {mode === "signup" && (
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name</Label>
                <Input
                  id="fullName"
                  type="text"
                  placeholder="John Doe"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required
                />
              </div>
            )}
            {error && (
              <p
                className={`text-sm ${
                  error.includes("Account created")
                    ? "text-primary"
                    : "text-destructive"
                }`}
                role="alert"
              >
                {error}
              </p>
            )}
          </CardContent>
          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : mode === "signup" ? (
                "Sign Up"
              ) : (
                "Sign In"
              )}
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full"
              onClick={() =>
                switchMode(mode === "signup" ? "signin" : "signup")
              }
            >
              {mode === "signup"
                ? "Already have an account? Sign in"
                : "Don't have an account? Sign up"}
            </Button>
            <Link
              href="/cars"
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Continue browsing without signing in
            </Link>
          </CardFooter>
        </form>
      )}
    </Card>
  );
}
