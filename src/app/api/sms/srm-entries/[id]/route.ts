// src/app/api/sms/srm-entries/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getUserById } from '@/lib/database';
import { updateSRMTableEntry, deleteSRMTableEntry } from '@/lib/smsDatabase';

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
    if (body.number !== undefined) updates.number = body.number;
    if (body.file_date !== undefined) updates.file_date = body.file_date;
    if (body.identification_source_type !== undefined) updates.identification_source_type = body.identification_source_type;
    if (body.identification_source_detail !== undefined) updates.identification_source_detail = body.identification_source_detail;
    if (body.occurrence_month !== undefined) updates.occurrence_month = body.occurrence_month;
    if (body.hazard_description !== undefined) updates.hazard_description = body.hazard_description;
    if (body.possible_cause !== undefined) updates.possible_cause = body.possible_cause;
    if (body.hazard_impact !== undefined) updates.hazard_impact = body.hazard_impact;
    if (body.existing_measures !== undefined) updates.existing_measures = body.existing_measures;
    if (body.current_risk_assessment !== undefined) updates.current_risk_assessment = body.current_risk_assessment;
    if (body.risk_mitigation_measures !== undefined) updates.risk_mitigation_measures = body.risk_mitigation_measures;
    if (body.post_mitigation_assessment !== undefined) updates.post_mitigation_assessment = body.post_mitigation_assessment;
    if (body.human_factors_codes !== undefined) updates.human_factors_codes = body.human_factors_codes;
    if (body.ef_attribute_codes !== undefined) updates.ef_attribute_codes = body.ef_attribute_codes;

    const entry = await updateSRMTableEntry(id, updates);

    return NextResponse.json(entry);
  } catch (error: any) {
    console.error('Error in PUT /api/sms/srm-entries/[id]:', error);
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

    await deleteSRMTableEntry(id);

    return NextResponse.json({ message: 'Entry deleted successfully' });
  } catch (error: any) {
    console.error('Error in DELETE /api/sms/srm-entries/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}