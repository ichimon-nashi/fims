// src/app/api/audit/iosa/cycles/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractTokenFromHeader, verifyToken } from "@/lib/auth";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractTokenFromHeader(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    verifyToken(token);

    const { id } = await context.params;
    const body = await req.json();

    // Only allow updating name, status, and disciplines
    const updates: Record<string, any> = {};
    if (body.name        !== undefined) updates.name        = body.name.trim();
    if (body.status      !== undefined) updates.status      = body.status;
    if (body.disciplines !== undefined) updates.disciplines = body.disciplines;

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
    }

    // Add timestamps for status transitions
    if (body.status === "active")    updates.activated_at  = new Date().toISOString();
    if (body.status === "completed") updates.completed_at  = new Date().toISOString();

    const { data, error } = await supabase
      .from("audit_iosa_cycles")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) throw error;
    return NextResponse.json({ cycle: data });
  } catch (e: any) {
    console.error("[cycles PATCH]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

export async function DELETE(
  req: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const token = extractTokenFromHeader(req.headers.get("authorization"));
    if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    verifyToken(token);

    const { id } = await context.params;

    // Delete cascade — records are deleted by ON DELETE CASCADE in DB schema
    const { error } = await supabase
      .from("audit_iosa_cycles")
      .delete()
      .eq("id", id);

    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e: any) {
    console.error("[cycles DELETE]", e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}