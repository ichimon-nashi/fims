// src/app/api/sms/rr-entries/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getUserById } from '@/lib/database';
import { getRRSMSEntries, createRRSMSEntry } from '@/lib/smsDatabase';

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

  return { isAdmin: true, userId: decoded.userId };
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

    const filters: any = {};
    if (year) {
      filters.year = parseInt(year);
    }

    const entries = await getRRSMSEntries(filters);

    return NextResponse.json(entries);
  } catch (error: any) {
    console.error('Error in GET /api/sms/rr-entries:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    // Verify authentication and admin status
    const authCheck = await checkAdminAccess(request.headers.get('authorization'));
    
    if (!authCheck.isAdmin) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const body = await request.json();

    // Validate required fields
    if (!body.rr_number) {
      return NextResponse.json(
        { error: 'RR number is required' },
        { status: 400 }
      );
    }

    const entry = await createRRSMSEntry({
      rr_number: body.rr_number,
      srm_table_link_id: body.srm_table_link_id,
      risk_id_barrier: body.risk_id_barrier,
      last_review: body.last_review,
      next_review: body.next_review,
      created_by: authCheck.userId!
    });

    return NextResponse.json(entry, { status: 201 });
  } catch (error: any) {
    console.error('Error in POST /api/sms/rr-entries:', error);
    
    if (error.message.includes('already exists')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}