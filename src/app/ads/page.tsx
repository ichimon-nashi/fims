// src/app/ads/page.tsx
"use client";

import PermissionGuard from "@/components/common/PermissionGuard";
import Navbar from "@/components/common/Navbar";
import AdS from "@/components/ads/AdS";

export default function AdSPage() {
	return (
		<PermissionGuard app="ads">
			<div
				style={{
					minHeight: "100vh",
					background: "linear-gradient(135deg, #1a1a2e 0%, #0f0f1e 100%)",
				}}
			>
				<Navbar />
				<AdS />
			</div>
		</PermissionGuard>
	);
}