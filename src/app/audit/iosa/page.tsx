// src/app/audit/iosa/page.tsx
"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { usePermissions } from "@/hooks/usePermissions";
import IOSAPage from "@/components/audit/iosa/IOSAPage";
import styles from "./iosa.module.css";

export default function IOSAAuditPage() {
	const { user, loading, token } = useAuth();
	const permissions = usePermissions();
	const router = useRouter();
	const hasAccess = permissions.hasAuditTabAccess("iosa");

	useEffect(() => {
		if (loading) return;
		if (!user || !token) {
			router.replace("/login");
			return;
		}
		if (!hasAccess) {
			router.replace("/audit");
		}
	}, [user, token, loading, hasAccess, router]);

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
	if (!hasAccess) return null;

	return <IOSAPage />;
}