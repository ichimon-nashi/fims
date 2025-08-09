// src/app/api/questions/filtered/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";

export async function POST(request: NextRequest) {
	try {
		console.log("=== FILTERED QUESTIONS API DEBUG ===");
		
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

		console.log("Token found, verifying...");
		const decoded = verifyToken(token);
		console.log("Token decoded, auth level:", decoded.authLevel);

		if (decoded.authLevel < 3) {
			console.log("Insufficient permissions:", decoded.authLevel);
			return NextResponse.json(
				{ message: "Insufficient permissions" },
				{ status: 403 }
			);
		}

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

		// Create Supabase client and build query
		const supabase = await createClient();
		
		let query = supabase
			.from("questions")
			.select("*");

		// Apply category filters (exclude categories in the filter array)
		if (filters && Array.isArray(filters) && filters.length > 0) {
			console.log("Applying category filters, excluding:", filters);
			query = query.not("question_category", "in", `(${filters.join(",")})`);
		}

		// FIXED: Apply handicap level to difficulty filtering with proper probability distribution
		// Handicap 1 = Only hardest questions (difficulty 4-5)
		// Handicap 2 = Hard questions (75% from 4-5, 25% from 3-5) 
		// Handicap 3 = Mixed questions (all difficulty levels 1-5)
		// Handicap 4 = Easy questions (75% from 1-3, 25% from 1-4)
		// Handicap 5 = Only easiest questions (difficulty 1-2)

		if (validHandicapLevel === 1) {
			// Hardest questions only (difficulty 4-5)
			console.log("Handicap 1: Filtering for hardest questions (difficulty 4-5)");
			query = query.gte("difficulty_level", 4);
		} else if (validHandicapLevel === 2) {
			// Hard questions (difficulty 3-5, but prefer 4-5)
			console.log("Handicap 2: Filtering for hard questions (difficulty 3-5)");
			query = query.gte("difficulty_level", 3);
		} else if (validHandicapLevel === 4) {
			// Easy questions (difficulty 1-3)
			console.log("Handicap 4: Filtering for easy questions (difficulty 1-3)");
			query = query.lte("difficulty_level", 3);
		} else if (validHandicapLevel === 5) {
			// Easiest questions only (difficulty 1-2)
			console.log("Handicap 5: Filtering for easiest questions (difficulty 1-2)");
			query = query.lte("difficulty_level", 2);
		}
		// For handicap level 3, we don't filter by difficulty (all questions)

		// Order questions consistently
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

		// FIXED: Apply probabilistic selection for handicap levels 2 and 4
		let finalQuestions = questions;

		if (validHandicapLevel === 2) {
			// Handicap 2: 75% chance for difficulty 4-5, 25% chance for difficulty 3
			console.log("Applying probabilistic selection for handicap 2");
			const hardQuestions = questions.filter(q => q.difficulty_level >= 4);
			const mediumQuestions = questions.filter(q => q.difficulty_level === 3);
			
			const selectedQuestions = [];
			const targetCount = Math.min(questions.length, 50); // Limit for performance
			
			for (let i = 0; i < targetCount; i++) {
				if (Math.random() < 0.75 && hardQuestions.length > 0) {
					// 75% chance: pick from hard questions
					const randomIndex = Math.floor(Math.random() * hardQuestions.length);
					selectedQuestions.push(hardQuestions[randomIndex]);
				} else if (mediumQuestions.length > 0) {
					// 25% chance: pick from medium questions
					const randomIndex = Math.floor(Math.random() * mediumQuestions.length);
					selectedQuestions.push(mediumQuestions[randomIndex]);
				} else if (hardQuestions.length > 0) {
					// Fallback to hard questions
					const randomIndex = Math.floor(Math.random() * hardQuestions.length);
					selectedQuestions.push(hardQuestions[randomIndex]);
				}
			}
			
			finalQuestions = selectedQuestions.length > 0 ? selectedQuestions : questions;
			console.log(`Handicap 2: Selected ${finalQuestions.length} questions with probability weighting`);
			
		} else if (validHandicapLevel === 4) {
			// Handicap 4: 75% chance for difficulty 1-2, 25% chance for difficulty 3
			console.log("Applying probabilistic selection for handicap 4");
			const easyQuestions = questions.filter(q => q.difficulty_level <= 2);
			const mediumQuestions = questions.filter(q => q.difficulty_level === 3);
			
			const selectedQuestions = [];
			const targetCount = Math.min(questions.length, 50); // Limit for performance
			
			for (let i = 0; i < targetCount; i++) {
				if (Math.random() < 0.75 && easyQuestions.length > 0) {
					// 75% chance: pick from easy questions
					const randomIndex = Math.floor(Math.random() * easyQuestions.length);
					selectedQuestions.push(easyQuestions[randomIndex]);
				} else if (mediumQuestions.length > 0) {
					// 25% chance: pick from medium questions
					const randomIndex = Math.floor(Math.random() * mediumQuestions.length);
					selectedQuestions.push(mediumQuestions[randomIndex]);
				} else if (easyQuestions.length > 0) {
					// Fallback to easy questions
					const randomIndex = Math.floor(Math.random() * easyQuestions.length);
					selectedQuestions.push(easyQuestions[randomIndex]);
				}
			}
			
			finalQuestions = selectedQuestions.length > 0 ? selectedQuestions : questions;
			console.log(`Handicap 4: Selected ${finalQuestions.length} questions with probability weighting`);
		}

		// Remove duplicates that might have been introduced by probabilistic selection
		const uniqueQuestions = finalQuestions.filter((question, index, array) => 
			array.findIndex(q => q.id === question.id) === index
		);

		console.log("Final question count after deduplication:", uniqueQuestions.length);

		// Check if we have enough questions (minimum 5 for a test)
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

		// Remove difficulty level from response for security (unless high auth level)
		const sanitizedQuestions = uniqueQuestions.map((question: any) => {
			if (decoded.authLevel < 10) {
				const { difficulty_level, ...questionWithoutDifficulty } = question;
				return questionWithoutDifficulty;
			}
			return question;
		});

		console.log("Returning sanitized questions:", sanitizedQuestions.length);
		console.log("Difficulty distribution:", {
			handicapLevel: validHandicapLevel,
			sampleDifficulties: uniqueQuestions.slice(0, 10).map(q => q.difficulty_level)
		});

		return NextResponse.json(sanitizedQuestions);

	} catch (error: any) {
		console.error("Get filtered questions error:", error);
		console.error("Error stack:", error.stack);
		return NextResponse.json(
			{ 
				message: "Internal server error",
				error: error.message,
				debug: error.stack
			},
			{ status: 500 }
		);
	}
}