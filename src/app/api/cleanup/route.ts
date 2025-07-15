// src/app/api/cleanup/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";

const ADMIN_ACCOUNTS = ["admin", "21986", "51892"];

export async function POST(request: NextRequest) {
  try {
    console.log("=== DATABASE CLEANUP API ===");
    
    const token = extractTokenFromHeader(
      request.headers.get("authorization")
    );

    if (!token) {
      return NextResponse.json(
        { message: "No token provided" },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    
    // Get user's employee_id from database using the UUID
    const supabase = await createClient();
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("employee_id, full_name")
      .eq("id", decoded.userId)
      .single();

    if (userError || !user) {
      console.log("❌ User not found in database:", decoded.userId);
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    const userEmployeeId = user.employee_id;
    const isAdmin = ADMIN_ACCOUNTS.includes(userEmployeeId);
    
    console.log("🔍 CLEANUP - User employee_id:", userEmployeeId);
    console.log("🔍 CLEANUP - Is admin:", isAdmin);
    
    if (!isAdmin) {
      return NextResponse.json(
        { message: "Only administrators can run database cleanup" },
        { status: 403 }
      );
    }

    const currentYear = new Date().getFullYear();
    const minYear = Math.max(2025, currentYear - 1); // Keep from 2025 or current-1, whichever is higher
    const maxYear = currentYear + 1;

    console.log(`🧹 Cleaning up records outside range: ${minYear} to ${maxYear}`);
    
    // 1. Delete entries with empty duties arrays
    const { data: emptyDutiesDeleted, error: emptyError } = await supabase
      .from("fi_schedule")
      .delete()
      .or("duties.is.null,duties.eq.{}")
      .select("id");

    if (emptyError) {
      console.error("Error deleting empty duties:", emptyError);
    } else {
      console.log(`🗑️ Deleted ${emptyDutiesDeleted?.length || 0} entries with empty duties`);
    }

    // 2. Delete entries outside the year range
    const { data: oldRecordsDeleted, error: oldError } = await supabase
      .from("fi_schedule")
      .delete()
      .lt("date", `${minYear}-01-01`)
      .select("id");

    const { data: futureRecordsDeleted, error: futureError } = await supabase
      .from("fi_schedule")
      .delete()
      .gt("date", `${maxYear}-12-31`)
      .select("id");

    if (oldError || futureError) {
      console.error("Error deleting out-of-range records:", { oldError, futureError });
    }

    const totalOldDeleted = (oldRecordsDeleted?.length || 0) + (futureRecordsDeleted?.length || 0);
    console.log(`📅 Deleted ${totalOldDeleted} records outside year range`);

    // 3. Get summary of remaining records
    const { data: summary, error: summaryError } = await supabase
      .from("fi_schedule")
      .select("date")
      .order("date");

    const remainingCount = summary?.length || 0;
    const dateRange = summary && summary.length > 0 
      ? `${summary[0].date} to ${summary[summary.length - 1].date}`
      : "No records";

    return NextResponse.json({
      message: "Database cleanup completed successfully",
      summary: {
        emptyDutiesDeleted: emptyDutiesDeleted?.length || 0,
        oldRecordsDeleted: totalOldDeleted,
        remainingRecords: remainingCount,
        dateRange,
        yearRange: `${minYear} to ${maxYear}`
      }
    });

  } catch (error: any) {
    console.error("Database cleanup error:", error);
    return NextResponse.json(
      { 
        message: "Failed to run database cleanup",
        error: error.message 
      },
      { status: 500 }
    );
  }
}

// GET endpoint to preview what would be cleaned up
export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(
      request.headers.get("authorization")
    );

    if (!token) {
      return NextResponse.json(
        { message: "No token provided" },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    
    // Get user's employee_id from database using the UUID
    const supabase = await createClient();
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("employee_id, full_name")
      .eq("id", decoded.userId)
      .single();

    if (userError || !user) {
      console.log("❌ User not found in database:", decoded.userId);
      return NextResponse.json(
        { message: "User not found" },
        { status: 404 }
      );
    }

    const userEmployeeId = user.employee_id;
    const isAdmin = ADMIN_ACCOUNTS.includes(userEmployeeId);
    
    console.log("🔍 CLEANUP PREVIEW - User employee_id:", userEmployeeId);
    console.log("🔍 CLEANUP PREVIEW - Is admin:", isAdmin);
    
    if (!isAdmin) {
      return NextResponse.json(
        { message: "Only administrators can preview cleanup" },
        { status: 403 }
      );
    }

    const currentYear = new Date().getFullYear();
    const minYear = Math.max(2025, currentYear - 1);
    const maxYear = currentYear + 1;
    
    // Count entries with empty duties
    const { count: emptyDutiesCount } = await supabase
      .from("fi_schedule")
      .select("id", { count: 'exact' })
      .or("duties.is.null,duties.eq.{}");

    // Count old records
    const { count: oldRecordsCount } = await supabase
      .from("fi_schedule")
      .select("id", { count: 'exact' })
      .lt("date", `${minYear}-01-01`);

    // Count future records
    const { count: futureRecordsCount } = await supabase
      .from("fi_schedule")
      .select("id", { count: 'exact' })
      .gt("date", `${maxYear}-12-31`);

    // Total records
    const { count: totalRecords } = await supabase
      .from("fi_schedule")
      .select("id", { count: 'exact' });

    return NextResponse.json({
      preview: {
        currentYearRange: `${minYear} to ${maxYear}`,
        totalRecords: totalRecords || 0,
        toBeDeleted: {
          emptyDuties: emptyDutiesCount || 0,
          oldRecords: oldRecordsCount || 0,
          futureRecords: futureRecordsCount || 0,
          total: (emptyDutiesCount || 0) + (oldRecordsCount || 0) + (futureRecordsCount || 0)
        },
        willRemain: (totalRecords || 0) - ((emptyDutiesCount || 0) + (oldRecordsCount || 0) + (futureRecordsCount || 0))
      }
    });

  } catch (error: any) {
    console.error("Cleanup preview error:", error);
    return NextResponse.json(
      { 
        message: "Failed to preview cleanup",
        error: error.message 
      },
      { status: 500 }
    );
  }
}