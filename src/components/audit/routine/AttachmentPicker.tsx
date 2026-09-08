// src/components/audit/routine/AttachmentPicker.tsx
"use client";

import { useState, useEffect } from "react";
import styles from "./AttachmentPicker.module.css";
import ChecklistItemList, { ChecklistItem, ItemAnswer } from "./ChecklistItemList";
import { ItemResult } from "./ChecklistItemRow";
import { useAuth } from "@/context/AuthContext";

interface Template {
	id: string;
	code: string;
	name: string;
	always_required: boolean;
}

export interface TemplateWithItems {
	template: Template;
	items: ChecklistItem[];
}

export interface AttachmentInstance {
	id?: string; // real audit_routine_form_attachments.id — only present once the form has been saved at least once; undefined for a brand-new, not-yet-saved attachment
	template_id: string;
	subject_crew_name: string;
	subject_employee_id?: string;
	answers: Record<number, ItemAnswer>;
}

interface Props {
	templates: TemplateWithItems[]; // fetched by the parent, alongside main/focus templates
	cabinCrewOptions: { employee_id?: string; name: string }[]; // ALL attachments are cabin-crew-only per instruction — flight crew names are record-keeping only, never audited against
	suggestedTemplateId?: string | null; // from this month's monthly_focus_items.required_attachment_template_id
	formId?: string; // existingFormId from the parent — undefined for a brand-new, not-yet-saved form. Upload UI needs this plus instance.id, so it only shows once both the form and its attachments have real DB rows.
	value: AttachmentInstance[];
	onChange: (value: AttachmentInstance[]) => void;
	showErrors?: boolean; // true after a failed submit attempt — validates each attachment's own items too
}

// distinct accent color per attachment type, so fatigue/C-EFB/future
// attachment types are visually distinguishable at a glance
const TEMPLATE_ACCENT_COLORS: Record<string, string> = {
	fatigue: "#4a9eff",
	c_efb: "#1baf7a",
};
function templateAccentColor(code: string): string {
	return TEMPLATE_ACCENT_COLORS[code] ?? "#fb923c";
}

