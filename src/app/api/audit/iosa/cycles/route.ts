// src/app/api/audit/iosa/cycles/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { extractTokenFromHeader, verifyToken } from "@/lib/auth";

const supabase = createClient(
	process.env.NEXT_PUBLIC_SUPABASE_URL!,
	process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
);

// GET — fetch cycles. ?all=true returns all, otherwise most recent prep/active
export async function GET(req: NextRequest) {
	try {
		const token = extractTokenFromHeader(req.headers.get("authorization"));
		if (!token)
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 },
			);
		verifyToken(token);

		const all = req.nextUrl.searchParams.get("all") === "true";

		if (all) {
			const { data, error } = await supabase
				.from("audit_iosa_cycles")
				.select("*")
				.order("created_at", { ascending: false });
			if (error) throw error;
			return NextResponse.json({ cycles: data ?? [] });
		}

		const { data, error } = await supabase
			.from("audit_iosa_cycles")
			.select("*")
			.in("status", ["prep", "active"])
			.order("created_at", { ascending: false })
			.limit(1)
			.maybeSingle();
		if (error) throw error;
		return NextResponse.json({ cycle: data ?? null });
	} catch (e: any) {
		console.error("[cycles GET]", e);
		return NextResponse.json({ error: e.message }, { status: 500 });
	}
}

// POST — create new cycle. Checks for duplicate name unless force=true
export async function POST(req: NextRequest) {
	try {
		const token = extractTokenFromHeader(req.headers.get("authorization"));
		if (!token)
			return NextResponse.json(
				{ error: "Unauthorized" },
				{ status: 401 },
			);
		const decoded = verifyToken(token);

		const body = await req.json();
		const { name, year, ism_edition, disciplines, force } = body;

		if (!name || !year || !disciplines?.length) {
			return NextResponse.json(
				{ error: "Missing required fields" },
				{ status: 400 },
			);
		}

		// Check for duplicate name unless force flag is set
		if (!force) {
			const { data: existing } = await supabase
				.from("audit_iosa_cycles")
				.select("id")
				.eq("name", name.trim())
				.maybeSingle();
			if (existing) {
				return NextResponse.json(
					{ error: "Duplicate name" },
					{ status: 409 },
				);
			}
		}

		const { data, error } = await supabase
			.from("audit_iosa_cycles")
			.insert({
				name: name.trim(),
				year,
				ism_edition: ism_edition || "Ed.18 Rev1",
				disciplines,
				status: "prep",
				created_by: decoded.userId,
			})
			.select()
			.single();

		if (error) throw error;
		return NextResponse.json({ cycle: data });
	} catch (e: any) {
		console.error("[cycles POST]", e);
		return NextResponse.json({ error: e.message }, { status: 500 });
	}
}
