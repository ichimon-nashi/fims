// src/app/ads/page.tsx
"use client";

import { useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import Navbar from "@/components/common/Navbar";
import AdS from "@/components/ads/AdS";

export default function AdSPage() {
	const { user, loading, token } = useAuth();
	const router = useRouter();

	// Redirect to login if not authenticated
	useEffect(() => {
		if (!loading && (!user || !token)) {
			router.replace("/login");
		}
	}, [user, token, loading, router]);

	// Show loading while checking auth
	if (loading) {
		return (
			<div
				style={{
					minHeight: "100vh",
					background:
						"linear-gradient(135deg, #1a1a2e 0%, #0f0f1e 100%)",
					display: "flex",
					alignItems: "center",
					justifyContent: "center",
					fontSize: "1.25rem",
					fontWeight: "600",
					color: "#06ffa5",
				}}
			>
				載入中...
			</div>
		);
	}

	// Don't render if no user (will redirect)
	if (!user || !token) {
		return null;
	}

	return (
		<div
			style={{
				minHeight: "100vh",
				background: "linear-gradient(135deg, #1a1a2e 0%, #0f0f1e 100%)",
			}}
		>
			<Navbar />
			<AdS />
		</div>
	);
}
