// src/components/audit/iosa/IOSAResults.tsx
// Placeholder — full implementation coming next
"use client";

interface ActiveCycle {
	id: string;
	name: string;
	disciplines: string[];
	ism_edition: string;
}

export default function IOSAResults({
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
			IOSAResults — building next
		</div>
	);
}