export default function AttachmentPicker({ templates, cabinCrewOptions, suggestedTemplateId, formId, value, onChange, showErrors }: Props) {
	const { token } = useAuth();
	const [uploadedFiles, setUploadedFiles] = useState<Record<string, { item_no: number; display_filename: string; id: string }[]>>({});
	const [uploadingSlot, setUploadingSlot] = useState<string | null>(null); // `${attachmentId}-${itemNo}` while a slot is uploading
	const [uploadError, setUploadError] = useState<string | null>(null);

	// load already-uploaded files once we have a real form to ask about
	useEffect(() => {
		if (!formId || !token) return;
		fetch(`/api/audit/routine/self-inspection/${formId}/fatigue-upload`, {
			headers: { Authorization: `Bearer ${token}` },
		})
			.then((r) => r.json())
			.then((data) => {
				const byAttachment: Record<string, { item_no: number; display_filename: string; id: string }[]> = {};
				for (const u of data.uploads ?? []) {
					(byAttachment[u.attachment_id] ??= []).push({ item_no: u.item_no, display_filename: u.display_filename, id: u.id });
				}
				setUploadedFiles(byAttachment);
			});
	}, [formId, token]);

	async function handleFileUpload(attachmentId: string, itemNo: number, file: File) {
		if (!formId || !token) return;
		const slotKey = `${attachmentId}-${itemNo}`;
		setUploadingSlot(slotKey);
		setUploadError(null);
		try {
			const formData = new FormData();
			formData.append("file", file);
			formData.append("attachment_id", attachmentId);
			formData.append("item_no", String(itemNo));
			const res = await fetch(`/api/audit/routine/self-inspection/${formId}/fatigue-upload`, {
				method: "POST",
				headers: { Authorization: `Bearer ${token}` },
				body: formData,
			});
			const data = await res.json();
			if (!res.ok) throw new Error(data.error ?? "上傳失敗");
			setUploadedFiles((prev) => ({
				...prev,
				[attachmentId]: [
					...(prev[attachmentId] ?? []).filter((f) => f.item_no !== itemNo),
					{ item_no: itemNo, display_filename: data.display_filename, id: "" }, // real id not returned by POST — refetched on next load if needed for delete
				],
			}));
		} catch (e: any) {
			setUploadError(e.message ?? "上傳失敗");
		} finally {
			setUploadingSlot(null);
		}
	}
	const [pickerOpen, setPickerOpen] = useState(false);

	// always-required templates (fatigue) AND the monthly-focus-suggested
	// template both get auto-added and expanded on load — previously the
	// suggested one only showed as a "+ 新增此查核" prompt, which was an
	// extra click easy to skip and forget entirely. It's still removable
	// (unlike always_required) in case a specific audit genuinely doesn't
	// need it despite the month's general focus.
	useEffect(() => {
		const shouldAutoAdd = templates.filter(
			(t) => t.template.always_required || t.template.id === suggestedTemplateId,
		);
		const missing = shouldAutoAdd.filter((t) => !value.some((v) => v.template_id === t.template.id));
		if (missing.length > 0) {
			onChange([
				...value,
				...missing.map((t) => ({
					template_id: t.template.id,
					// C-EFB applies to the whole crew, not one selected person —
					// auto-filled so it's never blocked by the missing-subject check
					subject_crew_name: t.template.code === "c_efb" ? "全體組員" : "",
					answers: {},
				})),
			]);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [templates, suggestedTemplateId]);

	function addAttachment(templateId: string) {
		const t = templates.find((x) => x.template.id === templateId);
		onChange([
			...value,
			{
				template_id: templateId,
				subject_crew_name: t?.template.code === "c_efb" ? "全體組員" : "",
				answers: {},
			},
		]);
		setPickerOpen(false);
	}

	function removeAttachment(templateId: string) {
		onChange(value.filter((v) => v.template_id !== templateId));
	}

	function updateInstance(templateId: string, patch: Partial<AttachmentInstance>) {
		onChange(value.map((v) => (v.template_id === templateId ? { ...v, ...patch } : v)));
	}

	function setAnswer(templateId: string, itemNo: number, result: ItemResult | null, remark: string) {
		const instance = value.find((v) => v.template_id === templateId);
		if (!instance) return;
		updateInstance(templateId, { answers: { ...instance.answers, [itemNo]: { result, remark } } });
	}

	const addedIds = new Set(value.map((v) => v.template_id));
	const remainingOptional = templates.filter(
		(t) => !t.template.always_required && !addedIds.has(t.template.id) && t.template.id !== suggestedTemplateId,
	);

	return (
		<div className={styles.wrap}>
			<p className={styles.title}>附加查核</p>

			{value.map((instance) => {
				const templateData = templates.find((t) => t.template.id === instance.template_id);
				if (!templateData) return null;
				const { template, items } = templateData;
				const missingSubject = showErrors && !instance.subject_crew_name;
				return (
					<div
						key={template.id}
						className={
							missingSubject
								? styles.cardError
								: template.always_required
									? styles.cardRequired
									: styles.cardOptional
						}
						style={{ borderLeft: `4px solid ${templateAccentColor(template.code)}` }}
					>
						<div className={styles.cardHeader}>
							<span className={styles.cardName}>{template.name}</span>
							{template.always_required ? (
								<span className={styles.badgeRequired}>每次必填</span>
							) : (
								<div className={styles.cardHeaderRight}>
									{template.id === suggestedTemplateId && (
										<span className={styles.badgeSuggested}>本月建議</span>
									)}
									<button className={styles.removeBtn} onClick={() => removeAttachment(template.id)}>
										移除
									</button>
								</div>
							)}
						</div>

						{template.code === "c_efb" ? (
							<p className={styles.subjectLabel}>受檢人員：全體客艙組員</p>
						) : (
							<>
								<p className={missingSubject ? styles.subjectLabelError : styles.subjectLabel}>
									受檢人員{missingSubject && " — 尚未選擇"}
								</p>
								<div className={styles.crewChips}>
									{cabinCrewOptions.map((c, i) => (
										<button
											key={i}
											className={instance.subject_crew_name === c.name ? styles.crewChipActive : styles.crewChip}
											onClick={() =>
												updateInstance(template.id, { subject_crew_name: c.name, subject_employee_id: c.employee_id })
											}
										>
											{c.employee_id ? `${c.employee_id}/` : ""}
											{c.name}
										</button>
									))}
								</div>
							</>
						)}

						{instance.subject_crew_name && (
							<ChecklistItemList
								items={items}
								answers={instance.answers}
								onAnswerChange={(itemNo, result, remark) => setAnswer(template.id, itemNo, result, remark)}
								showErrors={showErrors}
							/>
						)}

						{template.code === "fatigue" && instance.subject_crew_name && (
							<div className={styles.fatigueUploads}>
								<p className={styles.fatigueUploadsTitle}>附表文件上傳</p>
								{!instance.id || !formId ? (
									<p className={styles.fatigueUploadsNote}>請先儲存草稿後，才能上傳附表文件</p>
								) : (
									[
										{ itemNo: 12, label: "個人連續30天班表" },
										{ itemNo: 13, label: "個人連續30天報到資訊摘要" },
										{ itemNo: 14, label: "個人連續30天飛時清單" },
									].map(({ itemNo, label }) => {
										const slotKey = `${instance.id}-${itemNo}`;
										const uploaded = uploadedFiles[instance.id!]?.find((f) => f.item_no === itemNo);
										return (
											<div key={itemNo} className={styles.fatigueUploadRow}>
												<span className={styles.fatigueUploadLabel}>{label}</span>
												{uploaded ? (
													<span className={styles.fatigueUploadedName}>✓ {uploaded.display_filename}</span>
												) : (
													<span className={styles.fatigueUploadEmpty}>尚未上傳</span>
												)}
												<label className={styles.fatigueUploadBtn}>
													{uploadingSlot === slotKey ? "上傳中..." : uploaded ? "重新上傳" : "選擇檔案"}
													<input
														type="file"
														style={{ display: "none" }}
														disabled={uploadingSlot === slotKey}
														onChange={(e) => {
															const file = e.target.files?.[0];
															if (file) handleFileUpload(instance.id!, itemNo, file);
															e.target.value = "";
														}}
													/>
												</label>
											</div>
										);
									})
								)}
								{uploadError && <p className={styles.fatigueUploadError}>{uploadError}</p>}
							</div>
						)}
					</div>
				);
			})}

			{remainingOptional.length > 0 && (
				<>
					<button className={styles.moreBtn} onClick={() => setPickerOpen((v) => !v)}>
						+ 選擇其他查核附件
					</button>
					{pickerOpen && (
						<div className={styles.optionsList}>
							{remainingOptional.map((t) => (
								<button key={t.template.id} className={styles.optionRow} onClick={() => addAttachment(t.template.id)}>
									{t.template.name}
								</button>
							))}
						</div>
					)}
				</>
			)}
		</div>
	);
}