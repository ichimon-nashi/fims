// src/components/audit/iosa/IOSAImport.tsx
"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import styles from "./IOSAImport.module.css";

// ── Types ────────────────────────────────────────────────────
interface ConflictField {
	field: string;
	file_value: string;
	system_value: string;
}

interface Conflict {
	isarp_code: string;
	discipline: string;
	field_conflicts: ConflictField[];
	file_row: any;
	system_record: any;
}

interface ImportResult {
	isarps_seeded?: number;
	isarps_imported?: number;
	auto_imported?: number;
	conflicts?: Conflict[];
	disciplines?: string[];
}

interface IOSAImportProps {
	cycleId: string | null;
	ismEdition: string;
	onClose: () => void;
	onComplete: () => void;
}

const FIELD_LABELS: Record<string, string> = {
	doc_references: "Documentation References",
	conformance_status: "Conformance Status",
	nonconformity_desc: "Nonconformity Description",
	root_cause: "Root Cause",
	corrective_action: "Corrective Action",
};

type ImportTab = "ism" | "cr";
type Step = "upload" | "processing" | "conflicts" | "done";

export default function IOSAImport({
	cycleId,
	ismEdition,
	onClose,
	onComplete,
}: IOSAImportProps) {
	const { token } = useAuth();
	const [tab, setTab] = useState<ImportTab>("ism");

	// ISM tab state
	const ismFileRef = useRef<HTMLInputElement>(null);
	const [ismFiles, setIsmFiles] = useState<File[]>([]);
	const [ismLoading, setIsmLoading] = useState(false);
	const [ismResult, setIsmResult] = useState<ImportResult | null>(null);
	const [ismError, setIsmError] = useState("");
	const [ismDone, setIsmDone] = useState(false);

	// CR tab state
	const crFileRef = useRef<HTMLInputElement>(null);
	const [crFile, setCrFile] = useState<File | null>(null);
	const [crVersion, setCrVersion] = useState("");
	const [step, setStep] = useState<Step>("upload");
	const [result, setResult] = useState<ImportResult | null>(null);
	const [error, setError] = useState("");
	const [resolutions, setResolutions] = useState<
		Record<string, Record<string, "file" | "system">>
	>({});
	const [resolving, setResolving] = useState(false);

	// ── ISM tab handlers ──────────────────────────────────────
	const handleIsmFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
		const files = Array.from(e.target.files || []).filter((f) =>
			f.name.endsWith(".docx"),
		);
		setIsmFiles(files);
		setIsmError("");
	};

	const handleIsmUpload = async () => {
		if (!ismFiles.length || !token) return;
		if (!cycleId) {
			setIsmError(
				"No active cycle. Go to Dashboard and select a cycle first.",
			);
			return;
		}
		setIsmLoading(true);
		setIsmError("");
		try {
			const formData = new FormData();
			ismFiles.forEach((f) => formData.append("files", f));
			formData.append("cycle_id", cycleId);
			formData.append("ism_edition", ismEdition);

			const res = await fetch("/api/audit/iosa/import-ism", {
				method: "POST",
				headers: { Authorization: `Bearer ${token}` },
				body: formData,
			});
			if (!res.ok) {
				const d = await res.json();
				throw new Error(d.error || "Import failed");
			}
			const data = await res.json();
			setIsmResult(data);
			setIsmDone(true);
		} catch (e: any) {
			setIsmError(e.message);
		} finally {
			setIsmLoading(false);
		}
	};

	// ── CR tab handlers ───────────────────────────────────────
	const handleCrFile = (e: React.ChangeEvent<HTMLInputElement>) => {
		const f = e.target.files?.[0];
		if (!f) return;
		if (!f.name.endsWith(".xlsx")) {
			setError("Please select an .xlsx file");
			return;
		}
		setCrFile(f);
		setError("");
	};

	const handleCrUpload = async () => {
		if (!crFile || !token) return;
		if (!cycleId) {
			setError(
				"No active cycle. Go to Dashboard and select a cycle first.",
			);
			return;
		}
		setStep("processing");
		setError("");
		try {
			const formData = new FormData();
			formData.append("file", crFile);
			formData.append("ism_edition", ismEdition);
			formData.append("cr_version", crVersion);
			formData.append("mode", "with_records");
			formData.append("cycle_id", cycleId);

			const res = await fetch("/api/audit/iosa/import", {
				method: "POST",
				headers: { Authorization: `Bearer ${token}` },
				body: formData,
			});
			if (!res.ok) {
				const d = await res.json();
				throw new Error(d.error || "Import failed");
			}
			const data: ImportResult = await res.json();
			setResult(data);

			if (data.conflicts && data.conflicts.length > 0) {
				const init: Record<
					string,
					Record<string, "file" | "system">
				> = {};
				for (const c of data.conflicts) {
					init[c.isarp_code] = {};
					for (const f of c.field_conflicts)
						init[c.isarp_code][f.field] = "system";
				}
				setResolutions(init);
				setStep("conflicts");
			} else {
				setStep("done");
			}
		} catch (e: any) {
			setError(e.message);
			setStep("upload");
		}
	};

	const handleResolve = async () => {
		if (!token || !result) return;
		setResolving(true);
		try {
			const payload = (result.conflicts || []).map((c) => ({
				isarp_code: c.isarp_code,
				cycle_id: cycleId,
				fields: resolutions[c.isarp_code] ?? {},
				file_row: c.file_row,
				system_record: c.system_record,
			}));
			const res = await fetch("/api/audit/iosa/import", {
				method: "PATCH",
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${token}`,
				},
				body: JSON.stringify({ resolutions: payload }),
			});
			if (!res.ok) {
				const d = await res.json();
				throw new Error(d.error || "Failed");
			}
			setStep("done");
		} catch (e: any) {
			setError(e.message);
		} finally {
			setResolving(false);
		}
	};

	const setFieldChoice = (
		isarpCode: string,
		field: string,
		choice: "file" | "system",
	) => {
		setResolutions((prev) => ({
			...prev,
			[isarpCode]: { ...prev[isarpCode], [field]: choice },
		}));
	};

	const setAllForIsarp = (
		isarpCode: string,
		choice: "file" | "system",
		conflict: Conflict,
	) => {
		const fields: Record<string, "file" | "system"> = {};
		for (const f of conflict.field_conflicts) fields[f.field] = choice;
		setResolutions((prev) => ({ ...prev, [isarpCode]: fields }));
	};

	// ── Render ────────────────────────────────────────────────
	return (
		<div className={styles.backdrop}>
			<div className={styles.modal}>
				{/* Header */}
				<div className={styles.header}>
					<div>
						<h2 className={styles.title}>Import</h2>
						<p className={styles.subtitle}>
							Step 2: Upload ISM docx files &nbsp;·&nbsp; Step 3:
							Upload filled CR xlsx (optional)
						</p>
					</div>
					<button className={styles.closeBtn} onClick={onClose}>
						✕
					</button>
				</div>

				{/* Tab bar */}
				<div className={styles.tabBar}>
					<button
						className={`${styles.tabBtn} ${tab === "ism" ? styles.tabBtnActive : ""}`}
						onClick={() => setTab("ism")}
					>
						📄 ISM Checklist (docx)
					</button>
					<button
						className={`${styles.tabBtn} ${tab === "cr" ? styles.tabBtnActive : ""}`}
						onClick={() => setTab("cr")}
					>
						📊 Conformance Report (xlsx)
					</button>
				</div>

				{/* ── ISM TAB ── */}
				{tab === "ism" && (
					<div className={styles.body}>
						{!cycleId ? (
							<div className={styles.warnBox}>
								⚠ No active cycle selected. Go to Dashboard and
								select or create a cycle first.
							</div>
						) : !ismDone ? (
							<>
								<div className={styles.infoBox}>
									Upload one or more ISM discipline checklist
									(.docx) files. Each file seeds ISARPs,
									auditor actions, guidance, and
									cross-references for this cycle. Multiple
									files can be selected at once.
								</div>

								<div
									className={`${styles.dropzone} ${ismFiles.length ? styles.dropzoneReady : ""}`}
									onClick={() => ismFileRef.current?.click()}
								>
									<input
										ref={ismFileRef}
										type="file"
										accept=".docx"
										multiple
										style={{ display: "none" }}
										onChange={handleIsmFiles}
									/>
									{ismFiles.length ? (
										<>
											<div className={styles.fileIcon}>
												📄
											</div>
											<div className={styles.fileName}>
												{ismFiles.length === 1
													? ismFiles[0].name
													: `${ismFiles.length} files selected`}
											</div>
											<div className={styles.fileSize}>
												{ismFiles
													.map((f) =>
														f.name
															.replace("ism-", "")
															.replace(
																"-en.docx",
																"",
															)
															.toUpperCase(),
													)
													.join(", ")}
											</div>
										</>
									) : (
										<>
											<div className={styles.uploadIcon}>
												↑
											</div>
											<div className={styles.uploadText}>
												Click to select ISM checklist
												files
											</div>
											<div className={styles.uploadHint}>
												Select multiple .docx files at
												once (e.g. ism-cab-en.docx,
												ism-flt-en.docx…)
											</div>
										</>
									)}
								</div>

								{ismError && (
									<div className={styles.errorMsg}>
										{ismError}
									</div>
								)}

								<div className={styles.footer}>
									<button
										className={styles.btnGhost}
										onClick={onClose}
									>
										Cancel
									</button>
									<button
										className={styles.btnPrimary}
										onClick={handleIsmUpload}
										disabled={
											!ismFiles.length || ismLoading
										}
									>
										{ismLoading
											? "Importing…"
											: "Import ISM"}
									</button>
								</div>
							</>
						) : (
							// Done
							<div className={styles.doneCenter}>
								<div className={styles.doneIcon}>✓</div>
								<h3 className={styles.doneTitle}>
									ISM Import Complete
								</h3>
								<div className={styles.doneSummary}>
									<div className={styles.doneRow}>
										<span>ISARPs imported</span>
										<span className={styles.doneVal}>
											{ismResult?.isarps_imported}
										</span>
									</div>
									<div className={styles.doneRow}>
										<span>Disciplines</span>
										<span className={styles.doneVal}>
											{ismResult?.disciplines?.join(", ")}
										</span>
									</div>
								</div>
								<p className={styles.doneHint}>
									ISARPs are now seeded with standard text,
									auditor actions, guidance, and
									cross-references. You can now proceed to
									AuditPrep, or optionally import a filled CR
									xlsx in the next tab.
								</p>
								<div
									className={styles.footer}
									style={{ borderTop: "none", paddingTop: 0 }}
								>
									<button
										className={styles.btnGhost}
										onClick={() => setTab("cr")}
									>
										→ Import CR (optional)
									</button>
									<button
										className={styles.btnPrimary}
										onClick={() => {
											onComplete();
											onClose();
										}}
									>
										Done
									</button>
								</div>
							</div>
						)}
					</div>
				)}

				{/* ── CR TAB ── */}
				{tab === "cr" && (
					<div className={styles.body}>
						{step === "upload" && (
							<>
								{!cycleId ? (
									<div className={styles.warnBox}>
										⚠ No active cycle. Go to Dashboard and
										select a cycle first.
									</div>
								) : (
									<div
										className={styles.infoBox}
										style={{
											borderColor:
												"rgba(74,158,255,0.25)",
											color: "#90cdf4",
										}}
									>
										Optional: upload a filled Conformance
										Report to pre-populate doc references,
										conformance status, and AA responses.
										Conflicts with existing system data will
										be shown for review.
									</div>
								)}

								<div
									className={`${styles.dropzone} ${crFile ? styles.dropzoneReady : ""}`}
									onClick={() => crFileRef.current?.click()}
								>
									<input
										ref={crFileRef}
										type="file"
										accept=".xlsx"
										style={{ display: "none" }}
										onChange={handleCrFile}
									/>
									{crFile ? (
										<>
											<div className={styles.fileIcon}>
												📊
											</div>
											<div className={styles.fileName}>
												{crFile.name}
											</div>
											<div className={styles.fileSize}>
												{(crFile.size / 1024).toFixed(
													0,
												)}{" "}
												KB
											</div>
										</>
									) : (
										<>
											<div className={styles.uploadIcon}>
												↑
											</div>
											<div className={styles.uploadText}>
												Click to select CR xlsx
											</div>
											<div className={styles.uploadHint}>
												Conformance Report — ISM{" "}
												{ismEdition}
											</div>
										</>
									)}
								</div>

								<div className={styles.fieldGroup}>
									<label className={styles.fieldLabel}>
										CR Version (optional)
									</label>
									<input
										className={styles.fieldInputSm}
										value={crVersion}
										onChange={(e) =>
											setCrVersion(e.target.value)
										}
										placeholder="e.g. Version 64"
									/>
								</div>

								{error && (
									<div className={styles.errorMsg}>
										{error}
									</div>
								)}

								<div className={styles.footer}>
									<button
										className={styles.btnGhost}
										onClick={onClose}
									>
										Cancel
									</button>
									<button
										className={styles.btnPrimary}
										onClick={handleCrUpload}
										disabled={!crFile || !cycleId}
									>
										Import CR
									</button>
								</div>
							</>
						)}

						{step === "processing" && (
							<div className={styles.processingCenter}>
								<div className={styles.spinner} />
								<div className={styles.processingText}>
									Parsing conformance report…
								</div>
							</div>
						)}

						{step === "conflicts" && result && (
							<>
								<div className={styles.conflictSummary}>
									<span className={styles.summaryChip}>
										{result.isarps_seeded} ISARPs
									</span>
									<span
										className={styles.summaryChip}
										style={{
											background: "rgba(72,187,120,0.12)",
											color: "#48bb78",
										}}
									>
										{result.auto_imported} auto-imported
									</span>
									<span
										className={styles.summaryChip}
										style={{
											background: "rgba(246,173,85,0.12)",
											color: "#f6ad55",
										}}
									>
										{result.conflicts?.length} conflicts
									</span>
								</div>

								<div className={styles.conflictList}>
									{(result.conflicts || []).map(
										(conflict) => (
											<div
												key={conflict.isarp_code}
												className={styles.conflictCard}
											>
												<div
													className={
														styles.conflictHeader
													}
												>
													<span
														className={
															styles.conflictCode
														}
													>
														{conflict.isarp_code}
													</span>
													<span
														className={
															styles.conflictDisc
														}
													>
														{conflict.discipline}
													</span>
													<div
														className={
															styles.conflictBulkBtns
														}
													>
														<button
															className={
																styles.btnBulk
															}
															onClick={() =>
																setAllForIsarp(
																	conflict.isarp_code,
																	"system",
																	conflict,
																)
															}
														>
															Keep all system
														</button>
														<button
															className={
																styles.btnBulkFile
															}
															onClick={() =>
																setAllForIsarp(
																	conflict.isarp_code,
																	"file",
																	conflict,
																)
															}
														>
															Use all file
														</button>
													</div>
												</div>
												{conflict.field_conflicts.map(
													(fc) => {
														const choice =
															resolutions[
																conflict
																	.isarp_code
															]?.[fc.field] ??
															"system";
														return (
															<div
																key={fc.field}
																className={
																	styles.fieldConflict
																}
															>
																<div
																	className={
																		styles.fieldName
																	}
																>
																	{FIELD_LABELS[
																		fc.field
																	] ??
																		fc.field}
																</div>
																<div
																	className={
																		styles.fieldChoices
																	}
																>
																	<button
																		className={`${styles.choiceBtn} ${choice === "system" ? styles.choiceBtnActive : ""}`}
																		onClick={() =>
																			setFieldChoice(
																				conflict.isarp_code,
																				fc.field,
																				"system",
																			)
																		}
																	>
																		<div
																			className={
																				styles.choiceLabel
																			}
																		>
																			Keep
																			system
																		</div>
																		<div
																			className={
																				styles.choiceVal
																			}
																		>
																			{
																				fc.system_value
																			}
																		</div>
																	</button>
																	<div
																		className={
																			styles.choiceDivider
																		}
																	>
																		vs
																	</div>
																	<button
																		className={`${styles.choiceBtn} ${styles.choiceBtnFile} ${choice === "file" ? styles.choiceBtnFileActive : ""}`}
																		onClick={() =>
																			setFieldChoice(
																				conflict.isarp_code,
																				fc.field,
																				"file",
																			)
																		}
																	>
																		<div
																			className={
																				styles.choiceLabel
																			}
																		>
																			Use
																			file
																		</div>
																		<div
																			className={
																				styles.choiceVal
																			}
																		>
																			{
																				fc.file_value
																			}
																		</div>
																	</button>
																</div>
															</div>
														);
													},
												)}
											</div>
										),
									)}
								</div>

								{error && (
									<div
										className={styles.errorMsg}
										style={{ margin: "0 1.25rem" }}
									>
										{error}
									</div>
								)}

								<div className={styles.footer}>
									<button
										className={styles.btnGhost}
										onClick={onClose}
									>
										Cancel
									</button>
									<button
										className={styles.btnPrimary}
										onClick={handleResolve}
										disabled={resolving}
									>
										{resolving
											? "Saving…"
											: "Confirm & Save"}
									</button>
								</div>
							</>
						)}

						{step === "done" && result && (
							<div className={styles.doneCenter}>
								<div className={styles.doneIcon}>✓</div>
								<h3 className={styles.doneTitle}>
									CR Import Complete
								</h3>
								<div className={styles.doneSummary}>
									<div className={styles.doneRow}>
										<span>Records imported</span>
										<span
											className={styles.doneVal}
											style={{ color: "#48bb78" }}
										>
											{result.auto_imported}
										</span>
									</div>
									{(result.conflicts?.length ?? 0) > 0 && (
										<div className={styles.doneRow}>
											<span>Conflicts resolved</span>
											<span
												className={styles.doneVal}
												style={{ color: "#f6ad55" }}
											>
												{result.conflicts?.length}
											</span>
										</div>
									)}
								</div>
								<div
									className={styles.footer}
									style={{ borderTop: "none", paddingTop: 0 }}
								>
									<button
										className={styles.btnPrimary}
										onClick={() => {
											onComplete();
											onClose();
										}}
									>
										Done
									</button>
								</div>
							</div>
						)}
					</div>
				)}
			</div>
		</div>
	);
}
