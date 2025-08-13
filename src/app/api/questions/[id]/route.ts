// src/app/api/questions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { verifyToken, extractTokenFromHeader } from "@/lib/auth";

interface RouteParams {
	params: Promise<{ id: string }>;
}

export async function PUT(
	request: NextRequest,
	{ params }: RouteParams
) {
	try {
		console.log("=== UPDATE QUESTION API DEBUG ===");
		
		const token = extractTokenFromHeader(
			request.headers.get("authorization")
		);

		if (!token) {
			console.log("No token provided for update");
			return NextResponse.json(
				{ message: "No token provided" },
				{ status: 401 }
			);
		}

		const decoded = verifyToken(token);
		console.log("Token decoded successfully for question update:", {
			userId: decoded.userId,
			authLevel: decoded.authLevel
		});

		if (decoded.authLevel < 4) {
			console.log("Insufficient permissions for update:", decoded.authLevel);
			return NextResponse.json(
				{ message: "Insufficient permissions" },
				{ status: 403 }
			);
		}

		const { id } = await params;
		const updateData = await request.json();
		
		console.log("Updating question:", id, "with data:", {
			category: updateData.question_category,
			title: updateData.question_title?.substring(0, 50) + "...",
			chapter: updateData.question_chapter
		});

		// Remove fields that shouldn't be updated directly
		delete updateData.id;
		delete updateData.question_number; // Don't allow changing question number
		delete updateData.last_date_modified; // This will be set automatically

		// Validate difficulty level if provided
		if (
			updateData.difficulty_level &&
			(updateData.difficulty_level < 1 || updateData.difficulty_level > 5)
		) {
			return NextResponse.json(
				{ message: "Difficulty level must be between 1 and 5" },
				{ status: 400 }
			);
		}

		// Validate page and line numbers if provided
		if (updateData.question_page && updateData.question_page < 1) {
			return NextResponse.json(
				{ message: "Page number must be at least 1" },
				{ status: 400 }
			);
		}

		if (updateData.question_line && updateData.question_line < 1) {
			return NextResponse.json(
				{ message: "Line number must be at least 1" },
				{ status: 400 }
			);
		}

		// Trim string fields
		if (updateData.question_category) {
			updateData.question_category = updateData.question_category.trim();
		}
		if (updateData.question_title) {
			updateData.question_title = updateData.question_title.trim();
		}
		if (updateData.question_chapter) {
			updateData.question_chapter = updateData.question_chapter.trim();
		}

		// Convert numeric fields
		if (updateData.question_page) {
			updateData.question_page = parseInt(updateData.question_page);
		}
		if (updateData.question_line) {
			updateData.question_line = parseInt(updateData.question_line);
		}

		// Create Supabase client
		const supabase = await createClient();
		
		// Check for duplicate title if updating title
		if (updateData.question_title) {
			console.log("Checking for duplicate question title...");
			const { data: existingQuestion, error: checkError } = await supabase
				.from("questions")
				.select("id")
				.eq("question_title", updateData.question_title)
				.neq("id", id)
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
		}
		
		const updatePayload = {
			...updateData,
			last_date_modified: new Date().toISOString(),
		};
		
		console.log("Executing Supabase update...");
		const { data: updatedQuestion, error } = await supabase
			.from("questions")
			.update(updatePayload)
			.eq("id", id)
			.select()
			.single();

		if (error) {
			console.error("Error updating question:", error);
			
			if (error.code === "23505" && error.message.includes("question_title")) {
				return NextResponse.json(
					{ message: "A question with this title already exists" },
					{ status: 409 }
				);
			}
			
			if (error.code === "PGRST116") {
				return NextResponse.json(
					{ message: "Question not found" },
					{ status: 404 }
				);
			}
			
			return NextResponse.json(
				{ message: "Failed to update question", error: error.message },
				{ status: 500 }
			);
		}
		
		console.log("Question updated successfully:", updatedQuestion.id);

		return NextResponse.json(updatedQuestion);
	} catch (error: any) {
		console.error("Update question API error:", error);
		
		return NextResponse.json(
			{
				message: "Internal server error during update",
				error: error.message,
			},
			{ status: 500 }
		);
	}
}

