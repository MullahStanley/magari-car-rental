import { Suspense } from "react";
import { LoginFormWrapper } from "./login-form-wrapper";

export default function LoginPage() {
  return (
    <div className="container mx-auto flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-12">
      <Suspense
        fallback={
          <div className="h-96 w-full max-w-md animate-pulse rounded-xl bg-muted" />
        }
      >
        <LoginFormWrapper />
      </Suspense>
    </div>
  );
}
