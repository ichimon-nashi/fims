// src/app/api/questions/[id]/route.ts
import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
import { checkOralTestPermissions } from "@/lib/oralTestPermissions";

interface RouteParams {
	params: Promise<{ id: string }>;
}

export async function PUT(
	request: NextRequest,
	{ params }: RouteParams
) {
	try {
		console.log("=== UPDATE QUESTION API DEBUG ===");
		
		// Check Oral Test permissions - need MANAGE_QUESTIONS permission
		const permissions = await checkOralTestPermissions(
			request.headers.get("authorization")
		);

		if (!permissions.canManageQuestions) {
			console.log("Access denied: manage_questions permission required for update");
			return NextResponse.json(
				{ message: "Access denied: Permission to manage questions required" },
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
		delete updateData.question_number;
		delete updateData.last_date_modified;

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

		// Validate page number if provided
		if (updateData.question_page && updateData.question_page < 1) {
			return NextResponse.json(
				{ message: "Page number must be at least 1" },
				{ status: 400 }
			);
		}

		// Validate line reference if provided
		if (updateData.question_line !== undefined && updateData.question_line !== null) {
			const lineStr = updateData.question_line.toString().trim();
			if (lineStr === "") {
				return NextResponse.json(
					{ message: "Line reference cannot be empty" },
					{ status: 400 }
				);
			}
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

		// Convert numeric fields and handle line as string
		if (updateData.question_page) {
			updateData.question_page = parseInt(updateData.question_page);
		}
		if (updateData.question_line !== undefined) {
			updateData.question_line = updateData.question_line.toString().trim();
		}

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
		
		// Check Oral Test permissions - need MANAGE_QUESTIONS permission
		const permissions = await checkOralTestPermissions(
			request.headers.get("authorization")
		);

		if (!permissions.canManageQuestions) {
			console.log("Access denied: manage_questions permission required for deletion");
			return NextResponse.json(
				{ message: "Access denied: Permission to manage questions required" },
				{ status: 403 }
			);
		}

		const { id } = await params;
		console.log("Question ID to delete:", id);
		
		const supabase = await createClient();
		
		// Check if question exists
		console.log("Checking if question exists...");
		const { data: existingQuestion, error: checkError } = await supabase
			.from("questions")
			.select("id, question_title, question_number")
			.eq("id", id)
			.single();
			
		if (checkError) {
			if (checkError.code === 'PGRST116') {
				console.log("Question not found");
				return NextResponse.json(
					{ message: "Question not found" },
					{ status: 404 }
				);
			}
			console.error("Error checking question existence:", checkError);
			return NextResponse.json(
				{ message: "Failed to verify question existence", error: checkError.message },
				{ status: 500 }
			);
		}
		
		console.log("Question found:", existingQuestion.question_title?.substring(0, 50));
		
		// Check for related test results
		console.log("Checking for related test results...");
		const { data: testResults, error: fkError } = await supabase
			.from("test_results")
			.select("id")
			.or(`q1_id.eq.${id},q2_id.eq.${id},q3_id.eq.${id},r1_id.eq.${id},r2_id.eq.${id}`)
			.limit(1);
			
		if (!fkError && testResults && testResults.length > 0) {
			console.log("Question is referenced in test results");
			return NextResponse.json(
				{ 
					message: "Cannot delete question - it is referenced in test results",
					details: "This question has been used in tests and cannot be deleted to preserve data integrity.",
					action: "deletion_blocked"
				},
				{ status: 409 }
			);
		}
		
		// Attempt deletion
		console.log("Attempting deletion...");
		const { error: deleteError } = await supabase
			.from("questions")
			.delete()
			.eq("id", id);
			
		if (deleteError) {
			console.error("Delete operation failed:", deleteError);
			
			if (deleteError.code === "23503") {
				return NextResponse.json(
					{ 
						message: "Cannot delete question - it is referenced in test results",
						error: deleteError.message,
						action: "foreign_key_violation"
					},
					{ status: 409 }
				);
			}
			
			return NextResponse.json(
				{ message: "Failed to delete question", error: deleteError.message },
				{ status: 500 }
			);
		}
		
		console.log("Question deleted successfully");
		
		return NextResponse.json({ 
			message: "Question deleted successfully",
			deletedId: id,
			questionNumber: existingQuestion.question_number
		});
		
	} catch (error: any) {
		console.error("Delete question error:", error);
		return NextResponse.json(
			{ message: "Unexpected server error", error: error.message },
			{ status: 500 }
		);
	}
}