export async function DELETE(
	request: NextRequest,
	{ params }: RouteParams
) {
	try {
		console.log("=== DELETE QUESTION API DEBUG ===");
		console.log("DELETE request received");
		
		// Step 1: Get the ID
		const { id } = await params;
		console.log("Question ID to delete:", id);
		
		// Step 2: Check authentication header
		const authHeader = request.headers.get("authorization");
		console.log("Auth header present:", !!authHeader);
		
		if (!authHeader) {
			console.log("No authorization header found");
			return NextResponse.json(
				{ message: "No authorization header provided" },
				{ status: 401 }
			);
		}
		
		// Step 3: Extract token
		const token = extractTokenFromHeader(authHeader);
		console.log("Token extracted successfully:", !!token);
		
		if (!token) {
			console.log("Failed to extract token from header");
			return NextResponse.json(
				{ message: "No valid token found in authorization header" },
				{ status: 401 }
			);
		}
		
		// Step 4: Verify token
		let decoded;
		try {
			decoded = verifyToken(token);
			console.log("Token verified successfully, auth level:", decoded.authLevel);
		} catch (authError) {
			console.error("Token verification failed:", authError);
			return NextResponse.json(
				{ 
					message: "Invalid or expired token",
					error: authError instanceof Error ? authError.message : "Unknown auth error"
				},
				{ status: 401 }
			);
		}
		
		// Step 5: Check permissions
		if (decoded.authLevel < 4) {
			console.log("Insufficient permissions for delete:", decoded.authLevel);
			return NextResponse.json(
				{ message: "Insufficient permissions. Level 4+ required for question management." },
				{ status: 403 }
			);
		}
		
		// Step 6: Create Supabase client
		let supabase;
		try {
			supabase = await createClient();
			console.log("Supabase client created successfully");
		} catch (clientError) {
			console.error("Failed to create Supabase client:", clientError);
			return NextResponse.json(
				{ 
					message: "Database connection failed",
					error: clientError instanceof Error ? clientError.message : "Unknown client error"
				},
				{ status: 500 }
			);
		}
		
		// Step 7: Check if question exists
		console.log("Checking if question exists in database...");
		let existingQuestion;
		try {
			const { data, error: checkError } = await supabase
				.from("questions")
				.select("id, question_title, question_number")
				.eq("id", id)
				.single();
				
			if (checkError) {
				if (checkError.code === 'PGRST116') {
					console.log("Question not found in database");
					return NextResponse.json(
						{ message: "Question not found" },
						{ status: 404 }
					);
				}
				console.error("Error checking question existence:", checkError);
				throw checkError;
			}
			
			existingQuestion = data;
			console.log("Question found:", {
				id: existingQuestion.id,
				title: existingQuestion.question_title?.substring(0, 50) + "...",
				number: existingQuestion.question_number
			});
		} catch (checkError) {
			console.error("Error during question existence check:", checkError);
			return NextResponse.json(
				{ 
					message: "Failed to verify question existence",
					error: checkError instanceof Error ? checkError.message : "Unknown check error"
				},
				{ status: 500 }
			);
		}
		
		// Step 8: Check for foreign key relationships first
		console.log("Step 8: Checking for related test results...");
		let relatedResults;
		try {
			const { data: testResults, error: fkError } = await supabase
				.from("test_results")
				.select("id, user_id, test_date")
				.or(`q1_id.eq.${id},q2_id.eq.${id},q3_id.eq.${id},q4_id.eq.${id},q5_id.eq.${id}`)
				.limit(10);
				
			if (fkError) {
				console.error("Error checking for related records:", fkError);
				// Continue anyway, let the delete operation handle it
			} else {
				relatedResults = testResults;
				console.log("Found related test results:", testResults?.length || 0);
				
				if (testResults && testResults.length > 0) {
					console.log("Question is referenced in test results, deletion will fail");
					return NextResponse.json(
						{ 
							message: `Cannot delete question. It is referenced in ${testResults.length} test result(s).`,
							details: "This question has been used in tests. To delete it, you must first remove all related test results or contact your administrator.",
							relatedRecords: testResults.length,
							action: "deletion_blocked"
						},
						{ status: 409 } // Conflict status
					);
				}
			}
		} catch (fkCheckError) {
			console.error("Error during foreign key check:", fkCheckError);
			// Continue with deletion attempt
		}
		
		// Step 9: Attempt deletion (only if no foreign key conflicts)
		console.log("Step 9: Attempting to delete question from database...");
		try {
			const { error: deleteError } = await supabase
				.from("questions")
				.delete()
				.eq("id", id);
				
			if (deleteError) {
				console.error("Supabase delete operation failed:", deleteError);
				
				// Handle foreign key constraint errors specifically
				if (deleteError.code === "23503") {
					return NextResponse.json(
						{ 
							message: "Cannot delete question - it is referenced in test results",
							details: "This question has been used in tests and cannot be deleted to preserve data integrity. Contact your administrator if you need to remove this question.",
							error: deleteError.message,
							code: deleteError.code,
							action: "foreign_key_violation"
						},
						{ status: 409 }
					);
				}
				
				return NextResponse.json(
					{ 
						message: "Failed to delete question from database",
						error: deleteError.message,
						code: deleteError.code
					},
					{ status: 500 }
				);
			}
			
			console.log("Question deleted successfully from database");
			
			return NextResponse.json({ 
				message: "Question deleted successfully",
				deletedId: id,
				questionNumber: existingQuestion.question_number,
				title: existingQuestion.question_title?.substring(0, 50) + "..."
			});
			
		} catch (deleteError) {
			console.error("Unexpected error during deletion:", deleteError);
			return NextResponse.json(
				{ 
					message: "Unexpected error during deletion",
					error: deleteError instanceof Error ? deleteError.message : "Unknown delete error"
				},
				{ status: 500 }
			);
		}
		
	} catch (outerError) {
		console.error("Unexpected error in DELETE route:", outerError);
		return NextResponse.json(
			{
				message: "Unexpected server error",
				error: outerError instanceof Error ? outerError.message : "Unknown outer error",
				stack: process.env.NODE_ENV === 'development' ? (outerError instanceof Error ? outerError.stack : undefined) : undefined
			},
			{ status: 500 }
		);
	}
}