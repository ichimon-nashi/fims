// src/app/audit/firstlevel/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { usePermissions } from "@/hooks/usePermissions";
import FirstLevelPage from "@/components/audit/firstlevel/FirstLevelPage";

export default function FirstLevelAuditPage() {
	const router = useRouter();
	const permissions = usePermissions();
	const hasAccess = permissions.hasAuditTabAccess("first_level");

	useEffect(() => {
		if (!hasAccess) router.replace("/audit");
	}, [hasAccess, router]);

	if (!hasAccess) return null;

	return <FirstLevelPage />;
}