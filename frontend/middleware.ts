import { NextRequest, NextResponse } from "next/server";

const IS_FAMILY_DEMO = process.env.NEXT_PUBLIC_DEMO_MODE === "true";

export function middleware(request: NextRequest) {
  if (!IS_FAMILY_DEMO) return NextResponse.next();
  return NextResponse.redirect(new URL("/", request.url));
}

export const config = {
  matcher: [
    "/login",
    "/onboarding/:path*",
    "/forgot-password",
    "/reset-password",
    "/verify-email",
    "/devenir-allie",
    "/formulaire-allie/:path*",
    "/formulaire-allie-repit",
    "/admin/:path*",
    "/dev/:path*",
    "/billing/:path*",
    "/me/ally-candidature",
    "/me/formation"
  ]
};
