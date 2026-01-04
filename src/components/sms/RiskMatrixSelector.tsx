// src/components/sms/RiskMatrixSelector.tsx
"use client";

import { useState } from "react";
import styles from "./RiskMatrixSelector.module.css";

interface RiskMatrixSelectorProps {
	value: string;
	onChange: (value: string) => void;
	label: string;
	required?: boolean;
	isOpen?: boolean;
	onToggle?: () => void;
}

const RISK_MATRIX = {
	likelihood: ["1", "2", "3", "4", "5"],
	likelihoodLabels: {
		"1": "Extremely Improbable",
		"2": "Improbable",
		"3": "Remote",
		"4": "Occasional",
		"5": "Frequent",
	},
	severity: ["A", "B", "C", "D", "E"],
	severityLabels: {
		A: "Catastrophic",
		B: "Critical",
		C: "Marginal",
		D: "Minor",
		E: "Negligible",
	},
	severityScores: { A: 5, B: 3, C: 2, D: 1, E: 0.5 },
};

export default function RiskMatrixSelector({
	value,
	onChange,
	label,
	required = false,
	isOpen,
	onToggle,
}: RiskMatrixSelectorProps) {
	const [internalShowMatrix, setInternalShowMatrix] = useState(false);

	// Use external control if provided, otherwise use internal state
	const showMatrix = isOpen !== undefined ? isOpen : internalShowMatrix;
	const toggleMatrix = () => {
		if (onToggle) {
			onToggle();
		} else {
			setInternalShowMatrix(!internalShowMatrix);
		}
	};

	const getRiskColor = (likelihood: string, severity: string) => {
		// Based on the risk matrix from Word document
		const l = parseInt(likelihood);
		const sIndex = severity.charCodeAt(0) - "A".charCodeAt(0);

		// High Risk (Red) - #DC2626
		if (
			(l === 5 && sIndex <= 2) || // 5A, 5B, 5C
			(l === 4 && sIndex <= 1) || // 4A, 4B
			(l === 3 && sIndex === 0)
		) {
			// 3A
			return "#DC2626";
		}

		// Medium Risk (Orange/Yellow) - #F59E0B
		if (
			(l === 5 && sIndex === 3) || // 5D
			(l === 4 && sIndex === 2) || // 4C
			(l === 3 && sIndex === 1) || // 3B
			(l === 3 && sIndex === 2) || // 3C
			(l === 2 && sIndex === 0) || // 2A
			(l === 2 && sIndex === 1) || // 2B
			(l === 1 && sIndex === 0)
		) {
			// 1A
			return "#F59E0B";
		}

		// Low Risk (Green) - #10B981
		// Includes: 4D, 4E, 5E, 3D, 3E, 2C, 2D, 2E, 1B, 1C, 1D, 1E
		return "#10B981";
	};

	const getScore = (likelihood: string, severity: string) => {
		const l = parseInt(likelihood);
		const s =
			RISK_MATRIX.severityScores[
				severity as keyof typeof RISK_MATRIX.severityScores
			];
		return l * s;
	};

	const handleSelect = (likelihood: string, severity: string) => {
		onChange(`${likelihood}${severity}`);
		if (onToggle) {
			onToggle(); // Close after selection
		} else {
			setInternalShowMatrix(false);
		}
	};

	return (
		<div className={styles.container}>
			<label>
				{label}
				{required && (
					<span style={{ color: "#ef4444", marginLeft: "4px" }}>
						*
					</span>
				)}
			</label>
			<div className={styles.inputGroup}>
				<input
					type="text"
					value={value}
					onChange={(e) => onChange(e.target.value.toUpperCase())}
					placeholder="例如: 3C"
					className={styles.input}
					maxLength={2}
				/>
				<button
					type="button"
					onClick={toggleMatrix}
					className={styles.matrixButton}
				>
					{showMatrix ? "關閉矩陣" : "選擇矩陣"}
				</button>
			</div>

			{showMatrix && (
				<div className={styles.matrixPanel}>
					<div className={styles.matrixGrid}>
						<div className={styles.matrixCorner}>
							<div>可能性→</div>
							<div>嚴重性↓</div>
						</div>
						{RISK_MATRIX.likelihood.map((l) => (
							<div key={l} className={styles.matrixHeader}>
								<div className={styles.headerNum}>{l}</div>
								<div className={styles.headerLabel}>
									{
										RISK_MATRIX.likelihoodLabels[
											l as keyof typeof RISK_MATRIX.likelihoodLabels
										]
									}
								</div>
							</div>
						))}

						{RISK_MATRIX.severity.map((severity) => (
							<>
								<div
									key={severity}
									className={styles.matrixRowHeader}
								>
									<div className={styles.headerNum}>
										{severity}/
										{
											RISK_MATRIX.severityScores[
												severity as keyof typeof RISK_MATRIX.severityScores
											]
										}
									</div>
									<div className={styles.headerLabel}>
										{
											RISK_MATRIX.severityLabels[
												severity as keyof typeof RISK_MATRIX.severityLabels
											]
										}
									</div>
								</div>
								{RISK_MATRIX.likelihood.map((likelihood) => {
									const score = getScore(
										likelihood,
										severity
									);
									return (
										<button
											key={`${likelihood}${severity}`}
											type="button"
											onClick={() =>
												handleSelect(
													likelihood,
													severity
												)
											}
											className={`${styles.matrixCell} ${
												value ===
												`${likelihood}${severity}`
													? styles.selected
													: ""
											}`}
											style={{
												backgroundColor: getRiskColor(
													likelihood,
													severity
												),
											}}
										>
											<div className={styles.cellCode}>
												{likelihood}
												{severity}
											</div>
											<div className={styles.cellScore}>
												({score})
											</div>
										</button>
									);
								})}
							</>
						))}
					</div>
				</div>
			)}
		</div>
	);
}
