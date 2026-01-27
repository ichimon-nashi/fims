// src/app/bc-training/page.tsx
"use client";

import PermissionGuard from "@/components/common/PermissionGuard";
import BusinessClass from "@/components/bc-training/BusinessClass";

export default function BCTrainingPage() {
	return (
		<PermissionGuard app="bc_training">
			<BusinessClass />
		</PermissionGuard>
	);
}