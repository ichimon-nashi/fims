// src/app/api/test-results/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { checkOralTestPermissions } from "@/lib/oralTestPermissions";

// Define interfaces for type safety
interface QuestionDetail {
	id: string;
	number: number | string;
	title: string;
	category: string;
	result?: boolean | null;
}

interface QuestionDetails {
	q1: QuestionDetail | null;
	q2: QuestionDetail | null;
	q3: QuestionDetail | null;
	r1: QuestionDetail | null;
	r2: QuestionDetail | null;
}

export async function GET(request: NextRequest) {
	try {
		console.log("=== TEST RESULTS API DEBUG ===");

		// Check Oral Test permissions - need VIEW access (anyone with oral_test.access can view results)
		const permissions = await checkOralTestPermissions(
			request.headers.get("authorization")
		);

		if (!permissions.canView) {
			console.log("Access denied:", permissions.error);
			return NextResponse.json(
				{ message: permissions.error || "Access denied" },
				{ status: permissions.status || 403 }
			);
		}

		console.log("User has Oral Test access:", permissions.userId);
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
				{
					message: "Failed to fetch test results",
					error: testError.message,
				},
				{ status: 500 }
			);
		}

		console.log("Test results retrieved:", testResults?.length || 0);

		// Batch every question ID used by any result into a single lookup
		// instead of one query per result row. The old code did
		// testResults.map(async (result) => await supabase...in(questionIds))
		// — Promise.all made those run concurrently, but concurrent-and-
		// separate is still one round trip per result, not one total.
		const allQuestionIds = [
			...new Set(
				testResults
					.flatMap((r) => [r.q1_id, r.q2_id, r.q3_id, r.r1_id, r.r2_id])
					.filter((id): id is string => id !== null)
			),
		];

		const questionMap: Record<string, QuestionDetail> = {};
		if (allQuestionIds.length > 0) {
			const { data: questions, error: questionError } = await supabase
				.from("questions")
				.select("id, question_number, question_title, question_category")
				.in("id", allQuestionIds);

			if (questionError) {
				console.error("Error fetching question details:", questionError);
				// Non-fatal — results still return, just without question detail
				// enrichment, same as the old code's per-row silent skip on error.
			} else {
				questions?.forEach((q) => {
					questionMap[q.id] = {
						id: q.id,
						number: q.question_number || "N/A",
						title: q.question_title,
						category: q.question_category,
					};
				});
			}
		}

		const enhancedResults = testResults.map((result) => {
			const withResult = (id: string | null, res: boolean | null) =>
				id && questionMap[id] ? { ...questionMap[id], result: res } : null;

			return {
				...result,
				questions: {
					q1: withResult(result.q1_id, result.q1_result),
					q2: withResult(result.q2_id, result.q2_result),
					q3: withResult(result.q3_id, result.q3_result),
					r1: withResult(result.r1_id, result.r1_result),
					r2: withResult(result.r2_id, result.r2_result),
				},
			};
		});

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

		// Check Oral Test permissions - need CONDUCT_TEST permission
		const permissions = await checkOralTestPermissions(
			request.headers.get("authorization")
		);

		if (!permissions.canConductTest) {
			console.log("Access denied: conduct_test permission required");
			return NextResponse.json(
				{ message: "Access denied: Permission to conduct tests required" },
				{ status: 403 }
			);
		}

		const resultData = await request.json();
		console.log("Creating test result with data:", {
			employee_id: resultData.employee_id,
			test_date: resultData.test_date,
			examiner: resultData.examiner_name,
			training_type: resultData.training_type,
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

		// training_type is not in the required list above — it's optional at
		// the API boundary and defaults to FAAT here (matching the DB column
		// default), so older client code that doesn't send it yet keeps working.
		const VALID_TRAINING_TYPES = [
			"FAAT",
			"FABT",
			"FALT",
			"FAPT",
			"FATT",
			"FAQT",
			"FAOT",
		];
		const trainingType =
			typeof resultData.training_type === "string" &&
			VALID_TRAINING_TYPES.includes(resultData.training_type)
				? resultData.training_type
				: "FAAT";

		// Create Supabase client
		const supabase = await createClient();

		// Prepare test result data
		const newTestResultData = {
			test_date: resultData.test_date,
			employee_id: resultData.employee_id,
			full_name: resultData.full_name.trim(),
			rank: resultData.rank.trim(),
			base: resultData.base.trim(),
			training_type: trainingType,
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
				{
					message: "Failed to create test result",
					error: insertError.message,
				},
				{ status: 500 }
			);
		}

		console.log("Test result created successfully:", createdResult.id);

		return NextResponse.json(
			{
				message: "Test result created successfully",
				result: createdResult,
			},
			{ status: 201 }
		);
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