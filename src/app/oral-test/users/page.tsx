// src/app/oral-test/users/page.tsx
"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function UsersPageRedirect() {
	const router = useRouter();

	useEffect(() => {
		router.replace("/admin/users");
	}, [router]);

	return null;
}