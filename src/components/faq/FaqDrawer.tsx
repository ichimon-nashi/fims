// src/components/faq/FaqDrawer.tsx
"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { animate } from "animejs";
import Image from "next/image";
import { usePermissions } from "@/hooks/usePermissions";
import { useAuth } from "@/context/AuthContext";
import { APP_META } from "@/lib/appConfig";
import type { FaqType } from "@/lib/faq.types";
import { useFaq } from "./FaqProvider";
import styles from "./FaqDrawer.module.css";

interface Props {
	view: "index" | "app";
	appId: string | null;
	initialTab: FaqType;
	onClose: () => void;
	onSelectApp: (appId: string, tab?: FaqType) => void;
	onShowIndex: () => void;
}

export default function FaqDrawer({
	view, appId, initialTab, onClose, onSelectApp, onShowIndex,
}: Props) {
	const { entriesFor, loading } = useFaq();
	const permissions = usePermissions();
	const { user } = useAuth();
	const [tab, setTab] = useState<FaqType>(initialTab);
	const [expanded, setExpanded] = useState<Set<string>>(new Set());

	const toggleExpanded = (id: string) =>
		setExpanded((prev) => {
			const next = new Set(prev);
			if (next.has(id)) next.delete(id); else next.add(id);
			return next;
		});

	const scrimRef = useRef<HTMLDivElement>(null);
	const panelRef = useRef<HTMLDivElement>(null);
	const closingRef = useRef(false);

	useEffect(() => setTab(initialTab), [initialTab, appId]);

	// Enter
	useEffect(() => {
		if (scrimRef.current) animate(scrimRef.current, { opacity: [0, 1], duration: 240, ease: "out(2)" });
		if (panelRef.current)
			animate(panelRef.current, { opacity: [0, 1], translateX: [40, 0], duration: 420, ease: "out(3)" });
	}, []);

	// Exit, then unmount
	const close = () => {
		if (closingRef.current) return;
		closingRef.current = true;
		if (scrimRef.current) animate(scrimRef.current, { opacity: 0, duration: 200, ease: "in(2)" });
		if (panelRef.current) {
			animate(panelRef.current, {
				opacity: 0, translateX: 40, duration: 260, ease: "in(2)", onComplete: onClose,
			});
		} else onClose();
	};

	// Esc + scroll lock
	useEffect(() => {
		const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
		window.addEventListener("keydown", onKey);
		const prev = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			window.removeEventListener("keydown", onKey);
			document.body.style.overflow = prev;
		};
	}, []);

	// Apps the user can actually open — same gate as the quick-actions grid
	const visibleApps = useMemo(
		() =>
			APP_META.filter((a) => {
				if (a.id === "user-management" || a.id === "faq_admin") {
					return user?.employee_id === "admin" || user?.employee_id === "51892";
				}
				if (a.id === "dashboard") return true; // everyone lands here; no permission gate applies
				return permissions.hasAppAccess(a.id as any);
			}),
		[permissions, user]
	);

	const app = appId ? APP_META.find((a) => a.id === appId) ?? null : null;
	const entries = app ? entriesFor(app.id, tab) : [];

	return (
		<div className={styles.overlay} role="dialog" aria-modal="true" aria-label="使用說明">
			<div ref={scrimRef} className={styles.scrim} onClick={close} />

			<div ref={panelRef} className={styles.panel}>
				<div className={styles.header}>
					{app ? (
						<div className={styles.headerIcon} style={{ backgroundColor: `${app.color}22` }}>
							<Image src={app.icon} alt="" width={24} height={24} style={{ objectFit: "contain" }} />
						</div>
					) : (
						<div className={`${styles.headerIcon} ${styles.headerIconIndex}`}>?</div>
					)}

					<div className={styles.headerText}>
						<div className={styles.headerTitle}>{app ? app.title : "說明中心"}</div>
						<div className={styles.headerSub}>
							{app ? "使用說明與更新紀錄" : `${visibleApps.length} 個功能`}
						</div>
					</div>

					{view === "app" && (
						<button type="button" className={styles.ghostBtn} onClick={onShowIndex}>
							全部
						</button>
					)}
					<button type="button" className={styles.closeBtn} onClick={close} aria-label="關閉">
						×
					</button>
				</div>

				{view === "app" && (
					<div className={styles.tabs}>
						{(["說明", "更新"] as FaqType[]).map((t) => (
							<button
								key={t}
								type="button"
								className={`${styles.tab} ${tab === t ? styles.tabActive : ""}`}
								onClick={() => setTab(t)}
							>
								{t === "說明" ? "使用說明" : "更新紀錄"}
							</button>
						))}
					</div>
				)}

				<div className={styles.body}>
					{loading ? (
						<div className={styles.center}><div className={styles.spinner} /></div>
					) : view === "index" ? (
						<div className={styles.indexList}>
							{visibleApps.map((a) => {
								const guides = entriesFor(a.id, "說明").length;
								const updates = entriesFor(a.id, "更新").length;
								const bits = [];
								if (guides) bits.push(`${guides} 篇說明`);
								if (updates) bits.push(`${updates} 則更新`);
								return (
									<button
										key={a.id}
										type="button"
										className={styles.indexRow}
										onClick={() => onSelectApp(a.id)}
									>
										<div className={styles.indexIcon} style={{ backgroundColor: `${a.color}22` }}>
											<Image src={a.icon} alt="" width={20} height={20} style={{ objectFit: "contain" }} />
										</div>
										<div className={styles.indexText}>
											<div className={styles.indexTitle}>{a.title}</div>
											<div className={styles.indexMeta}>
												{bits.length ? bits.join("・") : "尚無說明"}
											</div>
										</div>
										<span className={styles.chevron}>›</span>
									</button>
								);
							})}
						</div>
					) : entries.length === 0 ? (
						<div className={styles.empty}>
							<div className={styles.emptyIcon}>📝</div>
							<div className={styles.emptyText}>
								此功能尚無{tab === "更新" ? "更新紀錄" : "使用說明"}
								<br />有問題請聯絡豪神
							</div>
						</div>
					) : (
						<div className={styles.entries}>
							{entries.map((entry) => {
								const isOpen = expanded.has(entry.id);
								return (
									<section key={entry.id} className={styles.entry}>
										<button
											type="button"
											className={styles.entryHead}
											onClick={() => toggleExpanded(entry.id)}
											aria-expanded={isOpen}
										>
											<span className={styles.entryTitle}>{entry.title}</span>
											<span
												className={`${styles.typeTag} ${
													entry.type === "更新" ? styles.typeUpdate : styles.typeGuide
												}`}
											>
												{entry.type}
											</span>
											<span className={`${styles.entryChevron} ${isOpen ? styles.entryChevronOpen : ""}`}>
												›
											</span>
										</button>

										{isOpen &&
											[...entry.sections]
												.sort((a, b) => a.sort_order - b.sort_order)
												.map((s, i) => (
													<div key={i} className={styles.section}>
														<div className={styles.stepNum}>{i + 1}</div>
														<div className={styles.stepBody}>
															<p className={styles.stepText}>{s.content}</p>
															{s.image_url && (
																<a
																	href={s.image_url}
																	target="_blank"
																	rel="noopener noreferrer"
																	className={styles.shotLink}
																>
																	{/* unoptimized: images live in Supabase storage */}
																	<img src={s.image_url} alt="" className={styles.shot} loading="lazy" />
																</a>
															)}
														</div>
													</div>
												))}
									</section>
								);
							})}

							<div className={styles.footNote}>
								找不到答案？請直接聯絡豪神，問題會被寫進這裡。
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
}
