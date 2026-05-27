// src/app/audit/layout.tsx
"use client";

import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { usePermissions } from "@/hooks/usePermissions";
import { useRouter } from "next/navigation";
import Image from "next/image";
import Navbar from "@/components/common/Navbar";

export default function AuditLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { user, loading, token } = useAuth();
	const permissions = usePermissions();
	const router = useRouter();
	const [showContent, setShowContent] = useState(false);

	useEffect(() => {
		if (loading) return;
		if (!user || !token) {
			router.replace("/login");
			return;
		}
		if (!permissions.hasAppAccess("audit")) {
			router.replace("/dashboard");
			return;
		}
		// Brief loading screen like MDAfaat
		const t = setTimeout(() => setShowContent(true), 600);
		return () => clearTimeout(t);
	}, [user, loading, token, permissions]);

	// Loading screen — K-dogmatic style
	if (loading || !showContent) {
		return (
			<div
				style={{
					minHeight: "100vh",
					background:
						"linear-gradient(135deg, #1a1f35 0%, #2d3651 100%)",
					display: "flex",
					flexDirection: "column",
					alignItems: "center",
					justifyContent: "center",
					gap: "1.5rem",
				}}
			>
				<Image
					src="/K-dogmatic.png"
					alt="Loading"
					width={280}
					height={280}
					style={{
						objectFit: "contain",
						imageRendering: "pixelated",
					}}
					priority
					unoptimized
				/>
				<div
					style={{
						color: "#e8e9ed",
						fontSize: "1.125rem",
						fontWeight: 500,
					}}
				>
					查核系統載入中...
				</div>
				<div
					style={{
						width: 48,
						height: 48,
						border: "3px solid rgba(74,158,255,0.2)",
						borderTopColor: "#4a9eff",
						borderRadius: "50%",
						animation: "spin 0.8s linear infinite",
					}}
				/>
				<style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
			</div>
		);
	}

	return (
		<div
			style={{
				minHeight: "100vh",
				background: "linear-gradient(135deg, #1a1f35 0%, #2d3651 100%)",
				display: "flex",
				flexDirection: "column",
			}}
		>
			<Navbar />
			{children}
		</div>
	);
}
