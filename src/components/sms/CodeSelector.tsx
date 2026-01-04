// src/components/sms/CodeSelector.tsx
"use client";

import { useState } from "react";
import styles from "./CodeSelector.module.css";

interface Code {
	code: string;
	description: string;
}

// Two-tier structure (Human Factors)
interface TwoTierCategory {
	code: string;
	name: string;
	subcodes: { code: string; description: string }[];
}

// Three-tier structure (EF Attributes)
interface MiddleCategory {
	code: string;
	name: string;
	subcodes: { code: string; description: string }[];
}

interface ThreeTierCategory {
	code: string;
	name: string;
	middleCategories: MiddleCategory[];
}

// Union type to accept both
type Category = TwoTierCategory | ThreeTierCategory;

interface CodeSelectorProps {
	title: string;
	categories: Category[];
	selectedCodes: string[];
	onChange: (codes: string[]) => void;
	type: "human-factors" | "ef-attributes";
	required?: boolean;
}

export default function CodeSelector({
	title,
	categories,
	selectedCodes,
	onChange,
	type,
	required = false,
}: CodeSelectorProps) {
	const [isOpen, setIsOpen] = useState(false);
	const [searchTerm, setSearchTerm] = useState("");
	const [activeCategory, setActiveCategory] = useState<string | null>(null);
	const [activeMiddleCategory, setActiveMiddleCategory] = useState<
		string | null
	>(null); // For three-tier EF codes

	// Helper to check if category is three-tier
	const isThreeTier = (cat: Category): cat is ThreeTierCategory => {
		return "middleCategories" in cat;
	};

	const getAllCodes = (): Code[] => {
		if (type === "ef-attributes") {
			// Three-tier: flatten through middleCategories
			return categories.flatMap((cat) => {
				if (isThreeTier(cat)) {
					return cat.middleCategories.flatMap((middle) =>
						middle.subcodes.map((sub) => ({
							code: sub.code,
							description: sub.description,
						}))
					);
				}
				return [];
			});
		} else {
			// Two-tier: direct subcodes
			return categories.flatMap((cat) =>
				!isThreeTier(cat) && cat.subcodes
					? cat.subcodes.map((sub) => ({
							code: sub.code,
							description: `[${cat.code}] ${sub.description}`,
					  }))
					: []
			);
		}
	};

	const getFilteredCodes = () => {
		const allCodes = getAllCodes();
		return allCodes.filter(
			(code) =>
				code.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
				code.description
					.toLowerCase()
					.includes(searchTerm.toLowerCase())
		);
	};

	const toggleCode = (code: string) => {
		if (selectedCodes.includes(code)) {
			onChange(selectedCodes.filter((c) => c !== code));
		} else {
			onChange([...selectedCodes, code]);
		}
	};

	const removeCode = (code: string) => {
		onChange(selectedCodes.filter((c) => c !== code));
	};

	// Get display categories (top-level for both types)
	const getTopLevelCategories = () => {
		return categories;
	};

	// Get middle categories for EF attributes when top category is selected
	const getMiddleCategories = () => {
		if (type !== "ef-attributes" || !activeCategory) return [];
		const topCategory = categories.find((c) => c.code === activeCategory);
		if (!topCategory || !isThreeTier(topCategory)) return [];
		return topCategory.middleCategories;
	};

	const getCategorySubcodes = () => {
		if (type === "ef-attributes") {
			// Three-tier: need both activeCategory and activeMiddleCategory
			if (!activeMiddleCategory) {
				// If no middle category selected, show all codes from search
				if (searchTerm) return getFilteredCodes();
				return [];
			}

			const topCategory = categories.find(
				(c) => c.code === activeCategory
			);
			if (!topCategory || !isThreeTier(topCategory)) return [];

			const middleCategory = topCategory.middleCategories.find(
				(m) => m.code === activeMiddleCategory
			);
			if (!middleCategory) return [];

			if (!searchTerm) {
				return middleCategory.subcodes.map((sub) => ({
					code: sub.code,
					description: sub.description,
				}));
			}

			const search = searchTerm.toLowerCase();
			return middleCategory.subcodes
				.filter(
					(sub) =>
						sub.code.toLowerCase().includes(search) ||
						sub.description.toLowerCase().includes(search)
				)
				.map((sub) => ({
					code: sub.code,
					description: sub.description,
				}));
		} else {
			// Two-tier: human factors
			if (!activeCategory) return getFilteredCodes();

			const category = categories.find((c) => c.code === activeCategory);
			if (!category || isThreeTier(category)) return [];

			if (!searchTerm) {
				return category.subcodes.map((sub) => ({
					code: sub.code,
					description: `[${category.code}] ${sub.description}`,
				}));
			}

			const search = searchTerm.toLowerCase();
			return category.subcodes
				.filter(
					(sub) =>
						sub.code.toLowerCase().includes(search) ||
						sub.description.toLowerCase().includes(search)
				)
				.map((sub) => ({
					code: sub.code,
					description: `[${category.code}] ${sub.description}`,
				}));
		}
	};

	// Handle top category click
	const handleTopCategoryClick = (code: string) => {
		if (activeCategory === code) {
			setActiveCategory(null);
			setActiveMiddleCategory(null);
		} else {
			setActiveCategory(code);
			setActiveMiddleCategory(null); // Reset middle category when changing top category
		}
	};

	// Handle middle category click (EF only)
	const handleMiddleCategoryClick = (code: string) => {
		setActiveMiddleCategory(activeMiddleCategory === code ? null : code);
	};

	return (
		<div className={styles.codeSelector}>
			<label className={styles.label}>
				{title}
				{required && (
					<span style={{ color: "#ef4444", marginLeft: "4px" }}>
						*
					</span>
				)}
			</label>

			<div className={styles.selectedCodes}>
				{selectedCodes.length === 0 ? (
					<span className={styles.placeholder}>
						點選下方按鈕選擇代碼
					</span>
				) : (
					selectedCodes.map((code) => (
						<span key={code} className={styles.codeTag}>
							{code}
							<button
								type="button"
								onClick={() => removeCode(code)}
								className={styles.removeTag}
							>
								×
							</button>
						</span>
					))
				)}
			</div>

			<button
				type="button"
				onClick={() => setIsOpen(!isOpen)}
				className={styles.selectButton}
			>
				{isOpen ? "關閉選擇器" : "選擇代碼"}
			</button>

			{isOpen && (
				<div className={styles.modal}>
					<div className={styles.modalContent}>
						<div className={styles.modalHeader}>
							<h3>{title}</h3>
							<button
								type="button"
								onClick={() => setIsOpen(false)}
								className={styles.closeButton}
							>
								×
							</button>
						</div>

						<div className={styles.searchBox}>
							<input
								type="text"
								placeholder="搜尋代碼或描述..."
								value={searchTerm}
								onChange={(e) => setSearchTerm(e.target.value)}
								className={styles.searchInput}
							/>
						</div>

						<div className={styles.modalBody}>
							{type === "ef-attributes" ? (
								// Three-column layout for EF attributes
								<div className={styles.threeColumn}>
									{/* Column 1: Top Level Categories (P, E, C, I, T, O, M) */}
									<div className={styles.categoryList}>
										<div
											className={
												styles.categoryListHeader
											}
										>
											分類
										</div>
										<div className={styles.categoryItems}>
											{categories.map((cat) => (
												<div
													key={cat.code}
													className={`${
														styles.categoryItem
													} ${
														activeCategory ===
														cat.code
															? styles.active
															: ""
													}`}
													onClick={() =>
														handleTopCategoryClick(
															cat.code
														)
													}
												>
													<strong>{cat.code}</strong>
													<div
														className={
															styles.categoryName
														}
													>
														{cat.name}
													</div>
												</div>
											))}
										</div>
									</div>

									{/* Column 2: Middle Categories (P1, P2, E1, E2, etc.) */}
									<div className={styles.middleCategoryList}>
										<div
											className={
												styles.categoryListHeader
											}
										>
											{activeCategory
												? "屬性"
												: "請先選擇分類"}
										</div>
										<div className={styles.categoryItems}>
											{getMiddleCategories().map(
												(middle) => (
													<div
														key={middle.code}
														className={`${
															styles.categoryItem
														} ${
															activeMiddleCategory ===
															middle.code
																? styles.active
																: ""
														}`}
														onClick={() =>
															handleMiddleCategoryClick(
																middle.code
															)
														}
													>
														<strong>
															{middle.code}
														</strong>
														<div
															className={
																styles.categoryName
															}
														>
															{middle.name}
														</div>
													</div>
												)
											)}
										</div>
									</div>

									{/* Column 3: Individual Codes (P1-01, P1-02, etc.) */}
									<div className={styles.codeList}>
										<div className={styles.codeListHeader}>
											代碼 ({selectedCodes.length} 已選)
										</div>
										<div className={styles.codeItems}>
											{getCategorySubcodes().map(
												(code) => (
													<label
														key={code.code}
														className={
															styles.codeItem
														}
													>
														<input
															type="checkbox"
															checked={selectedCodes.includes(
																code.code
															)}
															onChange={() =>
																toggleCode(
																	code.code
																)
															}
														/>
														<div
															className={
																styles.codeInfo
															}
														>
															<strong>
																{code.code}
															</strong>
															<span>
																{
																	code.description
																}
															</span>
														</div>
													</label>
												)
											)}
										</div>
									</div>
								</div>
							) : (
								// Two-column layout for Human Factors
								<div className={styles.twoColumn}>
									{/* Column 1: Categories */}
									<div className={styles.categoryList}>
										<div
											className={
												styles.categoryListHeader
											}
										>
											類別
										</div>
										<div className={styles.categoryItems}>
											{categories.map((cat) => (
												<div
													key={cat.code}
													className={`${
														styles.categoryItem
													} ${
														activeCategory ===
														cat.code
															? styles.active
															: ""
													}`}
													onClick={() =>
														handleTopCategoryClick(
															cat.code
														)
													}
												>
													<strong>{cat.code}</strong>
													<div
														className={
															styles.categoryName
														}
													>
														{cat.name}
													</div>
												</div>
											))}
										</div>
									</div>

									{/* Column 2: Subcodes */}
									<div className={styles.codeList}>
										<div className={styles.codeListHeader}>
											代碼 ({selectedCodes.length} 已選)
										</div>
										<div className={styles.codeItems}>
											{getCategorySubcodes().map(
												(code) => (
													<label
														key={code.code}
														className={
															styles.codeItem
														}
													>
														<input
															type="checkbox"
															checked={selectedCodes.includes(
																code.code
															)}
															onChange={() =>
																toggleCode(
																	code.code
																)
															}
														/>
														<div
															className={
																styles.codeInfo
															}
														>
															<strong>
																{code.code}
															</strong>
															<span>
																{
																	code.description
																}
															</span>
														</div>
													</label>
												)
											)}
										</div>
									</div>
								</div>
							)}
						</div>

						<div className={styles.modalFooter}>
							<button
								type="button"
								onClick={() => setIsOpen(false)}
								className={styles.doneButton}
							>
								完成
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
}
