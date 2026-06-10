"use client";

import { useSearchParams } from "next/navigation";
import { LoginForm } from "./login-form";

export function LoginFormWrapper() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get("redirect") ?? "/cars";

  return <LoginForm redirect={redirect} />;
}
