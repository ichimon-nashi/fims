// src/app/audit/layout.tsx
"use client";

import Navbar from "@/components/common/Navbar";

export default function AuditLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<>
			<Navbar />
			{children}
		</>
	);
}
