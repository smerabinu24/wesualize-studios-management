export { default } from "next-auth/middleware";

// Protect everything except auth, login, password reset and static assets.
export const config = {
  matcher: [
    // Protect everything except auth/public routes, Next internals, and static
    // asset files (anything ending in a common image/font extension).
    "/((?!api/auth|api/password|login|reset-password|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?)).*)",
  ],
};
