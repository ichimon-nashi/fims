// src/middleware.ts
// Create this file to handle routing properly
import { NextRequest, NextResponse } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  
  // Allow all API routes
  if (pathname.startsWith('/api/')) {
    return NextResponse.next();
  }
  
  // Allow static files
  if (pathname.startsWith('/_next/') || pathname.includes('.')) {
    return NextResponse.next();
  }
  
  // Check for token in cookies or localStorage (we'll rely on client-side auth)
  const token = request.cookies.get('token')?.value;
  
  // Public routes that don't require authentication
  const publicRoutes = ['/login'];
  const isPublicRoute = publicRoutes.includes(pathname);
  
  // Root path handling
  if (pathname === '/') {
    // Let the client-side routing handle this
    return NextResponse.next();
  }
  
  // For now, let all routes through and let client-side auth handle it
  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};