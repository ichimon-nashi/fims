// src/app/api/test-results/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";

export async function GET(request: NextRequest) {
  try {
    console.log("=== TEST RESULTS API DEBUG ===");
    
    const token = extractTokenFromHeader(
      request.headers.get("authorization")
    );

    if (!token) {
      console.log("No token provided");
      return NextResponse.json(
        { message: "No token provided" },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    console.log("Token decoded successfully:", {
      userId: decoded.userId,
      authLevel: decoded.authLevel
    });

    if (decoded.authLevel < 2) {
      console.log("Insufficient permissions:", decoded.authLevel);
      return NextResponse.json(
        { message: "Insufficient permissions" },
        { status: 403 }
      );
    }

    console.log("Fetching test results with question details...");
    const supabase = await createClient();
    
    // First, get all test results
    const { data: testResults, error: testError } = await supabase
      .from("test_results")
      .select("*")
      .order("test_date", { ascending: false })
      .order("created_at", { ascending: false });

    if (testError) {
      console.error("Error fetching test results:", testError);
      return NextResponse.json(
        { message: "Failed to fetch test results", error: testError.message },
        { status: 500 }
      );
    }

    console.log("Test results retrieved:", testResults?.length || 0);

    // Enhanced results with question details
    const enhancedResults = await Promise.all(
      testResults.map(async (result) => {
        // Collect all question IDs from this test result
        const questionIds = [
          result.q1_id,
          result.q2_id,
          result.q3_id,
          result.r1_id,
          result.r2_id,
        ].filter(id => id !== null);

        // Fetch question details for all questions in this result
        let questionDetails = {};
        
        if (questionIds.length > 0) {
          const { data: questions, error: questionError } = await supabase
            .from("questions")
            .select("id, question_number, question_title, question_category")
            .in("id", questionIds);

          if (!questionError && questions) {
            // Create a map of question ID to question details
            const questionMap = {};
            questions.forEach(q => {
              questionMap[q.id] = {
                id: q.id,
                number: q.question_number || "N/A",
                title: q.question_title,
                category: q.question_category
              };
            });

            // Map each question to its position
            questionDetails = {
              q1: result.q1_id ? {
                ...questionMap[result.q1_id],
                result: result.q1_result
              } : null,
              q2: result.q2_id ? {
                ...questionMap[result.q2_id],
                result: result.q2_result
              } : null,
              q3: result.q3_id ? {
                ...questionMap[result.q3_id],
                result: result.q3_result
              } : null,
              r1: result.r1_id ? {
                ...questionMap[result.r1_id],
                result: result.r1_result
              } : null,
              r2: result.r2_id ? {
                ...questionMap[result.r2_id],
                result: result.r2_result
              } : null,
            };
          }
        }

        return {
          ...result,
          questions: questionDetails
        };
      })
    );

    console.log("Enhanced results prepared with question details");
    console.log("Sample question data:", enhancedResults[0]?.questions?.q1);

    return NextResponse.json(enhancedResults);

  } catch (error: any) {
    console.error("Get test results error:", error);
    return NextResponse.json(
      {
        message: "Failed to get test results",
        error: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    console.log("=== CREATE TEST RESULT API DEBUG ===");
    
    const token = extractTokenFromHeader(
      request.headers.get("authorization")
    );

    if (!token) {
      console.log("No token provided for test result creation");
      return NextResponse.json(
        { message: "No token provided" },
        { status: 401 }
      );
    }

    const decoded = verifyToken(token);
    console.log("Token decoded successfully for test result creation:", {
      userId: decoded.userId,
      authLevel: decoded.authLevel
    });

    if (decoded.authLevel < 3) {
      console.log("Insufficient permissions for test result creation:", decoded.authLevel);
      return NextResponse.json(
        { message: "Insufficient permissions" },
        { status: 403 }
      );
    }

    const resultData = await request.json();
    console.log("Creating test result with data:", {
      employee_id: resultData.employee_id,
      test_date: resultData.test_date,
      examiner: resultData.examiner_name
    });

    // Validate required fields
    const required = [
      "test_date",
      "employee_id",
      "full_name",
      "rank",
      "base",
      "examiner_name",
      "examiner_id",
    ];
    
    for (const field of required) {
      if (
        resultData[field] === undefined ||
        resultData[field] === null ||
        resultData[field] === ""
      ) {
        console.log(`Missing required field: ${field}`);
        return NextResponse.json(
          { message: `${field} is required` },
          { status: 400 }
        );
      }
    }

    // Create Supabase client
    const supabase = await createClient();

    // Prepare test result data
    const newTestResultData = {
      test_date: resultData.test_date,
      employee_id: resultData.employee_id,
      full_name: resultData.full_name.trim(),
      rank: resultData.rank.trim(),
      base: resultData.base.trim(),
      q1_id: resultData.q1_id,
      q1_result: resultData.q1_result,
      q2_id: resultData.q2_id,
      q2_result: resultData.q2_result,
      q3_id: resultData.q3_id,
      q3_result: resultData.q3_result,
      r1_id: resultData.r1_id,
      r1_result: resultData.r1_result,
      r2_id: resultData.r2_id,
      r2_result: resultData.r2_result,
      examiner_name: resultData.examiner_name.trim(),
      examiner_id: resultData.examiner_id,
      created_at: new Date().toISOString(),
    };

    console.log("Inserting test result into database...");
    const { data: createdResult, error: insertError } = await supabase
      .from("test_results")
      .insert([newTestResultData])
      .select()
      .single();

    if (insertError) {
      console.error("Error inserting test result:", insertError);
      return NextResponse.json(
        { message: "Failed to create test result", error: insertError.message },
        { status: 500 }
      );
    }

    console.log("Test result created successfully:", createdResult.id);

    return NextResponse.json({
      message: "Test result created successfully",
      result: createdResult
    }, { status: 201 });

  } catch (error: any) {
    console.error("Create test result API error:", error);
    
    return NextResponse.json(
      {
        message: "Internal server error during test result creation",
        error: error.message,
      },
      { status: 500 }
    );
  }
}