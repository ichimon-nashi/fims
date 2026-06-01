// src/app/api/dashboard/sms-reviews/route.ts
import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // ── Taiwan UTC+8 today ────────────────────────────────────────────────
    const now = new Date();
    const taiwanNow = new Date(
      now.getTime() + (8 * 60 + now.getTimezoneOffset()) * 60000
    );
    const todayStr  = taiwanNow.toISOString().split("T")[0];
    const todayDate = new Date(todayStr);
    const msPerDay  = 1000 * 60 * 60 * 24;

    // ── Step 1: rr_sms_entries — only the columns we need ────────────────
    const { data: rrRows, error: rrError } = await supabase
      .from("rr_sms_entries")
      .select(
        "rr_number, risk_id, barrier_id, risk_next_review, barrier_next_review, srm_table_link_id"
      )
      .eq("is_deprecated", false);

    if (rrError) {
      return NextResponse.json(
        { error: "rr_sms_entries query failed", detail: rrError },
        { status: 500 }
      );
    }

    if (!rrRows || rrRows.length === 0) {
      return NextResponse.json({ items: [], isFallback: false });
    }

    // ── Step 2: srm_table_entries for hazard descriptions ─────────────────
    const linkIds = [
      ...new Set(
        rrRows
          .map((r) => (r as any).srm_table_link_id)
          .filter((id): id is string => typeof id === "string" && id.length > 0)
      ),
    ];

    const srmMap = new Map<string, string>();

    if (linkIds.length > 0) {
      const { data: srmRows, error: srmError } = await supabase
        .from("srm_table_entries")
        .select("id, hazard_description")
        .in("id", linkIds);

      if (!srmError && srmRows) {
        for (const row of srmRows) {
          if (row.id && row.hazard_description) {
            srmMap.set(row.id, row.hazard_description);
          }
        }
      }
      // srmError is non-fatal — items show with （無說明）
    }

    // ── Step 3: enrich — pick whichever date is earlier ──────────────────
    type Row = {
      rr_number: string;
      risk_id: string;
      barrier_id: string;
      hazard_description: string;
      next_review: string;
      is_overdue: boolean;
      days_until: number;
    };

    const enriched: Row[] = [];

    for (const raw of rrRows) {
      const r = raw as any;
      const riskDate    = r.risk_next_review    ?? null;
      const barrierDate = r.barrier_next_review ?? null;

      let nextReview: string | null = null;
      if (riskDate && barrierDate) {
        nextReview = riskDate <= barrierDate ? riskDate : barrierDate;
      } else {
        nextReview = riskDate ?? barrierDate ?? null;
      }

      if (!nextReview) continue;

      // Strip any time component — compare date-only
      const nextReviewDate = nextReview.slice(0, 10);
      const reviewDate     = new Date(nextReviewDate);
      const days_until     = Math.round(
        (reviewDate.getTime() - todayDate.getTime()) / msPerDay
      );

      const rawDesc =
        srmMap.get(r.srm_table_link_id ?? "") ?? "（無說明）";
      const hazard_description =
        rawDesc.length > 50 ? rawDesc.slice(0, 48) + "…" : rawDesc;

      enriched.push({
        rr_number: (r.rr_number ?? "").trim(),
        risk_id: (r.risk_id ?? "").trim(),
        barrier_id: (r.barrier_id ?? "").trim(),
        hazard_description,
        next_review: nextReviewDate,
        is_overdue: days_until < 0,
        days_until,
      });
    }

    // Sort: most overdue first, then soonest upcoming
    enriched.sort((a, b) => a.days_until - b.days_until);

    // ── Step 4: within-30-days; fallback to nearest 3 ────────────────────
    const within30 = enriched.filter((r) => r.days_until >= 0 && r.days_until <= 30);

    if (within30.length > 0) {
      return NextResponse.json({ items: within30, isFallback: false });
    }

    // Include overdue items (days_until < 0) in fallback too
    const fallback = enriched.slice(0, 3);
    return NextResponse.json({
      items: fallback,
      isFallback: fallback.length > 0,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: "Unhandled exception", detail: String(err?.message ?? err) },
      { status: 500 }
    );
  }
}