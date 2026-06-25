// src/components/audit/iosa/IOSAImport.tsx
"use client";

import { useState, useRef } from "react";
import { useAuth } from "@/context/AuthContext";
import styles from "./IOSAImport.module.css";

// ── Types ────────────────────────────────────────────────────
interface ImportResult {
	isarps_imported?: number;
	tables_imported?: number;
	disciplines?: string[];
}

interface IOSAImportProps {
	cycleId: string | null;
	ismEdition: string;
	onClose: () => void;
	onComplete: () => void;
}

export default function IOSAImport({
	cycleId,
	ismEdition,
	onClose,
	onComplete,
}: IOSAImportProps) {
	const { token } = useAuth();

	// ISM tab state
	const ismFileRef = useRef<HTMLInputElement>(null);
	const [ismFiles, setIsmFiles] = useState<File[]>([]);
	const [ismLoading, setIsmLoading] = useState(false);
	const [ismResult, setIsmResult] = useState<ImportResult | null>(null);
	const [ismError, setIsmError] = useState("");
	const [ismDone, setIsmDone] = useState(false);

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

	// ── Render ────────────────────────────────────────────────
	return (
		<div className={styles.backdrop}>
			<div className={styles.modal}>
				{/* Header */}
				<div className={styles.header}>
					<div>
						<h2 className={styles.title}>Import</h2>
						<p className={styles.subtitle}>
							Upload ISM docx checklist files
						</p>
					</div>
					<button className={styles.closeBtn} onClick={onClose}>
						✕
					</button>
				</div>

				{/* ── ISM IMPORT ── */}
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
										<span>Tables imported</span>
										<span
											className={styles.doneVal}
											style={{
												color:
													(ismResult?.tables_imported ??
														0) > 0
														? "#48bb78"
														: "#fc8181",
											}}
										>
											{ismResult?.tables_imported ?? 0}
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
									AuditPrep.
								</p>
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
			</div>
		</div>
	);
}