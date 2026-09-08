// src/components/audit/routine/SelfInspectionForm.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import styles from "./SelfInspectionForm.module.css";
import { useAuth } from "@/context/AuthContext";
import CrewRosterFields, { RosterHeaderData } from "./CrewRosterFields";
import ChecklistItemList, { ChecklistItem, ItemAnswer } from "./ChecklistItemList";
import AttachmentPicker, { AttachmentInstance, TemplateWithItems } from "./AttachmentPicker";
import { queueSubmission, listQueuedSubmissions, removeQueuedSubmission, saveDraft, loadDraft, clearDraft } from "@/lib/offlineStore";

// lightweight collapsible wrapper — deliberately doesn't touch
// ChecklistItemList/CrewRosterFields' own internals, just wraps around
// whatever's passed as children. Defaults open (same visible-by-default
// experience as before); collapsing is opt-in per section, not forced.
function Section({ title, defaultOpen = true, children }: { title: string; defaultOpen?: boolean; children: React.ReactNode }) {
	const [open, setOpen] = useState(defaultOpen);
	return (
		<div className={styles.section}>
			<button type="button" className={styles.sectionToggle} onClick={() => setOpen((v) => !v)}>
				<span className={styles.sectionChevron}>{open ? "▾" : "▸"}</span>
				<span className={styles.sectionTitle}>{title}</span>
			</button>
			{open && <div className={styles.sectionBody}>{children}</div>}
		</div>
	);
}

const emptyHeader: RosterHeaderData = {
	audit_date: new Date().toISOString().slice(0, 10),
	aircraft_tail: "",
	flight_no: "",
	route: "",
	ca_name: "",
	fo_name: "",
	cabin_crew: [],
};

interface Props {
	onClose: () => void;
	onSubmitted: () => void;
	existingFormId?: string; // when set, loads and edits an existing pending submission instead of starting blank
}

