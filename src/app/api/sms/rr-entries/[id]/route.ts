// src/app/api/sms/rr-entries/[id]/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { verifyToken } from '@/lib/auth';
import { getUserById } from '@/lib/database';
import { updateRRSMSEntry, deleteRRSMSEntry } from '@/lib/smsDatabase';
import { createClient } from "@supabase/supabase-js";

async function checkSMSPermissions(authHeader: string | null) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { canView: false, canEdit: false, error: 'Unauthorized', status: 401 };
  }

  const token = authHeader.substring(7);
  const decoded = verifyToken(token);
  const user = await getUserById(decoded.userId);
  
  if (!user) {
    return { canView: false, canEdit: false, error: 'User not found', status: 404 };
  }

  const smsPermissions = user.app_permissions?.sms;

  if (!smsPermissions || !smsPermissions.access) {
    return { canView: false, canEdit: false, error: 'Access denied: No SMS permissions', status: 403 };
  }

  const canEdit = !smsPermissions.view_only;

  return {
    canView: true,
    canEdit: canEdit,
    userId: decoded.userId
  };
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // Next.js 15 fix
    const permissions = await checkSMSPermissions(request.headers.get('authorization'));
    
    if (!permissions.canEdit) {
      return NextResponse.json(
        { error: 'Access denied: Edit permission required' },
        { status: 403 }
      );
    }

    const body = await request.json();

    const entry = await updateRRSMSEntry(id, {
      rr_number: body.rr_number,
      srm_table_link_id: body.srm_table_link_id,
      risk_id_barrier: body.risk_id_barrier,
      last_review: body.last_review,
      next_review: body.next_review,
      risk_id: body.risk_id,
      risk_last_review: body.risk_last_review,
      risk_next_review: body.risk_next_review,
      barrier_id: body.barrier_id,
      barrier_last_review: body.barrier_last_review,
      barrier_next_review: body.barrier_next_review,
    });

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
    const { id } = await params; // Next.js 15 fix
    const permissions = await checkSMSPermissions(request.headers.get('authorization'));
    
    if (!permissions.canEdit) {
      return NextResponse.json(
        { error: 'Access denied: Edit permission required' },
        { status: 403 }
      );
    }

    await deleteRRSMSEntry(id);
    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error in DELETE /api/sms/rr-entries/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params; // Next.js 15 fix
    const permissions = await checkSMSPermissions(request.headers.get('authorization'));
    
    if (!permissions.canEdit) {
      return NextResponse.json(
        { error: 'Access denied: Edit permission required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { is_deprecated } = body;

    if (typeof is_deprecated !== 'boolean') {
      return NextResponse.json(
        { error: 'is_deprecated must be a boolean' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const { data, error } = await supabase
      .from('rr_sms_entries')
      .update({
        is_deprecated,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id)
      .select(`
        *,
        srm_table_link:srm_table_link_id(id, number, file_date, hazard_description)
      `)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        { error: 'Entry not found' },
        { status: 404 }
      );
    }

    return NextResponse.json(data);
  } catch (error: any) {
    console.error('Error in PATCH /api/sms/rr-entries/[id]:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to update deprecated status' },
      { status: 500 }
    );
  }
}