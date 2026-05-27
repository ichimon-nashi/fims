// src/app/audit/iosa/page.tsx
"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import IOSAPage from "@/components/audit/iosa/IOSAPage";
import styles from "./iosa.module.css";

export default function IOSAAuditPage() {
	const { user, loading, token } = useAuth();
	const router = useRouter();

	useEffect(() => {
		if (!loading && (!user || !token)) {
			router.replace("/login");
		}
	}, [user, token, loading, router]);

	if (loading) {
		return (
			<div className={styles.pageShell}>
				<div className={styles.loadingCenter}>
					<div className={styles.spinner} />
				</div>
			</div>
		);
	}

	if (!user || !token) return null;

	return <IOSAPage />;
}
