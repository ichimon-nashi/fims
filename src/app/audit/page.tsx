// src/app/audit/page.tsx
"use client";

import { useRouter } from "next/navigation";
import Image from "next/image";

const AUDIT_TYPES = [
	{
		href: "/audit/routine",
		icon: "/images/routineicon.png",
		title: "例行性查核",
		desc: "每月至少11次",
	},
	{
		href: "/audit/firstlevel",
		icon: "/images/firstlevelicon.png",
		title: "一級查核",
		desc: "每半年一次",
	},
	{
		href: "/audit/iosa",
		icon: "/images/iosaicon.png",
		title: "IOSA 查核",
		desc: "每兩年一次",
	},
];

export default function AuditIndexPage() {
	const router = useRouter();

	return (
		<div
			style={{
				flex: 1,
				display: "flex",
				flexDirection: "column",
				alignItems: "center",
				justifyContent: "center",
				padding: "2rem 1rem",
				gap: "2rem",
				minHeight: "calc(100vh - 60px)",
			}}
		>
			<div style={{ textAlign: "center" }}>
				<h1
					style={{
						fontSize: "1.75rem",
						fontWeight: 700,
						color: "#e8e9ed",
						margin: "0 0 0.375rem",
					}}
				>
					查核系統
				</h1>
				<p
					style={{
						fontSize: "0.9375rem",
						color: "#a0aec0",
						margin: 0,
					}}
				>
					Audit Management System
				</p>
			</div>

			<div
				style={{
					display: "flex",
					gap: "1.5rem",
					flexWrap: "wrap",
					justifyContent: "center",
					width: "100%",
					maxWidth: "860px",
				}}
			>
				{AUDIT_TYPES.map((a) => (
					<div
						key={a.href}
						onClick={() => router.push(a.href)}
						style={{
							flex: "1",
							minWidth: "220px",
							maxWidth: "260px",
							background: "rgba(255,255,255,0.04)",
							border: "1px solid rgba(255,255,255,0.08)",
							borderRadius: "14px",
							padding: "2rem 1.5rem",
							display: "flex",
							flexDirection: "column",
							alignItems: "center",
							gap: "1rem",
							cursor: "pointer",
							textAlign: "center",
							transition:
								"background 0.18s, border-color 0.18s, transform 0.18s",
						}}
						onMouseEnter={(e) => {
							const el = e.currentTarget as HTMLDivElement;
							el.style.background = "rgba(74,158,255,0.08)";
							el.style.borderColor = "rgba(74,158,255,0.35)";
							el.style.transform = "translateY(-2px)";
						}}
						onMouseLeave={(e) => {
							const el = e.currentTarget as HTMLDivElement;
							el.style.background = "rgba(255,255,255,0.04)";
							el.style.borderColor = "rgba(255,255,255,0.08)";
							el.style.transform = "translateY(0)";
						}}
					>
						<Image
							src={a.icon}
							alt={a.title}
							width={80}
							height={80}
							style={{ objectFit: "contain" }}
						/>
						<h2
							style={{
								fontSize: "1.125rem",
								fontWeight: 600,
								color: "#e8e9ed",
								margin: 0,
							}}
						>
							{a.title}
						</h2>
						<p
							style={{
								fontSize: "0.9375rem",
								color: "#a0aec0",
								margin: 0,
							}}
						>
							{a.desc}
						</p>
					</div>
				))}
			</div>
		</div>
	);
}
