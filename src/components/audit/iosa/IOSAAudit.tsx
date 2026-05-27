// src/components/audit/iosa/IOSAAudit.tsx
// Placeholder — full implementation coming next
"use client";

interface ActiveCycle {
	id: string;
	name: string;
	disciplines: string[];
	ism_edition: string;
}

export default function IOSAAudit({
	activeCycle,
}: {
	activeCycle: ActiveCycle | null;
}) {
	return (
		<div
			style={{
				flex: 1,
				display: "flex",
				alignItems: "center",
				justifyContent: "center",
				color: "#a0aec0",
				fontSize: "0.875rem",
			}}
		>
			IOSAAudit — building next
		</div>
	);
}
