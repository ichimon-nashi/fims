// src/components/audit/routine/AttachmentPicker.tsx
"use client";

import { useState, useEffect } from "react";
import styles from "./AttachmentPicker.module.css";
import ChecklistItemList, { ChecklistItem, ItemAnswer } from "./ChecklistItemList";
import { ItemResult } from "./ChecklistItemRow";

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
	template_id: string;
	subject_crew_name: string;
	subject_employee_id?: string;
	answers: Record<number, ItemAnswer>;
}

interface Props {
	templates: TemplateWithItems[]; // fetched by the parent, alongside main/focus templates
	cabinCrewOptions: { employee_id?: string; name: string }[]; // ALL attachments are cabin-crew-only per instruction — flight crew names are record-keeping only, never audited against
	suggestedTemplateId?: string | null; // from this month's monthly_focus_items.required_attachment_template_id
	value: AttachmentInstance[];
	onChange: (value: AttachmentInstance[]) => void;
	showErrors?: boolean; // true after a failed submit attempt — validates each attachment's own items too
}

export default function AttachmentPicker({ templates, cabinCrewOptions, suggestedTemplateId, value, onChange, showErrors }: Props) {
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
			onChange([...value, ...missing.map((t) => ({ template_id: t.template.id, subject_crew_name: "", answers: {} }))]);
		}
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [templates, suggestedTemplateId]);

	function addAttachment(templateId: string) {
		onChange([...value, { template_id: templateId, subject_crew_name: "", answers: {} }]);
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

						{instance.subject_crew_name && (
							<ChecklistItemList
								items={items}
								answers={instance.answers}
								onAnswerChange={(itemNo, result, remark) => setAnswer(template.id, itemNo, result, remark)}
								showErrors={showErrors}
							/>
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