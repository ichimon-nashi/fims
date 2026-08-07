// src/components/audit/routine/RoutineFilters.tsx

import { useRef } from "react";
import styles from "./RoutineFilters.module.css";

const MONTHS = ["1月","2月","3月","4月","5月","6月","7月","8月","9月","10月","11月","12月"];

interface Props {
	primaryYear: number;
	monthFrom: number;
	monthTo: number;
	onPrimaryYearChange: (year: number) => void;
	onMonthFromChange: (month: number) => void;
	onMonthToChange: (month: number) => void;
	onExport: () => void;
	onAddEntry: () => void;
	onImportFile: (file: File) => void;
	importing: boolean;
	availableYears: number[];
}

export default function RoutineFilters({
	availableYears,
	primaryYear,
	monthFrom,
	monthTo,
	onPrimaryYearChange,
	onMonthFromChange,
	onMonthToChange,
	onExport,
	onAddEntry,
	onImportFile,
	importing,
}: Props) {
	const fileInputRef = useRef<HTMLInputElement>(null);
	return (
		<div className={styles.bar}>
			<div className={styles.field}>
				<label className={styles.label}>年度</label>
				<select
					className={styles.select}
					value={primaryYear}
					onChange={(e) => onPrimaryYearChange(Number(e.target.value))}
				>
					{availableYears.map((y) => (
						<option key={y} value={y}>{y}</option>
					))}
				</select>
			</div>

			<div className={styles.field}>
				<label className={styles.label}>月份區間</label>
				<div className={styles.monthRange}>
					<select
						className={styles.select}
						value={monthFrom}
						onChange={(e) => onMonthFromChange(Number(e.target.value))}
					>
						{MONTHS.map((m, i) => (
							<option key={i} value={i + 1}>{m}</option>
						))}
					</select>
					<span className={styles.to}>至</span>
					<select
						className={styles.select}
						value={monthTo}
						onChange={(e) => onMonthToChange(Number(e.target.value))}
					>
						{MONTHS.map((m, i) => (
							<option key={i} value={i + 1}>{m}</option>
						))}
					</select>
				</div>
			</div>

			<div className={styles.actions}>
				<input
					ref={fileInputRef}
					type="file"
					accept=".xls,.xlsx"
					className={styles.hiddenFileInput}
					onChange={(e) => {
						const file = e.target.files?.[0];
						if (file) onImportFile(file);
						e.target.value = ""; // allow re-selecting the same file next time
					}}
				/>
				<button
					className={styles.importBtn}
					onClick={() => fileInputRef.current?.click()}
					disabled={importing}
				>
					{importing ? "匯入中..." : "匯入Excel"}
				</button>
				<button className={styles.exportBtn} onClick={onExport}>
					匯出Excel
				</button>
				<button className={styles.primaryBtn} onClick={onAddEntry}>
					+ 新增紀錄
				</button>
			</div>
		</div>
	);
}