// src/components/tasks/TimelineControls.tsx - UPDATED: SMS Dark Theme styling
import React from "react";
import { ZoomLevel } from "@/lib/task.types";

interface TimelineControlsProps {
	zoomLevel: ZoomLevel;
	setZoomLevel: (level: ZoomLevel) => void;
	onNavigatePrevious: () => void;
	onNavigateNext: () => void;
	onGoToToday: () => void;
	taskCount: number;
	dateRangeLength: number;
}

const TimelineControls: React.FC<TimelineControlsProps> = ({
	zoomLevel,
	setZoomLevel,
	onNavigatePrevious,
	onNavigateNext,
	onGoToToday,
	taskCount,
	dateRangeLength,
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
				gap: "1rem",
				flexWrap: "wrap",
				flex: 1,
			}}
		>
			<div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
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
							background: "rgba(51, 65, 85, 0.5)",
							border: "1px solid rgba(148, 163, 184, 0.3)",
							borderRadius: "0.5rem",
							padding: "0.5rem 0.75rem",
							cursor: "pointer",
							fontSize: "0.875rem",
							color: "#cbd5e1",
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							transition: "all 0.2s",
							fontWeight: "600",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.background = "rgba(71, 85, 105, 0.6)";
							e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.5)";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.background = "rgba(51, 65, 85, 0.5)";
							e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.3)";
						}}
					>
						← Previous {getNavigationLabel()}
					</button>

					<button
						onClick={onGoToToday}
						style={{
							background: "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)",
							color: "white",
							border: "none",
							borderRadius: "0.5rem",
							padding: "0.5rem 0.75rem",
							cursor: "pointer",
							fontSize: "0.875rem",
							fontWeight: "600",
							transition: "all 0.2s",
							boxShadow: "0 2px 8px rgba(59, 130, 246, 0.3)",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.transform = "translateY(-1px)";
							e.currentTarget.style.boxShadow = "0 4px 12px rgba(59, 130, 246, 0.4)";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.transform = "translateY(0)";
							e.currentTarget.style.boxShadow = "0 2px 8px rgba(59, 130, 246, 0.3)";
						}}
					>
						Today
					</button>

					<button
						onClick={onNavigateNext}
						style={{
							background: "rgba(51, 65, 85, 0.5)",
							border: "1px solid rgba(148, 163, 184, 0.3)",
							borderRadius: "0.5rem",
							padding: "0.5rem 0.75rem",
							cursor: "pointer",
							fontSize: "0.875rem",
							color: "#cbd5e1",
							display: "flex",
							alignItems: "center",
							gap: "0.5rem",
							transition: "all 0.2s",
							fontWeight: "600",
						}}
						onMouseEnter={(e) => {
							e.currentTarget.style.background = "rgba(71, 85, 105, 0.6)";
							e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.5)";
						}}
						onMouseLeave={(e) => {
							e.currentTarget.style.background = "rgba(51, 65, 85, 0.5)";
							e.currentTarget.style.borderColor = "rgba(148, 163, 184, 0.3)";
						}}
					>
						Next {getNavigationLabel()} →
					</button>
				</div>

				{/* Zoom Level Selector */}
				<div
					style={{
						display: "flex",
						background: "rgba(51, 65, 85, 0.5)",
						borderRadius: "0.5rem",
						padding: "0.25rem",
						border: "1px solid rgba(148, 163, 184, 0.2)",
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
										? "linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)"
										: "transparent",
								color:
									zoomLevel === level ? "white" : "#94a3b8",
								boxShadow:
									zoomLevel === level
										? "0 2px 8px rgba(59, 130, 246, 0.3)"
										: "none",
								textTransform: "capitalize",
							}}
						>
							{level}
						</button>
					))}
				</div>
			</div>

			{/* Info Display */}
			<div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
				<div style={{ fontSize: "0.875rem", color: "#94a3b8", fontWeight: "600" }}>
					View: {zoomLevel} • {taskCount} tasks
				</div>

				{/* View Range Indicator */}
				<div
					style={{
						background: "rgba(51, 65, 85, 0.5)",
						borderRadius: "0.375rem",
						padding: "0.25rem 0.5rem",
						fontSize: "0.75rem",
						color: "#cbd5e1",
						fontWeight: "600",
						border: "1px solid rgba(148, 163, 184, 0.2)",
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
						`View: ${zoomLevel}`
					)}
				</div>
			</div>
		</div>
	);
};

export default TimelineControls;