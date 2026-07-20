import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

// 🛡️ THE BOUNCER: Enterprise Route Protection
export function proxy(request: NextRequest) {
  // 1. Identify where the user is trying to go
  const path = request.nextUrl.pathname;

  // 2. Define protected zones (Dashboard only)
  // NOTE: Guest pages are protected individually via GuestLayout and local storage token!
  // The middleware MUST NOT intercept /guest routes because Capacitor Android does not send cookies correctly by default.
  const isProtectedPath = path.startsWith('/dashboard');

  // 3. Allow access to public assets (images, static files, api routes)
  if (path.startsWith('/_next') || path.startsWith('/api') || path.includes('.')) {
    return NextResponse.next();
  }

  // 4. Check for the VIP Wristband (Auth Cookie)
  const token = request.cookies.get('miracle_session_token')?.value;

  // 5. If they are trying to enter a protected zone without a token, kick them out
  if (isProtectedPath && !token) {
    console.log(`🚨 SECURITY INTERCEPT: Blocked unauthorized access to ${path}`);
    return NextResponse.redirect(new URL('/', request.url));
  }

  // 6. If they have a token and try to go to the login screen, redirect to dashboard
  if (path === '/' && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // 7. Otherwise, let them proceed normally
  return NextResponse.next();
}

// Ensure the middleware runs on these specific routes
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};
