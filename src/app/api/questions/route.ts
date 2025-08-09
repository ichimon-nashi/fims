// src/app/api/questions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";

export async function GET(request: NextRequest) {
	try {
		console.log("=== QUESTIONS API DEBUG ===");
		
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

		console.log("Verifying token...");
		const decoded = verifyToken(token);
		console.log("Token decoded successfully:", {
			userId: decoded.userId,
			authLevel: decoded.authLevel
		});

		if (decoded.authLevel < 4) {
			console.log("Insufficient permissions:", decoded.authLevel);
			return NextResponse.json(
				{ message: "Insufficient permissions" },
				{ status: 403 }
			);
		}

		console.log("Getting all questions...");
		const supabase = await createClient();
		const { data: questions, error } = await supabase
			.from("questions")
			.select("*")
			.order("question_number", { ascending: true, nullsFirst: false })
			.order("last_date_modified", { ascending: false });

		if (error) {
			console.error("Error fetching questions:", error);
			return NextResponse.json(
				{ message: "Failed to fetch questions", error: error.message },
				{ status: 500 }
			);
		}

		console.log("Questions retrieved successfully:", questions.length);

		// Hide difficulty level for lower auth levels
		if (decoded.authLevel < 10) {
			questions.forEach((question: any) => {
				delete question.difficulty_level;
			});
		}

		return NextResponse.json(questions);
	} catch (error: any) {
		console.error("Get questions error:", error);
		return NextResponse.json(
			{
				message: "Failed to get questions",
				error: error.message,
			},
			{ status: 500 }
		);
	}
}

export async function POST(request: NextRequest) {
	try {
		console.log("=== CREATE QUESTION API DEBUG ===");
		
		const token = extractTokenFromHeader(
			request.headers.get("authorization")
		);

		if (!token) {
			console.log("No token provided for question creation");
			return NextResponse.json(
				{ message: "No token provided" },
				{ status: 401 }
			);
		}

		const decoded = verifyToken(token);
		console.log("Token decoded successfully for question creation:", {
			userId: decoded.userId,
			authLevel: decoded.authLevel
		});

		if (decoded.authLevel < 4) {
			console.log("Insufficient permissions for question creation:", decoded.authLevel);
			return NextResponse.json(
				{ message: "Insufficient permissions" },
				{ status: 403 }
			);
		}

		const questionData = await request.json();
		console.log("Creating question with data:", {
			category: questionData.question_category,
			title: questionData.question_title?.substring(0, 50) + "...",
			chapter: questionData.question_chapter
		});

		// Validate required fields
		const required = [
			"question_category",
			"question_title",
			"question_chapter",
			"question_page",
			"question_line",
		];
		
		for (const field of required) {
			if (
				questionData[field] === undefined ||
				questionData[field] === null ||
				questionData[field] === ""
			) {
				console.log(`Missing required field: ${field}`);
				return NextResponse.json(
					{ message: `${field} is required` },
					{ status: 400 }
				);
			}
		}

		// Validate difficulty level
		const difficultyLevel = questionData.difficulty_level || 3;
		if (difficultyLevel < 1 || difficultyLevel > 5) {
			return NextResponse.json(
				{ message: "Difficulty level must be between 1 and 5" },
				{ status: 400 }
			);
		}

		// Validate page and line numbers
		if (questionData.question_page < 1) {
			return NextResponse.json(
				{ message: "Page number must be at least 1" },
				{ status: 400 }
			);
		}

		if (questionData.question_line < 1) {
			return NextResponse.json(
				{ message: "Line number must be at least 1" },
				{ status: 400 }
			);
		}

		// Create Supabase client
		const supabase = await createClient();

		// FIXED: Check for duplicate question title first
		console.log("Checking for duplicate question title...");
		const { data: existingQuestion, error: checkError } = await supabase
			.from("questions")
			.select("id")
			.eq("question_title", questionData.question_title.trim())
			.single();

		if (checkError && checkError.code !== 'PGRST116') {
			console.error("Error checking for duplicate question:", checkError);
			return NextResponse.json(
				{ message: "Failed to check for duplicate questions", error: checkError.message },
				{ status: 500 }
			);
		}

		if (existingQuestion) {
			console.log("Duplicate question title found");
			return NextResponse.json(
				{ message: "A question with this title already exists" },
				{ status: 409 }
			);
		}

		// FIXED: Get next question number
		console.log("Getting next question number...");
		const { data: maxQuestionData, error: maxError } = await supabase
			.from("questions")
			.select("question_number")
			.order("question_number", { ascending: false })
			.limit(1);

		let nextQuestionNumber = 1;
		if (maxError) {
			console.log("Error getting max question number, starting from 1:", maxError.message);
		} else if (maxQuestionData && maxQuestionData.length > 0 && maxQuestionData[0].question_number) {
			nextQuestionNumber = maxQuestionData[0].question_number + 1;
		}

		console.log("Using question number:", nextQuestionNumber);

		// Prepare question data
		const newQuestionData = {
			question_category: questionData.question_category.trim(),
			question_title: questionData.question_title.trim(),
			question_chapter: questionData.question_chapter.toString().trim(),
			question_page: parseInt(questionData.question_page),
			question_line: parseInt(questionData.question_line),
			difficulty_level: difficultyLevel,
			question_number: nextQuestionNumber,
			last_date_modified: new Date().toISOString(),
		};

		console.log("Inserting question into database...");
		const { data: createdQuestion, error: insertError } = await supabase
			.from("questions")
			.insert([newQuestionData])
			.select()
			.single();

		if (insertError) {
			console.error("Error inserting question:", insertError);
			
			// Handle specific constraint violations
			if (insertError.code === "23505") { // unique_violation
				if (insertError.message.includes("question_title")) {
					return NextResponse.json(
						{ message: "A question with this title already exists" },
						{ status: 409 }
					);
				} else if (insertError.message.includes("question_number")) {
					// If question number conflicts, try again with next number
					console.log("Question number conflict, retrying...");
					const retryQuestionNumber = nextQuestionNumber + 1;
					const retryData = {
						...newQuestionData,
						question_number: retryQuestionNumber,
					};
					
					const { data: retryResult, error: retryError } = await supabase
						.from("questions")
						.insert([retryData])
						.select()
						.single();
						
					if (retryError) {
						console.error("Retry insert failed:", retryError);
						return NextResponse.json(
							{ message: "Failed to create question", error: retryError.message },
							{ status: 500 }
						);
					}
					
					console.log("Question created successfully on retry:", retryResult.id);
					return NextResponse.json({
						message: "Question created successfully",
						question: retryResult
					}, { status: 201 });
				} else {
					return NextResponse.json(
						{ message: "This question information already exists in the system" },
						{ status: 409 }
					);
				}
			}
			
			return NextResponse.json(
				{ message: "Failed to create question", error: insertError.message },
				{ status: 500 }
			);
		}

		console.log("Question created successfully:", createdQuestion.id, "with number:", createdQuestion.question_number);

		return NextResponse.json({
			message: "Question created successfully",
			question: createdQuestion
		}, { status: 201 });

	} catch (error: any) {
		console.error("Create question API error:", error);
		
		return NextResponse.json(
			{
				message: "Internal server error during question creation",
				error: error.message,
			},
			{ status: 500 }
		);
	}
}