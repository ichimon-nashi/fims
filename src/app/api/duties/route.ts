// src/app/api/duties/route.ts - CLEAN VERSION
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";

const ADMIN_ACCOUNTS = ["admin", "21986", "51892"];

export async function GET(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get("authorization"));

    if (!token) {
      return NextResponse.json(
        { message: "No token provided" },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);

    if (decoded.authLevel < 1) {
      return NextResponse.json(
        { message: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const supabase = await createClient();
    
    const { data: duties, error } = await supabase
      .from("duty_types")
      .select("*")
      .order("order_index");

    if (error) {
      console.error("Error fetching duties:", error);
      return NextResponse.json({
        duties: [
          { name: "OD", color: "#FF6B6B", order_index: 1 },
          { name: "SAG", color: "#4ECDC4", order_index: 2 },
          { name: "教師會", color: "#45B7D1", order_index: 3 },
          { name: "訓練", color: "#96CEB4", order_index: 4 },
          { name: "課", color: "#FFEAA7", order_index: 5 },
          { name: "專案", color: "#DDA0DD", order_index: 6 },
          { name: "休假", color: "#98D8C8", order_index: 7 },
          { name: "航查", color: "#F7DC6F", order_index: 8 },
          { name: "IOSA", color: "#BB8FCE", order_index: 9 }
        ]
      });
    }

    return NextResponse.json({ duties });
  } catch (error: any) {
    console.error("Get duties error:", error);
    return NextResponse.json(
      { message: "Failed to get duties", error: error.message },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get("authorization"));

    if (!token) {
      return NextResponse.json(
        { message: "No token provided" },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    
    // DEBUG: Log all possible user identifiers
    console.log("🔍 DEBUGGING USER PERMISSIONS:");
    console.log("Full decoded token:", JSON.stringify(decoded, null, 2));
    
    // Get user's employee_id from database using the UUID
    const supabase = await createClient();
    const { data: user, error: userError } = await supabase
      .from("users")
      .select("employee_id, full_name, email")
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
    console.log("✅ Found user:", {
      uuid: decoded.userId,
      employee_id: userEmployeeId,
      name: user.full_name,
      email: user.email
    });
    console.log("ADMIN_ACCOUNTS:", ADMIN_ACCOUNTS);
    console.log("Is admin check result:", ADMIN_ACCOUNTS.includes(userEmployeeId));
    
    if (!ADMIN_ACCOUNTS.includes(userEmployeeId)) {
      console.log("❌ Permission denied for employee_id:", userEmployeeId);
      return NextResponse.json(
        { 
          message: "Insufficient permissions to modify duties",
          debug: {
            userEmployeeId,
            adminAccounts: ADMIN_ACCOUNTS,
            userUuid: decoded.userId
          }
        },
        { status: 403 }
      );
    }

    console.log("✅ Permission granted for admin user:", userEmployeeId);

    const { name, color, order_index } = await request.json();

    if (!name || !color) {
      return NextResponse.json(
        { message: "Name and color are required" },
        { status: 400 }
      );
    }
    
    const { data: newDuty, error } = await supabase
      .from("duty_types")
      .insert([{
        name: name.trim(),
        color,
        order_index: order_index || 999,
        created_by: userEmployeeId,
        created_at: new Date().toISOString()
      }])
      .select()
      .single();

    if (error) {
      console.error("Error creating duty:", error);
      return NextResponse.json(
        { message: "Failed to create duty", error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Duty created successfully",
      duty: newDuty
    }, { status: 201 });
  } catch (error: any) {
    console.error("Create duty error:", error);
    return NextResponse.json(
      { message: "Failed to create duty", error: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get("authorization"));

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
    console.log("🔍 PUT - User employee_id:", userEmployeeId);
    
    if (!ADMIN_ACCOUNTS.includes(userEmployeeId)) {
      console.log("❌ PUT Permission denied for employee_id:", userEmployeeId);
      return NextResponse.json(
        { 
          message: "Insufficient permissions to modify duties",
          debug: { userEmployeeId, adminAccounts: ADMIN_ACCOUNTS }
        },
        { status: 403 }
      );
    }

    const { oldName, newName } = await request.json();

    if (!oldName || !newName) {
      return NextResponse.json(
        { message: "Both oldName and newName are required" },
        { status: 400 }
      );
    }
    
    // Update duty name in duty_types table
    const { data: updatedDuty, error } = await supabase
      .from("duty_types")
      .update({ 
        name: newName.trim(),
        updated_at: new Date().toISOString()
      })
      .eq('name', oldName)
      .select()
      .single();

    if (error) {
      console.error("Error updating duty name:", error);
      return NextResponse.json(
        { message: "Failed to update duty name", error: error.message },
        { status: 500 }
      );
    }

    // Update existing schedule entries
    const { data: schedules, error: fetchError } = await supabase
      .from("fi_schedule")
      .select("*")
      .contains('duties', [oldName]);

    if (!fetchError && schedules) {
      for (const schedule of schedules) {
        const updatedDuties = schedule.duties.map((duty: string) => 
          duty === oldName ? newName.trim() : duty
        );

        await supabase
          .from("fi_schedule")
          .update({ 
            duties: updatedDuties,
            updated_at: new Date().toISOString(),
            updated_by: userEmployeeId
          })
          .eq('id', schedule.id);
      }
    }

    return NextResponse.json({
      message: "Duty name updated successfully",
      duty: updatedDuty
    });
  } catch (error: any) {
    console.error("Update duty error:", error);
    return NextResponse.json(
      { message: "Failed to update duty", error: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const token = extractTokenFromHeader(request.headers.get("authorization"));

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
    console.log("🔍 DELETE - User employee_id:", userEmployeeId);
    
    if (!ADMIN_ACCOUNTS.includes(userEmployeeId)) {
      console.log("❌ DELETE Permission denied for employee_id:", userEmployeeId);
      return NextResponse.json(
        { 
          message: "Insufficient permissions to delete duties",
          debug: { userEmployeeId, adminAccounts: ADMIN_ACCOUNTS }
        },
        { status: 403 }
      );
    }

    const { searchParams } = new URL(request.url);
    const dutyName = searchParams.get("name");

    if (!dutyName) {
      return NextResponse.json(
        { message: "Duty name is required" },
        { status: 400 }
      );
    }
    
    // Remove duty from all existing schedules first
    const { data: schedules, error: fetchError } = await supabase
      .from("fi_schedule")
      .select("*")
      .contains('duties', [dutyName]);

    if (!fetchError && schedules) {
      for (const schedule of schedules) {
        const updatedDuties = schedule.duties.filter((duty: string) => duty !== dutyName);
        
        if (updatedDuties.length === 0) {
          // Delete entire schedule entry if no duties remain
          await supabase
            .from("fi_schedule")
            .delete()
            .eq('id', schedule.id);
        } else {
          // Update with remaining duties
          await supabase
            .from("fi_schedule")
            .update({ 
              duties: updatedDuties,
              updated_at: new Date().toISOString(),
              updated_by: userEmployeeId
            })
            .eq('id', schedule.id);
        }
      }
    }

    // Delete duty from duty_types table
    const { error } = await supabase
      .from("duty_types")
      .delete()
      .eq('name', dutyName);

    if (error) {
      console.error("Error deleting duty:", error);
      return NextResponse.json(
        { message: "Failed to delete duty", error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      message: "Duty deleted successfully"
    });
  } catch (error: any) {
    console.error("Delete duty error:", error);
    return NextResponse.json(
      { message: "Failed to delete duty", error: error.message },
      { status: 500 }
    );
  }
}