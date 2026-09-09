// src/components/audit/routine/FatigueFileManager.tsx
"use client";

import { useEffect, useState } from "react";
import styles from "./PendingReviewList.module.css"; // reuses the uploads-list styling already built there
import { useAuth } from "@/context/AuthContext";

interface UploadRecord {
	id: string;
	form_id: string;
	item_no: number;
	display_filename: string;
	uploaded_at: string;
	audit_date: string | null;
	aircraft_tail: string | null;
	status: string | null;
}

export default function FatigueFileManager({ onClose }: { onClose: () => void }) {
	const { token } = useAuth();
	const [uploads, setUploads] = useState<UploadRecord[]>([]);
	const [loading, setLoading] = useState(true);
	const [search, setSearch] = useState("");

	useEffect(() => {
		if (!token) return;
		fetch("/api/audit/routine/fatigue-uploads", { headers: { Authorization: `Bearer ${token}` } })
			.then((r) => r.json())
			.then((data) => setUploads(data.uploads ?? []))
			.finally(() => setLoading(false));
	}, [token]);

	async function download(u: UploadRecord) {
		const res = await fetch(`/api/audit/routine/self-inspection/${u.form_id}/fatigue-upload/${u.id}`, {
			headers: { Authorization: `Bearer ${token}` },
		});
		if (!res.ok) return;
		const blob = await res.blob();
		const blobUrl = URL.createObjectURL(blob);
		const a = document.createElement("a");
		a.href = blobUrl;
		a.download = u.display_filename;
		a.click();
		URL.revokeObjectURL(blobUrl);
	}

	const q = search.trim().toLowerCase();
	const filtered = q
		? uploads.filter((u) =>
				[u.display_filename, u.aircraft_tail ?? "", u.audit_date ?? ""].join(" ").toLowerCase().includes(q),
			)
		: uploads;

	return (
		<div style={{ padding: 16 }}>
			<div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
				<span style={{ fontSize: "1.0625rem", fontWeight: 600, color: "#e8e9ed" }}>附表文件總覽</span>
				<button onClick={onClose} style={{ background: "none", border: "none", color: "#e8e9ed", fontSize: 20, cursor: "pointer" }}>
					✕
				</button>
			</div>

			<input
				placeholder="搜尋檔名、機號、日期..."
				value={search}
				onChange={(e) => setSearch(e.target.value)}
				style={{
					width: "100%",
					marginBottom: 16,
					background: "rgba(255,255,255,0.05)",
					border: "1px solid rgba(232,233,237,0.15)",
					borderRadius: 8,
					color: "#e8e9ed",
					padding: "8px 12px",
					fontSize: "0.875rem",
					boxSizing: "border-box",
				}}
			/>

			{loading ? (
				<p className={styles.status}>載入中...</p>
			) : filtered.length === 0 ? (
				<p className={styles.status}>{q ? "查無符合的檔案" : "尚無任何上傳檔案"}</p>
			) : (
				<div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
					{filtered.map((u) => (
						<div
							key={u.id}
							style={{
								display: "flex",
								justifyContent: "space-between",
								alignItems: "center",
								gap: 12,
								background: "rgba(255,255,255,0.03)",
								border: "1px solid rgba(232,233,237,0.1)",
								borderRadius: 8,
								padding: "10px 14px",
							}}
						>
							<div>
								<div style={{ color: "#e8e9ed", fontSize: "0.875rem", fontWeight: 500 }}>{u.display_filename}</div>
								<div style={{ color: "rgba(232,233,237,0.5)", fontSize: "0.75rem", marginTop: 2 }}>
									{u.audit_date ?? "—"} · {u.aircraft_tail ?? "—"} · {u.status === "approved" ? "已核准" : "待審核"}
								</div>
							</div>
							<button className={styles.uploadLink} onClick={() => download(u)}>
								⬇ 下載
							</button>
						</div>
					))}
				</div>
			)}
		</div>
	);
}