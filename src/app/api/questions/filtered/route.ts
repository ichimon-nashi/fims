// src/app/api/questions/filtered/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { checkOralTestPermissions } from "@/lib/oralTestPermissions";

export async function POST(request: NextRequest) {
	try {
		console.log("=== FILTERED QUESTIONS API DEBUG ===");
		
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

		console.log("User has conduct_test permission:", permissions.userId);

		const requestBody = await request.json();
		console.log("Request body:", requestBody);
		
		const { filters, handicapLevel } = requestBody;

		// Validate handicap level
		const validHandicapLevel =
			handicapLevel && handicapLevel >= 1 && handicapLevel <= 5
				? handicapLevel
				: 3;

		console.log("Using handicap level:", validHandicapLevel);
		console.log("Filters to exclude:", filters);

		const supabase = await createClient();
		
		let query = supabase
			.from("questions")
			.select("*");

		// Apply category filters
		if (filters && Array.isArray(filters) && filters.length > 0) {
			console.log("Applying category filters, excluding:", filters);
			query = query.not("question_category", "in", `(${filters.join(",")})`);
		}

		// Apply handicap level filtering
		if (validHandicapLevel === 1) {
			console.log("Handicap 1: Filtering for hardest questions (difficulty 4-5)");
			query = query.gte("difficulty_level", 4);
		} else if (validHandicapLevel === 2) {
			console.log("Handicap 2: Filtering for hard questions (difficulty 3-5)");
			query = query.gte("difficulty_level", 3);
		} else if (validHandicapLevel === 4) {
			console.log("Handicap 4: Filtering for easy questions (difficulty 1-3)");
			query = query.lte("difficulty_level", 3);
		} else if (validHandicapLevel === 5) {
			console.log("Handicap 5: Filtering for easiest questions (difficulty 1-2)");
			query = query.lte("difficulty_level", 2);
		}

		query = query
			.order("question_category")
			.order("question_chapter")
			.order("question_page");

		console.log("Executing Supabase query...");
		const { data: questions, error } = await query;

		if (error) {
			console.error("Supabase query error:", error);
			return NextResponse.json(
				{ message: "Failed to fetch questions", error: error.message },
				{ status: 500 }
			);
		}

		console.log("Questions fetched successfully:", questions?.length || 0);

		if (!questions || questions.length === 0) {
			console.log("No questions found with current filters");
			return NextResponse.json({
				message: "No questions available with current filters",
				availableQuestions: 0,
				handicapLevel: validHandicapLevel,
				excludedCategories: filters || []
			}, { status: 404 });
		}

		// Apply probabilistic selection for handicap levels 2 and 4
		let finalQuestions = questions;

		if (validHandicapLevel === 2) {
			console.log("Applying probabilistic selection for handicap 2");
			const hardQuestions = questions.filter(q => q.difficulty_level >= 4);
			const mediumQuestions = questions.filter(q => q.difficulty_level === 3);
			
			const selectedQuestions = [];
			const targetCount = Math.min(questions.length, 50);
			
			for (let i = 0; i < targetCount; i++) {
				if (Math.random() < 0.75 && hardQuestions.length > 0) {
					const randomIndex = Math.floor(Math.random() * hardQuestions.length);
					selectedQuestions.push(hardQuestions[randomIndex]);
				} else if (mediumQuestions.length > 0) {
					const randomIndex = Math.floor(Math.random() * mediumQuestions.length);
					selectedQuestions.push(mediumQuestions[randomIndex]);
				} else if (hardQuestions.length > 0) {
					const randomIndex = Math.floor(Math.random() * hardQuestions.length);
					selectedQuestions.push(hardQuestions[randomIndex]);
				}
			}
			
			finalQuestions = selectedQuestions.length > 0 ? selectedQuestions : questions;
			console.log(`Handicap 2: Selected ${finalQuestions.length} questions`);
			
		} else if (validHandicapLevel === 4) {
			console.log("Applying probabilistic selection for handicap 4");
			const easyQuestions = questions.filter(q => q.difficulty_level <= 2);
			const mediumQuestions = questions.filter(q => q.difficulty_level === 3);
			
			const selectedQuestions = [];
			const targetCount = Math.min(questions.length, 50);
			
			for (let i = 0; i < targetCount; i++) {
				if (Math.random() < 0.75 && easyQuestions.length > 0) {
					const randomIndex = Math.floor(Math.random() * easyQuestions.length);
					selectedQuestions.push(easyQuestions[randomIndex]);
				} else if (mediumQuestions.length > 0) {
					const randomIndex = Math.floor(Math.random() * mediumQuestions.length);
					selectedQuestions.push(mediumQuestions[randomIndex]);
				} else if (easyQuestions.length > 0) {
					const randomIndex = Math.floor(Math.random() * easyQuestions.length);
					selectedQuestions.push(easyQuestions[randomIndex]);
				}
			}
			
			finalQuestions = selectedQuestions.length > 0 ? selectedQuestions : questions;
			console.log(`Handicap 4: Selected ${finalQuestions.length} questions`);
		}

		// Remove duplicates
		const uniqueQuestions = finalQuestions.filter((question, index, array) => 
			array.findIndex(q => q.id === question.id) === index
		);

		console.log("Final question count after deduplication:", uniqueQuestions.length);

		if (uniqueQuestions.length < 5) {
			console.log("Not enough questions available:", uniqueQuestions.length);
			return NextResponse.json({
				message: `Not enough questions available. Found ${uniqueQuestions.length} questions, need at least 5.`,
				availableQuestions: uniqueQuestions.length,
				handicapLevel: validHandicapLevel,
				excludedCategories: filters || [],
				suggestion: "Try reducing excluded categories or adjusting handicap level"
			}, { status: 404 });
		}

		// Remove difficulty level from response (security)
		const sanitizedQuestions = uniqueQuestions.map((question: any) => {
			const { difficulty_level, ...questionWithoutDifficulty } = question;
			return questionWithoutDifficulty;
		});

		console.log("Returning sanitized questions:", sanitizedQuestions.length);

		return NextResponse.json(sanitizedQuestions);

	} catch (error: any) {
		console.error("Get filtered questions error:", error);
		return NextResponse.json(
			{ 
				message: "Internal server error",
				error: error.message
			},
			{ status: 500 }
		);
	}
}