import { clerkMiddleware } from "@clerk/nextjs/server";

export default clerkMiddleware(
  async (auth, req) => {
    const { pathname } = req.nextUrl;

    // Public routes: landing, fleet catalog, car details, auth pages, and all
    // API routes (each API route enforces its own auth/role checks).
    const isPublicRoute =
      pathname === "/" ||
      pathname.startsWith("/cars") ||
      pathname.startsWith("/auth") ||
      pathname.startsWith("/api") ||
      pathname.startsWith("/_next");

    if (!isPublicRoute) {
      await auth.protect();
    }
  },
  {
    signInUrl: "/auth/login",
    signUpUrl: "/auth/signup",
  }
);

export const config = {
  matcher: [
    // Skip Next.js internals and all static files, unless found in search params
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)",
    // Always run for Clerk's auto-proxy path
    "/__clerk/:path*",
    "/(api|trpc)(.*)",
  ],
};
