// src/app/api/sms/rr-entries/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getUserById } from '@/lib/database';
import { updateRRSMSEntry, deleteRRSMSEntry } from '@/lib/smsDatabase';

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

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication and admin status
    const authCheck = await checkAdminAccess(request.headers.get('authorization'));
    
    if (!authCheck.isAdmin) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { id } = await params;
    const body = await request.json();

    const updates: any = {};
    if (body.rr_number !== undefined) updates.rr_number = body.rr_number;
    if (body.srm_table_link_id !== undefined) updates.srm_table_link_id = body.srm_table_link_id;
    // NEW split fields only
    if (body.risk_id !== undefined) updates.risk_id = body.risk_id;
    if (body.risk_last_review !== undefined) updates.risk_last_review = body.risk_last_review;
    if (body.risk_next_review !== undefined) updates.risk_next_review = body.risk_next_review;
    if (body.barrier_id !== undefined) updates.barrier_id = body.barrier_id;
    if (body.barrier_last_review !== undefined) updates.barrier_last_review = body.barrier_last_review;
    if (body.barrier_next_review !== undefined) updates.barrier_next_review = body.barrier_next_review;

    const entry = await updateRRSMSEntry(id, updates);

    return NextResponse.json(entry);
  } catch (error: any) {
    console.error('Error in PUT /api/sms/rr-entries/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Verify authentication and admin status
    const authCheck = await checkAdminAccess(request.headers.get('authorization'));
    
    if (!authCheck.isAdmin) {
      return NextResponse.json({ error: authCheck.error }, { status: authCheck.status });
    }

    const { id } = await params;

    await deleteRRSMSEntry(id);

    return NextResponse.json({ message: 'Entry deleted successfully' });
  } catch (error: any) {
    console.error('Error in DELETE /api/sms/rr-entries/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}