// src/components/test/TestInterface/TestInterface.tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import { User, Question, TestSession, QuestionAttempt } from "@/lib/types";
import Timer from "@/components/ui/Timer/Timer";
import ExamineeInfo from "../ExamineeInfo/ExamineeInfo";
import styles from "./TestInterface.module.css";

const TestInterface = () => {
	const { user: examiner } = useAuth();
	const [examineeId, setExamineeId] = useState("");
	const [examinee, setExaminee] = useState<User | null>(null);
	const [testSession, setTestSession] = useState<TestSession | null>(null);
	const [currentQuestion, setCurrentQuestion] = useState<Question | null>(
		null
	);
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [showConfirmModal, setShowConfirmModal] = useState(false);
	const [testComplete, setTestComplete] = useState(false);

	// Complete test and save results
	const completeTest = useCallback(
		async (finalSession: TestSession) => {
			if (!examiner) return;

			try {
				console.log(
					"Completing test for examinee:",
					finalSession.examinee
				);

				// Get results only for questions that were actually asked/answered
				const getQuestionResult = (index: number) => {
					const attempt = finalSession.attempts[index];
					if (attempt) {
						// Question was answered - use actual result (true/false)
						return {
							id: attempt.questionId,
							result: attempt.result,
						};
					}
					// Question wasn't asked - leave as null
					return {
						id: null,
						result: null,
					};
				};

				const q1 = getQuestionResult(0);
				const q2 = getQuestionResult(1);
				const q3 = getQuestionResult(2);
				const r1 = getQuestionResult(3);
				const r2 = getQuestionResult(4);

				const testResult = {
					test_date: new Date().toISOString().split("T")[0],
					employee_id:
						finalSession.examinee.employee_id ||
						finalSession.examinee.employeeID ||
						examineeId,
					full_name: finalSession.examinee.full_name,
					rank: finalSession.examinee.rank,
					base: finalSession.examinee.base,
					q1_id: q1.id,
					q1_result: q1.result,
					q2_id: q2.id,
					q2_result: q2.result,
					q3_id: q3.id,
					q3_result: q3.result,
					r1_id: r1.id,
					r1_result: r1.result,
					r2_id: r2.id,
					r2_result: r2.result,
					examiner_name: examiner.full_name,
					examiner_id: examiner.id,
				};

				console.log("Submitting test result:", testResult);

				const response = await fetch("/api/test-results", {
					method: "POST",
					headers: {
						"Content-Type": "application/json",
						Authorization: `Bearer ${localStorage.getItem(
							"token"
						)}`,
					},
					body: JSON.stringify(testResult),
				});

				if (!response.ok) {
					const errorData = await response.json();
					console.error("Failed to save test results:", errorData);
					throw new Error(
						errorData.message || "Failed to save test results"
					);
				}

				const savedResult = await response.json();
				console.log("Test result saved successfully:", savedResult);

				setTestComplete(true);
			} catch (err) {
				console.error("Error saving test results:", err);
				setError(
					"Failed to save test results: " +
						(err instanceof Error ? err.message : "Unknown error")
				);
			}
		},
		[examiner, examineeId]
	);

	// Load examinee data
	const loadExaminee = async () => {
		if (!examineeId.trim()) {
			setError("Please enter an examinee ID");
			return;
		}

		setIsLoading(true);
		setError("");

		try {
			console.log("Loading examinee:", examineeId);

			const response = await fetch(`/api/users/${examineeId}`, {
				headers: {
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
			});

			console.log("Examinee response status:", response.status);

			if (response.ok) {
				const userData = await response.json();
				console.log("Examinee data received:", userData);
				setExaminee(userData);
				await initializeTestSession(userData);
			} else if (response.status === 404) {
				setError(
					"Examinee not found. Please check the ID and try again."
				);
			} else {
				const errorData = await response.json();
				console.error("Examinee API error:", errorData);
				setError(errorData.message || "Failed to load examinee data");
			}
		} catch (err) {
			console.error("Examinee fetch error:", err);
			setError("Failed to load examinee data");
		} finally {
			setIsLoading(false);
		}
	};

	// Initialize test session with filtered questions
	const initializeTestSession = async (examineeData: User) => {
		try {
			console.log("Initializing test session for:", examineeData);

			const response = await fetch("/api/questions/filtered", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
				body: JSON.stringify({
					filters: examineeData.filter || [],
					handicapLevel: examineeData.handicap_level || 3,
				}),
			});

			console.log("Questions response status:", response.status);

			if (response.ok) {
				const questions = await response.json();
				console.log("Questions received:", questions.length);
				console.log("Sample questions:", questions.slice(0, 3));

				if (questions.length < 5) {
					setError(
						`Not enough questions available for this examinee. Found ${questions.length} questions, need at least 5.`
					);
					return;
				}

				// Better shuffling algorithm - ensure unique questions
				const availableQuestions = [...questions];
				const selectedQuestions = [];

				for (let i = 0; i < 5 && availableQuestions.length > 0; i++) {
					const randomIndex = Math.floor(
						Math.random() * availableQuestions.length
					);
					selectedQuestions.push(availableQuestions[randomIndex]);
					availableQuestions.splice(randomIndex, 1); // Remove selected question
				}

				console.log(
					"Selected questions:",
					selectedQuestions.map((q) => ({
						id: q.id,
						title: q.question_title.substring(0, 50) + "...",
					}))
				);

				const newSession: TestSession = {
					examinee: examineeData,
					questions: selectedQuestions,
					attempts: [],
					currentQuestionIndex: 0,
					isComplete: false,
					passedCount: 0,
				};

				setTestSession(newSession);
				setCurrentQuestion(selectedQuestions[0]);
				console.log("Test session initialized successfully");
			} else {
				const errorData = await response.json();
				console.error("Questions API error:", errorData);
				setError(
					errorData.message ||
						"Failed to load questions for this examinee"
				);
			}
		} catch (err) {
			console.error("Test session initialization error:", err);
			setError("Failed to initialize test session");
		}
	};

	// Handle answer submission
	const submitAnswer = useCallback(
		(isCorrect: boolean) => {
			if (!testSession || !currentQuestion) return;

			console.log(
				`Answer submitted for question ${
					testSession.currentQuestionIndex + 1
				}:`,
				isCorrect
			);
			console.log("Current question ID:", currentQuestion.id);

			const newAttempt: QuestionAttempt = {
				questionId: currentQuestion.id,
				result: isCorrect,
				timeSpent: 30, // This would be calculated from timer
			};

			const updatedAttempts = [...testSession.attempts, newAttempt];
			const updatedPassedCount =
				testSession.passedCount + (isCorrect ? 1 : 0);
			const nextIndex = testSession.currentQuestionIndex + 1;

			console.log("Updated stats:", {
				questionsAsked: updatedAttempts.length,
				passedCount: updatedPassedCount,
				failedCount: updatedAttempts.length - updatedPassedCount,
				nextIndex,
				totalQuestions: testSession.questions.length,
			});

			// FIXED: Test ending conditions - ONLY these 3 scenarios:
			// 1. Got 3 correct answers (PASS early)
			// 2. Used all 5 attempts (END regardless of results)
			// 3. Not enough questions available (handled during initialization)

			const questionsAsked = updatedAttempts.length;

			const shouldEnd =
				updatedPassedCount >= 3 || // Got 3 correct (PASS early)
				questionsAsked >= 5; // Used all 5 attempts (END)

			console.log("End conditions check:", {
				shouldEnd,
				questionsAsked,
				passedCount: updatedPassedCount,
				reasons: {
					got3Correct: updatedPassedCount >= 3,
					usedAll5Attempts: questionsAsked >= 5,
				},
			});

			const updatedSession: TestSession = {
				...testSession,
				attempts: updatedAttempts,
				currentQuestionIndex: nextIndex,
				passedCount: updatedPassedCount,
				isComplete: shouldEnd,
			};

			setTestSession(updatedSession);

			if (shouldEnd) {
				console.log("Test ending, completing...");
				completeTest(updatedSession);
			} else {
				console.log("Moving to next question:", nextIndex);
				setCurrentQuestion(testSession.questions[nextIndex]);
			}
		},
		[testSession, currentQuestion, completeTest]
	);

	// Reset for next test
	const resetTest = () => {
		setExamineeId("");
		setExaminee(null);
		setTestSession(null);
		setCurrentQuestion(null);
		setTestComplete(false);
		setError("");
	};

	// Get question label (Q1, Q2, Q3, R1, R2)
	const getQuestionLabel = (index: number) => {
		if (index < 3) return `Q${index + 1}`;
		return `R${index - 2}`;
	};

	// Handle timer events
	const handleTimeUp = useCallback(() => {
		submitAnswer(false); // Auto-submit as incorrect when time is up
	}, [submitAnswer]);

	const handleTimeWarning = useCallback((timeLeft: number) => {
		// Visual/audio warning handled by Timer component
	}, []);

	if (testComplete) {
		return (
			<div className={styles.testComplete}>
				<div className={styles.completeCard}>
					<div className={styles.completeIcon}>🎉</div>
					<h2>Test Complete!</h2>
					<p>
						{testSession?.examinee.full_name} has completed the oral
						test.
						<br />
						Result:{" "}
						{testSession?.passedCount >= 3 ? "PASSED" : "FAILED"}(
						{testSession?.passedCount}/3 correct in{" "}
						{testSession?.attempts.length} attempts)
					</p>
					<button className="btn btn-primary" onClick={resetTest}>
						Test Next Examinee
					</button>
				</div>
			</div>
		);
	}

	return (
		<div className={styles.testInterface}>
			{!testSession ? (
				<div className={styles.examineeLookup}>
					<div className={styles.lookupCard}>
						<h2>Enter Examinee Information</h2>
						<div className={styles.inputGroup}>
							<label htmlFor="examineeId">Examinee ID</label>
							<input
								type="text"
								id="examineeId"
								value={examineeId}
								onChange={(e) => setExamineeId(e.target.value)}
								placeholder="Enter examinee employee ID"
								className="form-input"
								disabled={isLoading}
								onKeyPress={(e) =>
									e.key === "Enter" && loadExaminee()
								}
							/>
						</div>

						{error && (
							<div className="alert alert-error">{error}</div>
						)}

						<button
							className="btn btn-primary"
							onClick={loadExaminee}
							disabled={isLoading}
						>
							{isLoading ? "Loading..." : "Load Examinee"}
						</button>
					</div>
				</div>
			) : (
				<div className={styles.testSession}>
					<div className={styles.sessionHeader}>
						<ExamineeInfo
							examinee={testSession.examinee}
							hidePrivateInfo
						/>
						<div className={styles.progressInfo}>
							<span className={styles.questionLabel}>
								{getQuestionLabel(
									testSession.currentQuestionIndex
								)}
							</span>
							<span className={styles.scoreInfo}>
								Passed: {testSession.passedCount}/3
							</span>
							<span className={styles.scoreInfo}>
								Attempts: {testSession.attempts.length}/5
							</span>
						</div>
					</div>

					{currentQuestion && (
						<div className={styles.questionArea}>
							<div className={styles.questionCard}>
								<div className={styles.questionHeader}>
									<h3 className={styles.questionTitle}>
										{currentQuestion.question_title}
									</h3>
									{currentQuestion.question_number && (
										<div className={styles.questionNumber}>
											Question #
											{currentQuestion.question_number}
										</div>
									)}
								</div>

								<div className={styles.questionDetails}>
									<div className={styles.detailItem}>
										<strong>Category:</strong>{" "}
										{currentQuestion.question_category}
									</div>
									<div className={styles.detailItem}>
										<strong>Chapter:</strong>{" "}
										{currentQuestion.question_chapter}
									</div>
									<div className={styles.detailItem}>
										<strong>Page:</strong>{" "}
										{currentQuestion.question_page}
									</div>
									<div className={styles.detailItem}>
										<strong>Line:</strong>{" "}
										{currentQuestion.question_line}
									</div>
								</div>
							</div>

							<div className={styles.rightPanel}>
								<div className={styles.timerSection}>
									<Timer
										initialTime={30}
										onTimeUp={handleTimeUp}
										onTimeWarning={handleTimeWarning}
										autoStart={false}
									/>
								</div>

								<div className={styles.answerButtons}>
									<button
										className="btn btn-success"
										onClick={() => submitAnswer(true)}
									>
										✓ Correct
									</button>
									<button
										className="btn btn-danger"
										onClick={() => submitAnswer(false)}
									>
										✗ Incorrect
									</button>
								</div>
							</div>
						</div>
					)}
				</div>
			)}

			{showConfirmModal && (
				<div className={styles.modal}>
					<div className={styles.modalContent}>
						<h3>Confirm Exit</h3>
						<p>
							Are you sure you want to exit the test? All unsaved
							progress will be lost.
						</p>
						<div className={styles.modalButtons}>
							<button
								className="btn btn-secondary"
								onClick={() => setShowConfirmModal(false)}
							>
								Cancel
							</button>
							<button
								className="btn btn-danger"
								onClick={() => {
									setShowConfirmModal(false);
									resetTest();
								}}
							>
								Exit Test
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default TestInterface;
