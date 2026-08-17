import { Suspense } from "react";
import { LoginFormWrapper } from "./login-form-wrapper";

export default function LoginPage() {
  return (
    <div className="relative flex min-h-[calc(100vh-8rem)] items-center justify-center overflow-hidden px-4 py-12">
      {/* Decorative gradient glows to match the app theme */}
      <div className="pointer-events-none absolute -top-24 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-primary/20 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-32 right-[8%] h-72 w-72 rounded-full bg-sky-400/15 blur-3xl dark:bg-sky-500/20" />
      <div className="pointer-events-none absolute -left-24 top-1/3 h-64 w-64 rounded-full bg-sky-400/10 blur-3xl dark:bg-sky-500/15" />

      <div className="relative w-full max-w-md">
        <Suspense
          fallback={
            <div className="h-96 w-full animate-pulse rounded-xl bg-muted" />
          }
        >
          <LoginFormWrapper />
        </Suspense>
      </div>
    </div>
  );
}