export default function SelfInspectionForm({ onClose, onSubmitted, existingFormId }: Props) {
	const { token } = useAuth();

	const [mainTemplate, setMainTemplate] = useState<{ id: string; items: ChecklistItem[] } | null>(null);
	const [focusSetId, setFocusSetId] = useState<string | null>(null);
	const [focusItems, setFocusItems] = useState<ChecklistItem[]>([]);
	const [suggestedAttachmentId, setSuggestedAttachmentId] = useState<string | null>(null);
	const [attachmentTemplates, setAttachmentTemplates] = useState<TemplateWithItems[]>([]);

	const [header, setHeader] = useState<RosterHeaderData>(emptyHeader);
	const [mainAnswers, setMainAnswers] = useState<Record<number, ItemAnswer>>({});
	const [focusAnswers, setFocusAnswers] = useState<Record<number, ItemAnswer>>({});
	const [attachments, setAttachments] = useState<AttachmentInstance[]>([]);
	const [comments, setComments] = useState("");

	const [submitting, setSubmitting] = useState(false);
	const [submitError, setSubmitError] = useState<string | null>(null);
	const [attemptedSubmit, setAttemptedSubmit] = useState(false); // drives red-border validation display, not shown until the first failed attempt
	const [offline, setOffline] = useState(typeof navigator !== "undefined" && !navigator.onLine);
	const [draftSaved, setDraftSaved] = useState(false);

	// ---- load draft on mount, if one exists (skipped entirely in edit mode) ----
	// stores the pending draft rather than immediately prompting with a
	// blocking native confirm() — that dialog fired before the form was
	// even visible, which is likely what looked like "a modal instead of
	// the audit form." Shown as an in-app banner instead, below.
	const [pendingDraft, setPendingDraft] = useState<Record<string, unknown> | null>(null);
	useEffect(() => {
		if (existingFormId) return;
		loadDraft().then((draft) => {
			if (draft) setPendingDraft(draft);
		});
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	function resumeDraft() {
		if (!pendingDraft) return;
		setHeader(pendingDraft.header as RosterHeaderData);
		setMainAnswers(pendingDraft.mainAnswers as Record<number, ItemAnswer>);
		setFocusAnswers(pendingDraft.focusAnswers as Record<number, ItemAnswer>);
		setAttachments(pendingDraft.attachments as AttachmentInstance[]);
		setComments(pendingDraft.comments as string);
		setPendingDraft(null);
	}

	function discardDraft() {
		clearDraft();
		setPendingDraft(null);
	}

	// ---- edit mode: load the existing submission instead of starting blank ----
	const [loadError, setLoadError] = useState<string | null>(null);
	useEffect(() => {
		if (!existingFormId || !token) return;
		fetch(`/api/audit/routine/self-inspection/${existingFormId}`, {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then(async (r) => {
				const data = await r.json();
				if (!r.ok) throw new Error(data.error ?? "載入失敗");
				return data;
			})
			.then((data) => {
				setHeader({
					audit_date: data.form.audit_date,
					aircraft_tail: data.form.aircraft_tail,
					flight_no: data.form.flight_no ?? "",
					route: data.form.route ?? "",
					ca_name: data.form.ca_name ?? "",
					fo_name: data.form.fo_name ?? "",
					cabin_crew: data.form.cabin_crew ?? [],
				});
				setComments(data.form.comments ?? "");
				setMainTemplate({
					id: data.form.template_id,
					items: data.main.map((i: any) => ({ item_no: i.item_no, category: i.category, item_text: i.item_text, ccom_ref: i.ccom_ref, standard_text: i.standard_text })),
				});
				const mainAns: Record<number, ItemAnswer> = {};
				for (const i of data.main) mainAns[i.item_no] = { result: i.result, remark: i.remark ?? "" };
				setMainAnswers(mainAns);

				setFocusSetId(data.form.focus_set_id ?? null);
				setFocusItems(data.focus.map((i: any) => ({ item_no: i.item_no, item_text: i.item_text })));
				const focusAns: Record<number, ItemAnswer> = {};
				for (const i of data.focus) focusAns[i.item_no] = { result: i.result, remark: i.remark ?? "" };
				setFocusAnswers(focusAns);

				setAttachments(
					(data.attachments ?? []).map((att: any) => {
						const answers: Record<number, ItemAnswer> = {};
						for (const i of att.items) answers[i.item_no] = { result: i.result, remark: i.remark ?? "" };
						return {
							id: att.id, // assumed present in the detail response — a real PK on a table this route already joins against
							template_id: att.template_id,
							subject_crew_name: att.subject_crew_name,
							subject_employee_id: att.subject_employee_id,
							answers,
						};
					}),
				);
			})
			.catch((e) => setLoadError(e.message ?? "載入失敗"));
	}, [existingFormId, token]);

	function handleSaveDraft() {
		saveDraft({ header, mainAnswers, focusAnswers, attachments, comments });
		setDraftSaved(true);
		setTimeout(() => setDraftSaved(false), 2000);
	}

	// ---- load main template (skipped in edit mode) ----
	useEffect(() => {
		if (!token || existingFormId) return;
		fetch("/api/audit/routine/checklist-template", { headers: { Authorization: `Bearer ${token}` } })
			.then((r) => r.json())
			.then((data) => setMainTemplate({ id: data.template.id, items: data.items }));
	}, [token, existingFormId]);

	// ---- load the focus set for whichever month the audit_date falls in —
	// NOT the server's real current month. Re-fetches whenever the entered
	// date's month/year changes, not just once on mount.
	const [focusLoadError, setFocusLoadError] = useState<string | null>(null);
	useEffect(() => {
		if (!token || existingFormId || !header.audit_date) return;
		// parse "YYYY-MM-DD" directly — new Date(str).getFullYear()/getMonth()
		// parses the string as UTC but reads it back in local time, which
		// silently shifts the month by one in any timezone behind UTC
		const [y, m] = header.audit_date.split("-").map(Number);
		let cancelled = false;
		setFocusLoadError(null);
		fetch(`/api/audit/routine/monthly-focus?year=${y}&month=${m}`, { headers: { Authorization: `Bearer ${token}` } })
			.then(async (r) => {
				const data = await r.json();
				if (!r.ok) throw new Error(data.error ?? `載入本月重點失敗 (${r.status})`);
				return data;
			})
			.then((data) => {
				if (cancelled) return; // audit_date changed again before this resolved — don't let a stale response clobber the newer request's result
				setFocusSetId(data.focusSet?.id ?? null);
				setFocusItems(data.items ?? []);
				const withAttachment = (data.items ?? []).find((i: any) => i.required_attachment_template_id);
				setSuggestedAttachmentId(withAttachment?.required_attachment_template_id ?? null);
			})
			.catch((e) => {
				if (!cancelled) setFocusLoadError(e.message ?? "載入本月重點失敗");
			});
		return () => {
			cancelled = true;
		};
	}, [token, existingFormId, header.audit_date]);

	// attachment templates are needed in both modes — edit mode still needs
	// their item lists to render each attachment's checklist
	useEffect(() => {
		if (!token) return;
		fetch("/api/audit/routine/checklist-template?type=attachment", { headers: { Authorization: `Bearer ${token}` } })
			.then((r) => r.json())
			.then((data) => setAttachmentTemplates(data.templates ?? []));
	}, [token]);

	// ---- offline detection + auto-flush on reconnect ----
	const flushQueue = useCallback(async () => {
		if (!token) return;
		const queued = await listQueuedSubmissions();
		for (const payload of queued) {
			try {
				const res = await fetch("/api/audit/routine/self-inspection", {
					method: "POST",
					headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
					body: JSON.stringify(payload),
				});
				if (res.ok) await removeQueuedSubmission(payload.client_uuid as string);
				// non-ok responses stay queued — retried on the next flush rather than dropped
			} catch {
				break; // still offline or request failed — stop, retry later
			}
		}
	}, [token]);

	useEffect(() => {
		function goOnline() {
			setOffline(false);
			flushQueue();
		}
		function goOffline() {
			setOffline(true);
		}
		window.addEventListener("online", goOnline);
		window.addEventListener("offline", goOffline);
		flushQueue(); // also try once on mount, in case something was queued from a previous session
		return () => {
			window.removeEventListener("online", goOnline);
			window.removeEventListener("offline", goOffline);
		};
	}, [flushQueue]);

	const cabinCrewOptions = header.cabin_crew.filter((c) => c.name).map((c) => ({ name: c.name, employee_id: c.employee_id }));

	function validate(): string | null {
		if (!header.audit_date || !header.aircraft_tail || !header.ca_name) return "請完成基本資料";
		if (!mainTemplate) return "查核表尚未載入完成";
		if (mainTemplate.items.some((i) => !mainAnswers[i.item_no]?.result)) return "尚有查核項目未完成";
		for (const att of attachments) {
			if (!att.subject_crew_name) return "附加查核尚未選擇受檢人員";
			const templateData = attachmentTemplates.find((t) => t.template.id === att.template_id);
			if (templateData && templateData.items.some((i) => !att.answers[i.item_no]?.result)) {
				return `${templateData.template.name}尚有項目未完成`;
			}
		}
		if (!comments.trim()) return "請填寫查核結果及建議";
		return null;
	}

	async function handleSubmit() {
		const error = validate();
		if (error) {
			setSubmitError(error);
			setAttemptedSubmit(true);
			return;
		}
		setSubmitError(null);
		setSubmitting(true);

		const clientUuid = crypto.randomUUID();
		const payload = {
			client_uuid: clientUuid,
			existing_form_id: existingFormId ?? undefined,
			audit_date: header.audit_date,
			aircraft_tail: header.aircraft_tail,
			flight_no: header.flight_no || null,
			route: header.route || null,
			ca_name: header.ca_name,
			fo_name: header.fo_name || null,
			cabin_crew: header.cabin_crew,
			template_id: mainTemplate!.id,
			focus_set_id: focusSetId,
			comments,
			items: [
				...Object.entries(mainAnswers).map(([itemNo, a]) => ({
					item_type: "main",
					item_no: Number(itemNo),
					result: a.result,
					remark: a.remark || null,
				})),
				...Object.entries(focusAnswers).map(([itemNo, a]) => ({
					item_type: "focus",
					item_no: Number(itemNo),
					result: a.result,
					remark: a.remark || null,
				})),
			],
			attachments: attachments.map((att) => ({
				template_id: att.template_id,
				subject_crew_name: att.subject_crew_name,
				subject_employee_id: att.subject_employee_id,
				items: Object.entries(att.answers).map(([itemNo, a]) => ({
					item_no: Number(itemNo),
					result: a.result,
					remark: a.remark || null,
				})),
			})),
		};

		if (!navigator.onLine) {
			// no point attempting the request — queue immediately
			await queueSubmission(payload);
			await clearDraft();
			onSubmitted();
			setSubmitting(false);
			return;
		}

		try {
			const res = await fetch("/api/audit/routine/self-inspection", {
				method: "POST",
				headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
				body: JSON.stringify(payload),
			});
			if (!res.ok) {
				// server actually responded and rejected it — a real error to
				// show the user, NOT a network failure. Queuing this would
				// just retry the same rejected request forever.
				const data = await res.json();
				setSubmitError(data.error ?? "送出失敗");
				setSubmitting(false);
				return;
			}
			await clearDraft();
			onSubmitted();
		} catch {
			// fetch itself threw — genuine network failure (dropped
			// connection, DNS failure, timeout), not a server rejection
			await queueSubmission(payload);
			await clearDraft();
			onSubmitted();
		} finally {
			setSubmitting(false);
		}
	}

	return (
		<div className={styles.panel}>
			<div className={styles.header}>
				<span className={styles.title}>{existingFormId ? "編輯自我督察表" : "自我督察表"}</span>
				<button className={styles.closeBtn} onClick={onClose}>
					✕
				</button>
			</div>

			<div className={styles.body}>
				{pendingDraft && (
					<div className={styles.draftBanner}>
						<div className={styles.draftBannerText}>
							<span className={styles.draftBannerIcon}>💾</span>
							<div>
								<p className={styles.draftBannerTitle}>您的資料已安全儲存</p>
								<p className={styles.draftBannerSubtitle}>偵測到上次未完成的草稿，是否要繼續填寫？</p>
							</div>
						</div>
						<div className={styles.draftBannerActions}>
							<button className={styles.draftBannerResumeBtn} onClick={resumeDraft}>
								繼續填寫
							</button>
							<button className={styles.draftBannerDiscardBtn} onClick={discardDraft}>
								捨棄
							</button>
						</div>
					</div>
				)}
				{loadError && <p className={styles.error}>{loadError}</p>}

				<Section title="基本資料">
					<CrewRosterFields value={header} onChange={setHeader} showErrors={attemptedSubmit} />
				</Section>

				{mainTemplate && (
					<>
						<ChecklistItemList
							items={mainTemplate.items.filter((i) => i.category === "一、安全").map((i) => ({ ...i, category: null }))}
							answers={mainAnswers}
							onAnswerChange={(itemNo, result, remark) =>
								setMainAnswers((prev) => ({ ...prev, [itemNo]: { result, remark } }))
							}
							title="一、安全"
							showErrors={attemptedSubmit}
						/>
						<ChecklistItemList
							items={mainTemplate.items.filter((i) => i.category === "二、服務").map((i) => ({ ...i, category: null }))}
							answers={mainAnswers}
							onAnswerChange={(itemNo, result, remark) =>
								setMainAnswers((prev) => ({ ...prev, [itemNo]: { result, remark } }))
							}
							title="二、服務"
							showErrors={attemptedSubmit}
						/>
					</>
				)}

				{focusLoadError && <p className={styles.error}>{focusLoadError}</p>}

				{focusItems.length > 0 && (
					<ChecklistItemList
						items={focusItems}
						answers={focusAnswers}
						onAnswerChange={(itemNo, result, remark) =>
							setFocusAnswers((prev) => ({ ...prev, [itemNo]: { result, remark } }))
						}
						title="本月加強重點檢查"
						showErrors={attemptedSubmit}
					/>
				)}

				<Section title="附加查核">
					<AttachmentPicker
						templates={attachmentTemplates}
						cabinCrewOptions={cabinCrewOptions}
						suggestedTemplateId={suggestedAttachmentId}
						formId={existingFormId}
						value={attachments}
						onChange={setAttachments}
						showErrors={attemptedSubmit}
					/>
				</Section>

				<div className={styles.commentSection}>
					<p className={styles.commentLabel}>查核結果及建議 *</p>
					<textarea
						className={attemptedSubmit && !comments.trim() ? styles.commentInputError : styles.commentInput}
						value={comments}
						onChange={(e) => setComments(e.target.value)}
						rows={3}
					/>
				</div>
			</div>

			{submitError && <p className={styles.error}>{submitError}</p>}

			<div className={styles.footer}>
				{!existingFormId && (
					<button className={styles.draftBtn} onClick={handleSaveDraft}>
						{draftSaved ? "已儲存 ✓" : "儲存草稿"}
					</button>
				)}
				<button className={styles.submitBtn} disabled={submitting} onClick={handleSubmit}>
					{submitting ? "處理中..." : existingFormId ? "儲存變更" : offline ? "送出（尚未連線，將於恢復後自動同步）" : "送出"}
				</button>
			</div>
		</div>
	);
}