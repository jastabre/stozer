import createMiddleware from "next-intl/middleware";
import { routing } from "@/i18n/routing";
import { NextResponse, type NextRequest } from "next/server";
import { createMiddlewareClient } from "@/lib/supabase/middleware";

const handleI18nRouting = createMiddleware(routing);

// Routes that don't require authentication (public)
const publicPathnames = ["/login", "/register", "/verify", "/reset-password"];

// Static and API routes to skip
const excludedPaths = ["/api", "/_next", "/favicon.ico", "/icons", "/offline"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip excluded paths entirely
  if (excludedPaths.some((p) => pathname.startsWith(p))) {
    return NextResponse.next();
  }

  // First, handle i18n routing (locale detection + redirect)
  const i18nResponse = await handleI18nRouting(request);

  // Check if this is a public path (after locale prefix removal)
  const pathnameWithoutLocale = pathname.replace(/^\/(sr|en)/, "") || "/";
  const isPublic = publicPathnames.some(
    (p) => pathnameWithoutLocale === p || pathnameWithoutLocale.startsWith(p + "/")
  );

  if (isPublic) {
    return i18nResponse;
  }

  // For non-public routes, check authentication
  const { supabase, supabaseResponse } = await createMiddlewareClient(
    request
  );

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
