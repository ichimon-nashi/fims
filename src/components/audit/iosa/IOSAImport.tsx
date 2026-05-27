// src/components/audit/iosa/IOSAImport.tsx
"use client";

import { useState, useRef, useCallback } from "react";
import { useAuth } from "@/context/AuthContext";
import styles from "./IOSAImport.module.css";

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
	isarps_seeded: number;
	auto_imported: number;
	conflicts: Conflict[];
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

type Step = "upload" | "processing" | "conflicts" | "done";

export default function IOSAImport({
	cycleId,
	ismEdition,
	onClose,
	onComplete,
}: IOSAImportProps) {
	const { token } = useAuth();
	const fileRef = useRef<HTMLInputElement>(null);

	const [step, setStep] = useState<Step>("upload");
	const [file, setFile] = useState<File | null>(null);
	const [crVersion, setCrVersion] = useState("");
	const [result, setResult] = useState<ImportResult | null>(null);
	const [error, setError] = useState("");
	const [progress, setProgress] = useState("");

	// Conflict resolutions: { [isarp_code]: { [field]: "file" | "system" } }
	const [resolutions, setResolutions] = useState<
		Record<string, Record<string, "file" | "system">>
	>({});
	const [resolving, setResolving] = useState(false);

	const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const f = e.target.files?.[0];
		if (!f) return;
		if (!f.name.endsWith(".xlsx")) {
			setError("Please select an .xlsx file");
			return;
		}
		setFile(f);
		setError("");
	};

	const handleUpload = async () => {
		if (!file || !token) return;
		if (!cycleId) {
			setError(
				"No active cycle selected. Go to Dashboard and select a cycle first.",
			);
			return;
		}
		setStep("processing");
		setProgress("Uploading file...");
		setError("");

		try {
			const formData = new FormData();
			formData.append("file", file);
			formData.append("ism_edition", ismEdition);
			formData.append("cr_version", crVersion);
			formData.append("mode", cycleId ? "with_records" : "seed_only");
			if (cycleId) formData.append("cycle_id", cycleId);

			setProgress("Parsing ISARPs...");
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

			if (data.conflicts.length > 0) {
				// Initialize all conflict resolutions to "system" (keep existing) by default
				const init: Record<
					string,
					Record<string, "file" | "system">
				> = {};
				for (const c of data.conflicts) {
					init[c.isarp_code] = {};
					for (const f of c.field_conflicts) {
						init[c.isarp_code][f.field] = "system"; // default: keep system value
					}
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

	const handleResolve = async () => {
		if (!token || !result) return;
		setResolving(true);
		setError("");
		try {
			const payload = result.conflicts.map((c) => ({
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

	return (
		<div className={styles.backdrop}>
			<div className={styles.modal}>
				{/* Header */}
				<div className={styles.header}>
					<div>
						<h2 className={styles.title}>Import ISARPs</h2>
						<p className={styles.subtitle}>
							{step === "upload" &&
								"Upload Conformance Report (xlsx) to seed ISARPs and pre-fill records"}
							{step === "processing" && "Processing..."}
							{step === "conflicts" &&
								`${result?.conflicts.length} conflict${result?.conflicts.length !== 1 ? "s" : ""} found — review and resolve`}
							{step === "done" && "Import complete"}
						</p>
					</div>
					{step !== "processing" && (
						<button className={styles.closeBtn} onClick={onClose}>
							✕
						</button>
					)}
				</div>

				{/* ── Upload step ── */}
				{step === "upload" && (
					<div className={styles.body}>
						<div
							className={`${styles.dropzone} ${file ? styles.dropzoneReady : ""}`}
							onClick={() => fileRef.current?.click()}
						>
							<input
								ref={fileRef}
								type="file"
								accept=".xlsx"
								style={{ display: "none" }}
								onChange={handleFileChange}
							/>
							{file ? (
								<>
									<div className={styles.fileIcon}>📊</div>
									<div className={styles.fileName}>
										{file.name}
									</div>
									<div className={styles.fileSize}>
										{(file.size / 1024).toFixed(0)} KB
									</div>
								</>
							) : (
								<>
									<div className={styles.uploadIcon}>↑</div>
									<div className={styles.uploadText}>
										Click to select CR xlsx
									</div>
									<div className={styles.uploadHint}>
										Conformance Report — ISM {ismEdition}
									</div>
								</>
							)}
						</div>

						{!cycleId ? (
							<div
								className={styles.infoBox}
								style={{
									borderColor: "rgba(252,129,129,0.25)",
									color: "#fc8181",
								}}
							>
								⚠ No active cycle selected. Go to Dashboard and
								select or create a cycle first.
							</div>
						) : (
							<div
								className={styles.infoBox}
								style={{
									borderColor: "rgba(74,158,255,0.25)",
									color: "#90cdf4",
								}}
							>
								ISARPs will be seeded for this cycle only. Each
								cycle maintains its own independent copy of
								ISARPs — importing here does not affect any
								other cycle.
							</div>
						)}

						<div className={styles.fieldGroup}>
							<label className={styles.fieldLabel}>
								CR Version (optional)
							</label>
							<input
								className={styles.fieldInputSm}
								value={crVersion}
								onChange={(e) => setCrVersion(e.target.value)}
								placeholder="e.g. Version 64"
							/>
						</div>

						{error && (
							<div className={styles.errorMsg}>{error}</div>
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
								onClick={handleUpload}
								disabled={!file || !cycleId}
							>
								Import
							</button>
						</div>
					</div>
				)}

				{/* ── Processing step ── */}
				{step === "processing" && (
					<div className={styles.body}>
						<div className={styles.processingCenter}>
							<div className={styles.spinner} />
							<div className={styles.processingText}>
								{progress}
							</div>
						</div>
					</div>
				)}

				{/* ── Conflicts step ── */}
				{step === "conflicts" && result && (
					<>
						<div className={styles.conflictSummary}>
							<span className={styles.summaryChip}>
								{result.isarps_seeded} ISARPs seeded
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
								{result.conflicts.length} conflicts
							</span>
						</div>

						<div className={styles.conflictList}>
							{result.conflicts.map((conflict) => (
								<div
									key={conflict.isarp_code}
									className={styles.conflictCard}
								>
									<div className={styles.conflictHeader}>
										<span className={styles.conflictCode}>
											{conflict.isarp_code}
										</span>
										<span className={styles.conflictDisc}>
											{conflict.discipline}
										</span>
										<div
											className={styles.conflictBulkBtns}
										>
											<button
												className={styles.btnBulk}
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
												className={styles.btnBulkFile}
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

									{conflict.field_conflicts.map((fc) => {
										const choice =
											resolutions[conflict.isarp_code]?.[
												fc.field
											] ?? "system";
										return (
											<div
												key={fc.field}
												className={styles.fieldConflict}
											>
												<div
													className={styles.fieldName}
												>
													{FIELD_LABELS[fc.field] ??
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
															Keep system
														</div>
														<div
															className={
																styles.choiceVal
															}
														>
															{fc.system_value}
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
															Use file
														</div>
														<div
															className={
																styles.choiceVal
															}
														>
															{fc.file_value}
														</div>
													</button>
												</div>
											</div>
										);
									})}
								</div>
							))}
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
								{resolving ? "Saving..." : "Confirm & Save"}
							</button>
						</div>
					</>
				)}

				{/* ── Done step ── */}
				{step === "done" && result && (
					<div className={styles.body}>
						<div className={styles.doneCenter}>
							<div className={styles.doneIcon}>✓</div>
							<h3 className={styles.doneTitle}>
								Import Complete
							</h3>
							<div className={styles.doneSummary}>
								<div className={styles.doneRow}>
									<span>ISARPs seeded</span>
									<span className={styles.doneVal}>
										{result.isarps_seeded}
									</span>
								</div>
								<div className={styles.doneRow}>
									<span>Records imported</span>
									<span
										className={styles.doneVal}
										style={{ color: "#48bb78" }}
									>
										{result.auto_imported}
									</span>
								</div>
								{result.conflicts.length > 0 && (
									<div className={styles.doneRow}>
										<span>Conflicts resolved</span>
										<span
											className={styles.doneVal}
											style={{ color: "#f6ad55" }}
										>
											{result.conflicts.length}
										</span>
									</div>
								)}
							</div>
						</div>
						<div className={styles.footer}>
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
		</div>
	);
}
