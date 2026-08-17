"use client";

import { useSearchParams } from "next/navigation";
import { LoginForm } from "./login-form";

export function LoginFormWrapper() {
  const searchParams = useSearchParams();
  // Middleware appends ?next= when redirecting unauthenticated users;
  // some links use ?redirect=. Support both.
  const redirect =
    searchParams.get("redirect") ?? searchParams.get("next") ?? "/cars";

  return <LoginForm redirect={redirect} />;
}
