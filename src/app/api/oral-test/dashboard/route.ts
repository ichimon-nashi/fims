// src/app/api/oral-test/dashboard/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { checkOralTestPermissions } from "@/lib/oralTestPermissions";

export async function GET(request: NextRequest) {
	try {
		console.log("=== ORAL TEST DASHBOARD API DEBUG ===");

		// Check Oral Test permissions - need VIEW access
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

		const supabase = await createClient();
		const currentYear = new Date().getFullYear();

		// 1. Get total users (excluding admin), now including the fields
		// needed to display the remaining-users drill-down list
		console.log("Fetching users...");
		const { data: users, error: usersError } = await supabase
			.from("users")
			.select("id, employee_id, full_name, rank, base")
			.neq("employee_id", "admin")
			.eq("is_inactive", false);

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

		// 3. Get FAAT-only test results for current year. training_type filter
		// added here — without it, FABT/FAQT/etc. results were incorrectly
		// counting toward "tested for this year's recurrent training".
		console.log("Fetching FAAT test results for", currentYear);
		const { data: testResults, error: testResultsError } = await supabase
			.from("test_results")
			.select("*")
			.eq("training_type", "FAAT")
			.gte("test_date", `${currentYear}-01-01`)
			.lte("test_date", `${currentYear}-12-31`);

		if (testResultsError) {
			console.error("Error fetching test results:", testResultsError);
			throw testResultsError;
		}

		console.log("FAAT test results for current year:", testResults?.length || 0);

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

		// 4b. Build the actual remaining-users list (not just the count) —
		// active users not yet FAAT-tested this year, each with their most
		// recent FAAT test date from any prior year, so the instructor can
		// see how overdue someone is (or that they've never been tested).
		const remainingUsers =
			users?.filter((u) => !testedUserIds.has(u.employee_id)) || [];
		const remainingEmployeeIds = remainingUsers.map((u) => u.employee_id);

		let lastFaatDateByEmployee: Record<string, string> = {};

		if (remainingEmployeeIds.length > 0) {
			console.log(
				"Fetching historical FAAT dates for",
				remainingEmployeeIds.length,
				"remaining users"
			);

			const { data: historicalFaat, error: historicalFaatError } =
				await supabase
					.from("test_results")
					.select("employee_id, test_date")
					.eq("training_type", "FAAT")
					.in("employee_id", remainingEmployeeIds)
					.order("test_date", { ascending: false });

			if (historicalFaatError) {
				console.error(
					"Error fetching historical FAAT dates:",
					historicalFaatError
				);
				// Non-fatal — the drill-down list still works, just without
				// last-tested dates. Don't fail the whole dashboard over it.
			} else if (historicalFaat) {
				// Results are ordered newest-first, so the first occurrence
				// per employee_id is their most recent FAAT test date.
				for (const row of historicalFaat) {
					if (!lastFaatDateByEmployee[row.employee_id]) {
						lastFaatDateByEmployee[row.employee_id] = row.test_date;
					}
				}
			}
		}

		// Sort so the most overdue (never tested, then oldest test date)
		// appear first — that's the information an instructor needs fastest.
		const remainingUsersList = remainingUsers
			.map((u) => ({
				employee_id: u.employee_id,
				full_name: u.full_name,
				rank: u.rank,
				base: u.base,
				lastFaatTestDate: lastFaatDateByEmployee[u.employee_id] || null,
			}))
			.sort((a, b) => {
				if (!a.lastFaatTestDate && !b.lastFaatTestDate) return 0;
				if (!a.lastFaatTestDate) return -1;
				if (!b.lastFaatTestDate) return 1;
				return (
					new Date(a.lastFaatTestDate).getTime() -
					new Date(b.lastFaatTestDate).getTime()
				);
			});

		console.log("Remaining users list built:", remainingUsersList.length);

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
				remainingUsersList: remainingUsersList,
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