"use client";

import { useSearchParams } from "next/navigation";
import { SignUp } from "@clerk/nextjs";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export function SignUpForm() {
  const searchParams = useSearchParams();
  const redirect =
    searchParams.get("redirect") ??
    searchParams.get("redirect_url") ??
    searchParams.get("next") ??
    "/cars";

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle>Create Account</CardTitle>
        <CardDescription>
          Sign up to book vehicles and track your rentals
        </CardDescription>
      </CardHeader>
      <CardContent>
        <SignUp
          forceRedirectUrl={redirect}
          signInUrl="/auth/login"
          appearance={{
            elements: {
              rootBox: "w-full",
              cardBox: "shadow-none",
              card: "shadow-none p-0",
              header: "hidden",
            },
          }}
        />
      </CardContent>
    </Card>
  );
}
