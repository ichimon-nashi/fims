// src/app/api/oral-test/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";

export async function GET(request: NextRequest) {
	try {
		console.log("=== ORAL TEST DASHBOARD API DEBUG ===");

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
			authLevel: decoded.authLevel,
		});

		if (decoded.authLevel < 1) {
			console.log("Insufficient permissions:", decoded.authLevel);
			return NextResponse.json(
				{ message: "Insufficient permissions" },
				{ status: 403 }
			);
		}

		const supabase = await createClient();
		const currentYear = new Date().getFullYear();

		// 1. Get total users (excluding admin)
		console.log("Fetching users...");
		const { data: users, error: usersError } = await supabase
			.from("users")
			.select("id, employee_id")
			.neq("employee_id", "admin");

		if (usersError) {
			console.error("Error fetching users:", usersError);
			throw usersError;
		}

		const totalUsers = users?.length || 0;
		console.log("Total users (excluding admin):", totalUsers);

		// 2. Get total questions
		console.log("Fetching questions...");
		const { data: questions, error: questionsError } = await supabase
			.from("questions")
			.select("id, question_category");

		if (questionsError) {
			console.error("Error fetching questions:", questionsError);
			throw questionsError;
		}

		const totalQuestions = questions?.length || 0;
		console.log("Total questions:", totalQuestions);

		// 3. Get test results for current year
		console.log("Fetching test results for", currentYear);
		const { data: testResults, error: testResultsError } = await supabase
			.from("test_results")
			.select("*")
			.gte("test_date", `${currentYear}-01-01`)
			.lte("test_date", `${currentYear}-12-31`);

		if (testResultsError) {
			console.error("Error fetching test results:", testResultsError);
			throw testResultsError;
		}

		console.log("Test results for current year:", testResults?.length || 0);

		// 4. Calculate testing progress
		const testedUserIds = new Set(
			testResults?.map((result) => result.employee_id) || []
		);

		// Remove admin from tested users if present
		testedUserIds.delete("admin");

		const currentYearTested = testedUserIds.size;
		const currentYearRemaining = Math.max(
			0,
			totalUsers - currentYearTested
		);

		console.log("Testing progress:", {
			totalUsers,
			currentYearTested,
			currentYearRemaining,
		});

		// 5. Get top incorrect questions
		console.log("Calculating top incorrect questions...");
		const incorrectQuestions: Record<string, number> = {};

		testResults?.forEach((result) => {
			// Check each question result
			const questionResults = [
				{ id: result.q1_id, result: result.q1_result },
				{ id: result.q2_id, result: result.q2_result },
				{ id: result.q3_id, result: result.q3_result },
				{ id: result.r1_id, result: result.r1_result },
				{ id: result.r2_id, result: result.r2_result },
			];

			questionResults.forEach(({ id, result: questionResult }) => {
				if (id && questionResult === false) {
					// Only count incorrect answers
					incorrectQuestions[id] = (incorrectQuestions[id] || 0) + 1;
				}
			});
		});

		// Get question details for top incorrect questions
		const sortedIncorrectQuestions = Object.entries(incorrectQuestions)
			.sort(([, a], [, b]) => b - a)
			.slice(0, 5); // Top 5

		const topIncorrectQuestions = [];

		for (const [questionId, count] of sortedIncorrectQuestions) {
			const { data: questionData, error: questionError } = await supabase
				.from("questions")
				.select("question_number, question_title, question_category")
				.eq("id", questionId)
				.single();

			if (!questionError && questionData) {
				topIncorrectQuestions.push({
					question: questionData.question_title,
					question_number: questionData.question_number,
					category: questionData.question_category,
					count: count,
				});
			}
		}

		console.log("Top incorrect questions:", topIncorrectQuestions.length);

		// 6. Get examiner statistics
		console.log("Calculating examiner statistics...");
		const examinerStats: Record<string, number> = {};

		testResults?.forEach((result) => {
			const examiner = result.examiner_name;
			if (examiner) {
				examinerStats[examiner] = (examinerStats[examiner] || 0) + 1;
			}
		});

		const sortedExaminerStats = Object.entries(examinerStats)
			.map(([examiner, count]) => ({ examiner, count }))
			.sort((a, b) => b.count - a.count)
			.slice(0, 5); // Top 5 examiners

		console.log("Examiner statistics:", sortedExaminerStats.length);

		// 7. Get questions by category
		console.log("Calculating questions by category...");
		const questionsByCategory: Record<string, number> = {};

		questions?.forEach((question) => {
			const category = question.question_category;
			if (category) {
				questionsByCategory[category] =
					(questionsByCategory[category] || 0) + 1;
			}
		});

		const sortedQuestionsByCategory = Object.entries(questionsByCategory)
			.map(([category, count]) => ({ category, count }))
			.sort((a, b) => b.count - a.count);

		console.log("Questions by category:", sortedQuestionsByCategory.length);

		// Prepare response data
		const dashboardData = {
			topIncorrectQuestions,
			examineeTesting: {
				tested: currentYearTested,
				remaining: currentYearRemaining,
				total: totalUsers,
				totalUsers: totalUsers,
				currentYearTested: currentYearTested,
				currentYearRemaining: currentYearRemaining,
			},
			examinerStats: sortedExaminerStats,
			questionsByCategory: sortedQuestionsByCategory,
			totalQuestions: totalQuestions,
			currentYear: currentYear,
		};

		console.log("Dashboard data prepared successfully");
		return NextResponse.json(dashboardData);
	} catch (error: any) {
		console.error("Dashboard API error:", error);
		return NextResponse.json(
			{
				message: "Failed to get dashboard data",
				error: error.message,
			},
			{ status: 500 }
		);
	}
}
