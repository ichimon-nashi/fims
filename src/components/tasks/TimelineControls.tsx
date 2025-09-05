// src/components/tasks/TimelineControls.tsx - Fixed with proper dateRangeLength prop
import React from "react";
import { ZoomLevel } from "@/lib/task.types";

interface TimelineControlsProps {
	zoomLevel: ZoomLevel;
	setZoomLevel: (level: ZoomLevel) => void;
	onNavigatePrevious: () => void;
	onNavigateNext: () => void;
	onGoToToday: () => void;
	taskCount: number;
	dateRangeLength: number; // FIXED: Added missing prop
}

const TimelineControls: React.FC<TimelineControlsProps> = ({
	zoomLevel,
	setZoomLevel,
	onNavigatePrevious,
	onNavigateNext,
	onGoToToday,
	taskCount,
	dateRangeLength, // FIXED: Destructured the prop
}) => {
	const getNavigationLabel = () => {
		switch (zoomLevel) {
			case "days":
				return "Week";
			case "weeks":
				return "Month";
			case "months":
				return "Quarter";
			case "quarters":
				return "Year";
			default:
				return "Period";
		}
	};

	return (
		<div
			style={{
				display: "flex",
				justifyContent: "space-between",
				alignItems: "center",
				padding: "1rem",
				borderBottom: "1px solid #e5e7eb",
				background: "#f9fafb",
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
				{/* Navigation Controls */}
				<div
					style={{
						display: "flex",
						alignItems: "center",
						gap: "0.5rem",
					}}
				>
					<button
						onClick={onNavigatePrevious}
						style={{
							background: "#f3f4f6",
							border: "1px solid #d1d5db",
							borderRadius: "0.375rem",
							padding: "0.5rem 0.75rem",
							cursor: "pointer",
							fontSize: "0.875rem",
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							transition: "all 0.2s",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.background = "#e5e7eb";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.background = "#f3f4f6";
						}}
					>
						← Previous {getNavigationLabel()}
					</button>

					<button
						onClick={onGoToToday}
						style={{
							background: "#3b82f6",
							color: "white",
							border: "none",
							borderRadius: "0.375rem",
							padding: "0.5rem 0.75rem",
							cursor: "pointer",
							fontSize: "0.875rem",
							fontWeight: "600",
							transition: "all 0.2s",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.background = "#2563eb";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.background = "#3b82f6";
						}}
					>
						Today
					</button>

					<button
						onClick={onNavigateNext}
						style={{
							background: "#f3f4f6",
							border: "1px solid #d1d5db",
							borderRadius: "0.375rem",
							padding: "0.5rem 0.75rem",
							cursor: "pointer",
							fontSize: "0.875rem",
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							transition: "all 0.2s",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.background = "#e5e7eb";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.background = "#f3f4f6";
						}}
					>
						Next {getNavigationLabel()} →
					</button>
				</div>

				{/* Zoom Level Selector */}
				<div
					style={{
						display: "flex",
						background: "#f1f5f9",
						borderRadius: "0.5rem",
						padding: "0.25rem",
					}}
				>
					{(
						["days", "weeks", "months", "quarters"] as ZoomLevel[]
					).map((level) => (
						<button
							key={level}
							onClick={() => setZoomLevel(level)}
							style={{
								padding: "0.5rem 1rem",
								borderRadius: "0.375rem",
								fontSize: "0.875rem",
								fontWeight: "600",
								border: "none",
								cursor: "pointer",
								transition: "all 0.2s",
								background:
									zoomLevel === level
										? "white"
										: "transparent",
								color:
									zoomLevel === level ? "#3b82f6" : "#6b7280",
								boxShadow:
									zoomLevel === level
										? "0 1px 2px rgba(0,0,0,0.1)"
										: "none",
								textTransform: "capitalize",
							}}
						>
							{level}
						</button>
					))}
				</div>
			</div>

			{/* Info Display - FIXED: Proper conditional rendering */}
			<div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
				<div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
					View: {zoomLevel} • {taskCount} main tasks
				</div>

				{/* View Range Indicator - FIXED: Proper conditional and variable usage */}
				<div
					style={{
						background: "#e5e7eb",
						borderRadius: "0.375rem",
						padding: "0.25rem 0.5rem",
						fontSize: "0.75rem",
						color: "#6b7280",
						fontWeight: "500",
					}}
				>
					{dateRangeLength > 0 ? (
						<>
							{zoomLevel === "days" && `${dateRangeLength} days`}
							{zoomLevel === "weeks" && `${dateRangeLength} weeks`}
							{zoomLevel === "months" && `${dateRangeLength} months`}
							{zoomLevel === "quarters" && `${dateRangeLength} quarters`}
						</>
					) : (
						// Fallback to show current zoom level
						`View: ${zoomLevel}`
					)}
				</div>
			</div>
		</div>
	);
};

export default TimelineControls;