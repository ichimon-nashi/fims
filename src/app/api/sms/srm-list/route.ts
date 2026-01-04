// src/app/api/sms/srm-list/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getUserById } from '@/lib/database';
import { getSRMTableListItems } from '@/lib/smsDatabase';

const ADMIN_ACCOUNTS = ["admin", "21986", "51892"];

async function checkAdminAccess(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { isAdmin: false, error: 'Unauthorized', status: 401 };
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  // Get user from database to check employee_id
  const user = await getUserById(decoded.userId);
  
  if (!user) {
    return { isAdmin: false, error: 'User not found', status: 404 };
  }

  // Check if user is admin using employee_id
  const isAdmin = ADMIN_ACCOUNTS.includes(user.employee_id) || 
                 ADMIN_ACCOUNTS.includes(user.email);

  if (!isAdmin) {
    return { isAdmin: false, error: 'Access denied', status: 403 };
  }

  return { isAdmin: true };
}

export async function GET(request: NextRequest) {
  try {
    // Verify authentication and admin status
    const authCheck = await checkAdminAccess(request.headers.get('authorization'));
    
    if (!authCheck.isAdmin) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const year = searchParams.get('year');

    const items = await getSRMTableListItems(year ? parseInt(year) : undefined);

    return NextResponse.json(items);
  } catch (error: any) {
    console.error('Error in GET /api/sms/srm-list:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}