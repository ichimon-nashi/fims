// src/components/audit/routine/PendingReviewList.tsx
"use client";

import { useEffect, useState } from "react";
import styles from "./PendingReviewList.module.css";
import { useAuth } from "@/context/AuthContext";
import SelfInspectionForm from "./SelfInspectionForm";

interface AttachmentTag {
	id: string;
	subject_crew_name: string;
	subject_crew_position: string | null;
	checklist_templates: { code: string; name: string } | null;
}

interface PendingForm {
	id: string;
	audit_date: string;
	aircraft_tail: string;
	flight_no: string | null;
	route: string | null;
	comments: string | null;
	submitted_by: string;
	submitted_by_name: string;
	submitted_at: string;
	audit_routine_form_attachments: AttachmentTag[];
}

export default function PendingReviewList({ onChanged }: { onChanged?: () => void }) {
	const { token } = useAuth();
	const [forms, setForms] = useState<PendingForm[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	// which card has its approve-confirmation (result picker) open
	const [approvingId, setApprovingId] = useState<string | null>(null);
	const [pendingResult, setPendingResult] = useState<"OK" | "NG">("OK");
	const [busyId, setBusyId] = useState<string | null>(null);
	const [editingId, setEditingId] = useState<string | null>(null);

	async function loadPending() {
		if (!token) return;
		setLoading(true);
		setError(null);
		try {
			const res = await fetch("/api/audit/routine/self-inspection", {
				headers: { Authorization: `Bearer ${token}` },
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? "載入失敗");
			setForms(data.records ?? []);
		} catch (e: any) {
			setError(e.message ?? "載入失敗");
		} finally {
			setLoading(false);
		}
	}

	useEffect(() => {
		loadPending();
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [token]);

	async function handleApprove(formId: string) {
		if (!token) return;
		setBusyId(formId);
		try {
			const res = await fetch(`/api/audit/routine/self-inspection/${formId}/approve`, {
				method: "POST",
				headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
				body: JSON.stringify({ result: pendingResult }),
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? "核准失敗");
			setForms((prev) => prev.filter((f) => f.id !== formId));
			setApprovingId(null);
			onChanged?.();
		} catch (e: any) {
			setError(e.message ?? "核准失敗");
		} finally {
			setBusyId(null);
		}
	}

	async function handleDelete(formId: string) {
		if (!token) return;
		if (!confirm("確定要刪除此筆待審核紀錄？此動作無法復原。")) return;
		setBusyId(formId);
		try {
			const res = await fetch(`/api/audit/routine/self-inspection/${formId}/delete`, {
				method: "POST",
				headers: { Authorization: `Bearer ${token}` },
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? "刪除失敗");
			setForms((prev) => prev.filter((f) => f.id !== formId));
			onChanged?.();
		} finally {
			setBusyId(null);
		}
	}

	async function downloadFile(url: string, fallbackName: string) {
		const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
		if (!res.ok) {
			const data = await res.json().catch(() => ({}));
			throw new Error(data.error ?? "匯出失敗");
		}
		// filename comes from the server's Content-Disposition header (the
		// actual Chinese document names), not reconstructed client-side
		const disposition = res.headers.get("Content-Disposition") ?? "";
		const rfc5987Match = disposition.match(/filename\*=UTF-8''([^;]+)/);
		const filename = rfc5987Match ? decodeURIComponent(rfc5987Match[1]) : fallbackName;
		const blob = await res.blob();
		const blobUrl = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = blobUrl;
		a.download = filename;
		a.click();
		URL.revokeObjectURL(blobUrl);
	}

	async function handleExport(form: PendingForm) {
		if (!token) return;
		setBusyId(form.id);
		try {
			// main form, always
			await downloadFile(`/api/audit/routine/self-inspection/${form.id}/export-docx`, "自我督察表.docx");
			// every attachment present (fatigue is always present; c_efb only when added)
			for (const att of form.audit_routine_form_attachments) {
				// small delay between downloads — some browsers throttle/drop
				// multiple near-simultaneous downloads triggered from one click
				await new Promise((r) => setTimeout(r, 400));
				await downloadFile(
					`/api/audit/routine/self-inspection/${form.id}/export-attachment/${att.id}`,
					`${att.checklist_templates?.name ?? "attachment"}.docx`,
				);
			}
		} catch (e: any) {
			setError(e.message ?? "匯出失敗");
		} finally {
			setBusyId(null);
		}
	}

	if (loading) return <p className={styles.status}>載入中...</p>;
	if (error) return <p className={styles.error}>{error}</p>;

	if (editingId) {
		return (
			<SelfInspectionForm
				existingFormId={editingId}
				onClose={() => setEditingId(null)}
				onSubmitted={() => {
					setEditingId(null);
					loadPending();
					onChanged?.();
				}}
			/>
		);
	}

	if (forms.length === 0) return <p className={styles.status}>目前無待審核項目</p>;

	return (
		<div className={styles.list}>
			{forms.map((form) => (
				<div key={form.id} className={styles.card}>
					<div className={styles.cardHeader}>
						<div className={styles.cardHeaderMain}>
							<span className={styles.headerDate}>{form.audit_date}</span>
							<span className={styles.submitterBadge}>提交人 {form.submitted_by_name}</span>
							<span className={styles.tailBadge}>{form.aircraft_tail}</span>
							{form.flight_no && <span className={styles.flightBadge}>✈ {form.flight_no}</span>}
						</div>
						<span className={styles.pendingBadge}>待審核</span>
					</div>

					<div className={styles.cardBody}>
						{form.audit_routine_form_attachments.length > 0 && (
							<div className={styles.attachmentTags}>
								{form.audit_routine_form_attachments.map((a) => (
									<span key={a.id} className={styles.attachmentTag}>
										{a.checklist_templates?.name ?? a.checklist_templates?.code} · {a.subject_crew_name}
									</span>
								))}
							</div>
						)}

						{form.comments && (
							<div>
								<p className={styles.commentLabel}>查核結果及建議（查核員註記）</p>
								<p className={styles.commentText}>{form.comments}</p>
							</div>
						)}

						{approvingId === form.id ? (
							<div className={styles.approveConfirm}>
								<span className={styles.approveConfirmLabel}>核准結果：</span>
								<label className={styles.radioLabel}>
									<input
										type="radio"
										checked={pendingResult === "OK"}
										onChange={() => setPendingResult("OK")}
									/>
									OK（無缺失）
								</label>
								<label className={styles.radioLabel}>
									<input
										type="radio"
										checked={pendingResult === "NG"}
										onChange={() => setPendingResult("NG")}
									/>
									NG（記錄缺失）
								</label>
								<button
									className={styles.confirmBtn}
									disabled={busyId === form.id}
									onClick={() => handleApprove(form.id)}
								>
									{busyId === form.id ? "處理中..." : "確認核准"}
								</button>
								<button className={styles.cancelBtn} onClick={() => setApprovingId(null)}>
									取消
								</button>
							</div>
						) : (
							<div className={styles.actions}>
								<button className={styles.viewBtn} onClick={() => setEditingId(form.id)}>
									檢視完整表單
								</button>
								<button
									className={styles.approveBtn}
									disabled={busyId === form.id}
									onClick={() => {
										setPendingResult("OK");
										setApprovingId(form.id);
									}}
								>
									核准
								</button>
								<button
									className={styles.rejectBtn}
									disabled={busyId === form.id}
									onClick={() => handleDelete(form.id)}
								>
									刪除
								</button>
								<button
									className={styles.exportBtn}
									disabled={busyId === form.id}
									onClick={() => handleExport(form)}
								>
									{busyId === form.id ? "匯出中..." : "匯出docx"}
								</button>
							</div>
						)}
					</div>
				</div>
			))}
		</div>
	);
}