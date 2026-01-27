// src/app/api/questions/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { checkOralTestPermissions } from "@/lib/oralTestPermissions";

export async function GET(request: NextRequest) {
	try {
		console.log("=== QUESTIONS API DEBUG ===");
		
		// Check Oral Test permissions - need MANAGE_QUESTIONS permission to view all questions
		const permissions = await checkOralTestPermissions(
			request.headers.get("authorization")
		);

		if (!permissions.canManageQuestions) {
			console.log("Access denied: manage_questions permission required");
			return NextResponse.json(
				{ message: "Access denied: Permission to manage questions required" },
				{ status: 403 }
			);
		}

		console.log("User has manage_questions permission:", permissions.userId);
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

		// Note: difficulty_level is always included for users with manage_questions permission

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
		
		// Check Oral Test permissions - need MANAGE_QUESTIONS permission to create questions
		const permissions = await checkOralTestPermissions(
			request.headers.get("authorization")
		);

		if (!permissions.canManageQuestions) {
			console.log("Access denied: manage_questions permission required for creation");
			return NextResponse.json(
				{ message: "Access denied: Permission to manage questions required" },
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

		// Validate page number
		if (questionData.question_page < 1) {
			return NextResponse.json(
				{ message: "Page number must be at least 1" },
				{ status: 400 }
			);
		}

		// Validate line reference
		if (!questionData.question_line || questionData.question_line.toString().trim() === "") {
			return NextResponse.json(
				{ message: "Line reference is required and cannot be empty" },
				{ status: 400 }
			);
		}

		const supabase = await createClient();

		// Check for duplicate question title
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

		// Get next question number
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
			question_line: questionData.question_line.toString().trim(),
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
			
			if (insertError.code === "23505") {
				if (insertError.message.includes("question_title")) {
					return NextResponse.json(
						{ message: "A question with this title already exists" },
						{ status: 409 }
					);
				} else if (insertError.message.includes("question_number")) {
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