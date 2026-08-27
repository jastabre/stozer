import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";

// Routes that don't require authentication
const publicRoutes = ["/login", "/register", "/verify", "/reset-password", "/"];

// Static and API routes to skip
const excludedPaths = ["/api", "/_next", "/favicon.ico", "/icons", "/offline"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip excluded paths
  if (excludedPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // Skip public routes
  if (publicRoutes.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return NextResponse.next();
  }

  const { supabase, supabaseResponse } = await createMiddlewareClient(
    request
  );

  // Refresh session (important for Server Components)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    // No user -> redirect to login
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  // Check if user has organization (via JWT app_metadata)
  const orgId = user.app_metadata?.organization_id;

  if (!orgId) {
    // Authenticated but no org -> redirect to onboarding
    const url = request.nextUrl.clone();
    url.pathname = "/sr/onboarding";
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico, icons (metadata files)
     */
    "/((?!api|_next/static|_next/image|favicon.ico|icons).*)",
  ],
};
