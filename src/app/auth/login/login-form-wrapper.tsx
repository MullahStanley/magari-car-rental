"use client";

import { useSearchParams } from "next/navigation";
import { LoginForm } from "./login-form";

export function LoginFormWrapper() {
  const searchParams = useSearchParams();
  // Middleware appends ?redirect_url= (Clerk) or ?next= when redirecting
  // unauthenticated users; some links use ?redirect=. Support all three.
  const redirect =
    searchParams.get("redirect") ??
    searchParams.get("redirect_url") ??
    searchParams.get("next") ??
    "/cars";

  return <LoginForm redirect={redirect} />;
}
