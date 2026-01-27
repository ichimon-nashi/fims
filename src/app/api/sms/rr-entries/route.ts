// src/app/api/sms/rr-entries/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getUserById } from '@/lib/database';
import { getRRSMSEntries, createRRSMSEntry } from '@/lib/smsDatabase';

// Updated permission check function
async function checkSMSPermissions(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { canView: false, canEdit: false, error: 'Unauthorized', status: 401 };
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);

  // Get user from database
  const user = await getUserById(decoded.userId);
  
  if (!user) {
    return { canView: false, canEdit: false, error: 'User not found', status: 404 };
  }

  // Check SMS permissions from app_permissions
  const smsPermissions = user.app_permissions?.sms;

  if (!smsPermissions || !smsPermissions.access) {
    return { canView: false, canEdit: false, error: 'Access denied: No SMS permissions', status: 403 };
  }

  // User has SMS access - can view
  // Check if they can also edit (view_only = false means can edit)
  const canEdit = !smsPermissions.view_only;

  return {
    canView: true,
    canEdit: canEdit,
    userId: decoded.userId
  };
}

export async function GET(request: NextRequest) {
  try {
    // Check SMS permissions - need VIEW access
    const permissions = await checkSMSPermissions(request.headers.get('authorization'));
    
    if (!permissions.canView) {
      return NextResponse.json({ error: permissions.error }, { status: permissions.status || 403 });
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
    // Check SMS permissions - need EDIT access
    const permissions = await checkSMSPermissions(request.headers.get('authorization'));
    
    if (!permissions.canEdit) {
      return NextResponse.json(
        { error: 'Access denied: Edit permission required' },
        { status: 403 }
      );
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
      // OLD fields (backward compatibility)
      risk_id_barrier: body.risk_id_barrier,
      last_review: body.last_review,
      next_review: body.next_review,
      // NEW fields
      risk_id: body.risk_id,
      risk_last_review: body.risk_last_review,
      risk_next_review: body.risk_next_review,
      barrier_id: body.barrier_id,
      barrier_last_review: body.barrier_last_review,
      barrier_next_review: body.barrier_next_review,
      created_by: permissions.userId!
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