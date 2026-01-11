// src/app/oral-test/ClientOralTestLayout.tsx
"use client";

import { AuthProvider } from "@/context/AuthContext";
import { useEffect } from "react";
import Navbar from "@/components/common/Navbar";

export default function ClientOralTestLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	useEffect(() => {
		console.log("Oral Test module loaded");
	}, []);

	return (
		<AuthProvider>
			<div 
				style={{
					minHeight: '100vh',
					background: 'linear-gradient(135deg, #1a1f35 0%, #2d3651 100%)',
				}}
			>
				<Navbar />
				<main>{children}</main>
			</div>
		</AuthProvider>
	);
}