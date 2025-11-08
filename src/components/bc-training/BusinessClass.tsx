"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import Image from "next/image";
import Navbar from "@/components/common/Navbar";
import styles from "./bc-training.module.css";
import {
	BusinessClassProps,
	TrayType,
	ItemsConfig,
	PlacedItems,
	CorrectPositions,
	TouchOffset,
	Position,
} from "./types";

// Import all assets
import rotateDevice from "./assets/rotateDevice.gif";
import breadPlaceholder from "./assets/bread-placeholder.png";
import fruitPlaceholder from "./assets/fruit-placeholder.png";
import saladPlaceholder from "./assets/salad-placeholder.png";
import mainPlaceholder from "./assets/main-placeholder.png";
import butterPlaceholder from "./assets/butter-placeholder.png";
import saltpepperPlaceholder from "./assets/saltpepper-placeholder.png";
import waterPlaceholder from "./assets/water-placeholder.png";
import winePlaceholder from "./assets/wine-placeholder.png";
import utensilPlaceholder from "./assets/utensil-placeholder.png";

// Fixed dimensions in pixels for items on the table
const FIXED_ITEM_DIMENSIONS = {
	A: {
		"main-plate": { width: 170, height: 100, trayWidth: 64, trayHeight: 45 },
		"salad-plate": { width: 100, height: 100, trayWidth: 40, trayHeight: 40 },
		"fruit-bowl": { width: 100, height: 100, trayWidth: 40, trayHeight: 40 },
		"bread-plate": { width: 100, height: 100, trayWidth: 45, trayHeight: 45 },
		utensils: { width: 40, height: 100, trayWidth: 19, trayHeight: 51 },
		"water-glass": { width: 40, height: 100, trayWidth: 13, trayHeight: 32 },
		"wine-glass": { width: 40, height: 100, trayWidth: 13, trayHeight: 32 },
		"salt-pepper": { width: 40, height: 40, trayWidth: 16, trayHeight: 16 },
		"butter-dish": { width: 40, height: 40, trayWidth: 19, trayHeight: 13 },
	},
	B: {
		"main-plate": { width: 180, height: 120, trayWidth: 58, trayHeight: 38 },
		"appetizer-plate": { width: 100, height: 100, trayWidth: 32, trayHeight: 32 },
		"soup-bowl": { width: 120, height: 120, trayWidth: 38, trayHeight: 38 },
		"bread-plate": { width: 100, height: 100, trayWidth: 32, trayHeight: 32 },
		"dessert-plate": { width: 100, height: 100, trayWidth: 32, trayHeight: 32 },
		utensils: { width: 50, height: 120, trayWidth: 16, trayHeight: 38 },
		"water-glass": { width: 40, height: 100, trayWidth: 13, trayHeight: 32 },
		"wine-glass": { width: 40, height: 100, trayWidth: 13, trayHeight: 32 },
		napkin: { width: 80, height: 80, trayWidth: 26, trayHeight: 26 },
		"condiment-tray": { width: 100, height: 60, trayWidth: 32, trayHeight: 19 },
	},
};

// Position percentages relative to table surface
const POSITION_PERCENTAGES = {
	A: {
		"main-plate": { xPercent: 52, yPercent: 73 },
		"salad-plate": { xPercent: 32.5, yPercent: 27 },
		"fruit-bowl": { xPercent: 52.5, yPercent: 27 },
		"bread-plate": { xPercent: 32.5, yPercent: 73 },
		utensils: { xPercent: 68, yPercent: 65 },
		"water-glass": { xPercent: 66, yPercent: 27 },
		"wine-glass": { xPercent: 72, yPercent: 27 },
		"salt-pepper": { xPercent: 42.5, yPercent: 17 },
		"butter-dish": { xPercent: 42.5, yPercent: 34 },
	},
	B: {
		"main-plate": { xPercent: 45, yPercent: 45 },
		"appetizer-plate": { xPercent: 25, yPercent: 12 },
		"soup-bowl": { xPercent: 70, yPercent: 12 },
		"bread-plate": { xPercent: 15, yPercent: 45 },
		"dessert-plate": { xPercent: 75, yPercent: 45 },
		utensils: { xPercent: 88, yPercent: 35 },
		"water-glass": { xPercent: 65, yPercent: 8 },
		"wine-glass": { xPercent: 78, yPercent: 8 },
		napkin: { xPercent: 12, yPercent: 25 },
		"condiment-tray": { xPercent: 52, yPercent: 25 },
	},
};

const BusinessClass: React.FC<BusinessClassProps> = ({
	userDetails,
	onLogout,
}) => {
	const [trayType, setTrayType] = useState<TrayType>("A");
	const [ITEMS_CONFIG, setItemsConfig] = useState<ItemsConfig>({});
	const [placedItems, setPlacedItems] = useState<PlacedItems>({});
	const [correctPositions, setCorrectPositions] = useState<CorrectPositions>(
		{}
	);
	const [draggedItem, setDraggedItem] = useState<string | null>(null);
	const [feedback, setFeedback] = useState<string>("");
	const [showCorrectPositions, setShowCorrectPositions] =
		useState<boolean>(false);
	const [isLandscape, setIsLandscape] = useState<boolean>(true);
	const [hoveredItem, setHoveredItem] = useState<string | null>(null);
	const [touchOffset, setTouchOffset] = useState<TouchOffset>({ x: 0, y: 0 });
	const dropZoneRef = useRef<HTMLDivElement>(null);
	const tableSurfaceRef = useRef<HTMLDivElement>(null);

	// Generate item configuration based on fixed dimensions
	const getBaseItemConfig = useCallback((selectedTrayType: TrayType): ItemsConfig => {
		const dimensions = FIXED_ITEM_DIMENSIONS[selectedTrayType];
		const positions = POSITION_PERCENTAGES[selectedTrayType];

		const imageMap: Record<string, string> = {
			"main-plate": mainPlaceholder.src,
			"salad-plate": saladPlaceholder.src,
			"appetizer-plate": saladPlaceholder.src,
			"fruit-bowl": fruitPlaceholder.src,
			"soup-bowl": fruitPlaceholder.src,
			"bread-plate": breadPlaceholder.src,
			"dessert-plate": saladPlaceholder.src,
			utensils: utensilPlaceholder.src,
			"water-glass": waterPlaceholder.src,
			"wine-glass": winePlaceholder.src,
			"salt-pepper": saltpepperPlaceholder.src,
			"butter-dish": butterPlaceholder.src,
			napkin: breadPlaceholder.src,
			"condiment-tray": butterPlaceholder.src,
		};

		const nameMap: Record<string, string> = {
			"main-plate": "Main Plate",
			"salad-plate": "Salad Plate",
			"appetizer-plate": "Appetizer Plate",
			"fruit-bowl": "Fruit Bowl",
			"soup-bowl": "Soup Bowl",
			"bread-plate": "Bread Plate",
			"dessert-plate": "Dessert Plate",
			utensils: "Utensils",
			"water-glass": "Water Glass",
			"wine-glass": "Wine Glass",
			"salt-pepper": "Salt & Pepper",
			"butter-dish": "Butter Dish",
			napkin: "Napkin",
			"condiment-tray": "Condiment Tray",
		};

		const config: ItemsConfig = {};

		Object.keys(dimensions).forEach((itemId) => {
			const dim = dimensions[itemId as keyof typeof dimensions];
			const pos = positions[itemId as keyof typeof positions];

			config[itemId] = {
				name: nameMap[itemId] || itemId,
				color: "#e5e7eb",
				size: {
					width: `${dim.width}px`,
					height: `${dim.height}px`,
				},
				traySize: {
					width: `${dim.trayWidth}px`,
					height: `${dim.trayHeight}px`,
				},
				positionPercent: pos,
				image: imageMap[itemId] || mainPlaceholder.src,
			};
		});

		return config;
	}, []);

	// Check for orientation changes
	useEffect(() => {
		const checkOrientation = (): void => {
			if (typeof window !== "undefined") {
				setIsLandscape(window.innerWidth > window.innerHeight);
			}
		};

		checkOrientation();
		window.addEventListener("resize", checkOrientation);
		window.addEventListener("orientationchange", checkOrientation);

		return () => {
			window.removeEventListener("resize", checkOrientation);
			window.removeEventListener("orientationchange", checkOrientation);
		};
	}, []);

	// Initialize item config on mount and when tray type changes
	useEffect(() => {
		const config = getBaseItemConfig(trayType);
		setItemsConfig(config);
	}, [trayType, getBaseItemConfig]);

	// Calculate correct positions based on table surface
	const updateCorrectPositions = useCallback((): void => {
		if (!tableSurfaceRef.current || !dropZoneRef.current) return;

		const tableRect = tableSurfaceRef.current.getBoundingClientRect();
		const dropZoneRect = dropZoneRef.current.getBoundingClientRect();

		const newCorrectPositions: CorrectPositions = {};

		Object.entries(ITEMS_CONFIG).forEach(([itemId, config]) => {
			const itemWidth = parseFloat(config.size.width);
			const itemHeight = parseFloat(config.size.height);

			// Calculate position relative to table surface
			const relativeX = (config.positionPercent.xPercent / 100) * tableRect.width;
			const relativeY = (config.positionPercent.yPercent / 100) * tableRect.height;

			// Convert to drop zone coordinates
			const absoluteX = tableRect.left - dropZoneRect.left + relativeX - itemWidth / 2;
			const absoluteY = tableRect.top - dropZoneRect.top + relativeY - itemHeight / 2;

			newCorrectPositions[itemId] = {
				x: absoluteX,
				y: absoluteY,
			};
		});

		setCorrectPositions(newCorrectPositions);
	}, [ITEMS_CONFIG]);

	// Update correct positions when config changes or window resizes
	useEffect(() => {
		if (Object.keys(ITEMS_CONFIG).length === 0) return;

		const handleUpdate = () => {
			updateCorrectPositions();
		};

		// Initial calculation with delay to ensure DOM is ready
		const timeoutId = setTimeout(handleUpdate, 100);

		window.addEventListener("resize", handleUpdate);

		return () => {
			clearTimeout(timeoutId);
			window.removeEventListener("resize", handleUpdate);
		};
	}, [ITEMS_CONFIG, updateCorrectPositions]);

	// Drag and Drop Handlers
	const handleDragStart = (
		e: React.DragEvent<HTMLDivElement>,
		itemId: string
	): void => {
		setDraggedItem(itemId);
		e.dataTransfer.effectAllowed = "move";
	};

	const handleDragEnd = (): void => {
		setDraggedItem(null);
	};

	const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	};

	const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
		e.preventDefault();
		if (!draggedItem || !dropZoneRef.current) return;

		const dropZoneRect = dropZoneRef.current.getBoundingClientRect();
		const config = ITEMS_CONFIG[draggedItem];

		const itemWidth = parseFloat(config.size.width);
		const itemHeight = parseFloat(config.size.height);

		let x = e.clientX - dropZoneRect.left - itemWidth / 2;
		let y = e.clientY - dropZoneRect.top - itemHeight / 2;

		// Constrain within drop zone
		x = Math.max(0, Math.min(x, dropZoneRect.width - itemWidth));
		y = Math.max(0, Math.min(y, dropZoneRect.height - itemHeight));

		setPlacedItems((prev) => ({
			...prev,
			[draggedItem]: { x, y },
		}));

		setDraggedItem(null);
	};

	// Touch Handlers
	const handleTouchStart = (
		e: React.TouchEvent<HTMLDivElement>,
		itemId: string
	): void => {
		e.preventDefault();
		setDraggedItem(itemId);

		const touch = e.touches[0];
		const target = e.currentTarget.getBoundingClientRect();

		setTouchOffset({
			x: touch.clientX - target.left,
			y: touch.clientY - target.top,
		});
	};

	const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>): void => {
		e.preventDefault();
		if (!draggedItem || !dropZoneRef.current) return;

		const touch = e.touches[0];
		const dropZoneRect = dropZoneRef.current.getBoundingClientRect();
		const config = ITEMS_CONFIG[draggedItem];

		const itemWidth = parseFloat(config.size.width);
		const itemHeight = parseFloat(config.size.height);

		let x = touch.clientX - dropZoneRect.left - touchOffset.x;
		let y = touch.clientY - dropZoneRect.top - touchOffset.y;

		// Constrain within drop zone
		x = Math.max(0, Math.min(x, dropZoneRect.width - itemWidth));
		y = Math.max(0, Math.min(y, dropZoneRect.height - itemHeight));

		setPlacedItems((prev) => ({
			...prev,
			[draggedItem]: { x, y },
		}));
	};

	const handleTouchEnd = (): void => {
		setDraggedItem(null);
		setTouchOffset({ x: 0, y: 0 });
	};

	const checkPlacement = (): void => {
		const tolerance = 30;
		let allCorrect = true;
		let resultText = "";

		Object.entries(ITEMS_CONFIG).forEach(([itemId, config]) => {
			const placedPos = placedItems[itemId];
			const correctPos = correctPositions[itemId];

			if (!placedPos) {
				allCorrect = false;
				resultText += `❌ ${config.name}: Not placed\n`;
			} else if (!correctPos) {
				allCorrect = false;
				resultText += `⚠️ ${config.name}: Correct position not calculated\n`;
			} else {
				const dx = Math.abs(placedPos.x - correctPos.x);
				const dy = Math.abs(placedPos.y - correctPos.y);

				if (dx <= tolerance && dy <= tolerance) {
					resultText += `✅ ${config.name}: Correct!\n`;
				} else {
					allCorrect = false;
					resultText += `❌ ${config.name}: Incorrect (off by ${Math.round(
						Math.sqrt(dx * dx + dy * dy)
					)}px)\n`;
				}
			}
		});

		if (allCorrect) {
			resultText = "🎉 Perfect! All items placed correctly!\n\n" + resultText;
		} else {
			resultText =
				"Some items need adjustment. Keep trying!\n\n" + resultText;
		}

		setFeedback(resultText);
	};

	const resetPlacement = (): void => {
		setPlacedItems({});
		setFeedback("");
		setShowCorrectPositions(false);
	};

	const toggleCorrectPositions = (): void => {
		setShowCorrectPositions(!showCorrectPositions);
	};

	const handleTrayTypeChange = (newTrayType: TrayType): void => {
		setTrayType(newTrayType);
		// Reset all placements when switching tray types
		setPlacedItems({});
		setCorrectPositions({});
		setFeedback("");
		setShowCorrectPositions(false);
	};

	// Show rotation prompt for portrait mode
	if (!isLandscape) {
		return (
			<div className={styles.businessClassContainer}>
				<Navbar />
				<div className={styles.rotationPrompt}>
					<Image
						src={rotateDevice}
						alt="Rotate Device"
						className={styles.rotationGif}
						width={300}
						height={200}
						priority
					/>
					<p>請旋轉至橫向模式</p>
					<p>Please rotate to landscape mode</p>
				</div>
			</div>
		);
	}

	return (
		<div className={styles.businessClassContainer}>
			<Navbar />

			<div className={styles.container}>
				{/* Header with Tray Type Toggle */}
				<div className={styles.header}>
					<div className={styles.trayTypeToggle}>
						<span className={styles.trayTypeLabel}>
							Tray Type:
						</span>
						<div className={styles.toggleButtons}>
							<button
								onClick={() => handleTrayTypeChange("A")}
								className={`${styles.toggleButton} ${
									trayType === "A" ? styles.active : ""
								}`}
							>
								Type A
							</button>
							<button
								onClick={() => handleTrayTypeChange("B")}
								className={`${styles.toggleButton} ${
									trayType === "B" ? styles.active : ""
								}`}
							>
								Type B
							</button>
						</div>
					</div>
				</div>

				{/* Main Content Area */}
				<div className={styles.mainContent}>
					{/* Drop Zone */}
					<div className={styles.dropZoneContainer}>
						<div
							ref={dropZoneRef}
							className={styles.dropZone}
							onDragOver={handleDragOver}
							onDrop={handleDrop}
						>
							{/* Table representation */}
							<div
								className={styles.tableSurface}
								ref={tableSurfaceRef}
							>
								<div className={styles.tableSurfaceText}>
									Table Surface
								</div>
							</div>

							{/* Show correct positions when toggled */}
							{showCorrectPositions &&
								Object.entries(correctPositions).map(
									([itemId, position]) => {
										const config = ITEMS_CONFIG[itemId];
										return (
											<div
												key={`correct-${itemId}`}
												className={
													styles.correctPosition
												}
												style={{
													left: `${position.x}px`,
													top: `${position.y}px`,
													width: config.size.width,
													height: config.size.height,
												}}
											>
												{config.name}
											</div>
										);
									}
								)}

							{/* Placed Items */}
							{Object.entries(placedItems).map(
								([itemId, position]) => {
									const config = ITEMS_CONFIG[itemId];
									return (
										<div
											key={`placed-${itemId}`}
											className={styles.placedItem}
											style={{
												left: position.x,
												top: position.y,
												width: config.size.width,
												height: config.size.height,
											}}
											draggable
											onDragStart={(e) =>
												handleDragStart(e, itemId)
											}
											onDragEnd={handleDragEnd}
											onTouchStart={(e) =>
												handleTouchStart(e, itemId)
											}
											onTouchMove={handleTouchMove}
											onTouchEnd={handleTouchEnd}
											title={config.name}
										>
											<Image
												src={config.image}
												alt={config.name}
												className={styles.itemImage}
												width={200}
												height={200}
												draggable={false}
												unoptimized
											/>
										</div>
									);
								}
							)}
						</div>
					</div>

					{/* Control Buttons */}
					<div className={styles.controlButtons}>
						<button
							onClick={checkPlacement}
							className={`${styles.button} ${styles.submitButton}`}
						>
							Submit & Check
						</button>
						<button
							onClick={resetPlacement}
							className={`${styles.button} ${styles.resetButton}`}
						>
							Reset
						</button>
						<button
							onClick={toggleCorrectPositions}
							className={`${styles.button} ${styles.showCorrectButton}`}
						>
							{showCorrectPositions ? "Hide" : "Show"} Correct
							Positions
						</button>
					</div>

					{/* Feedback Area */}
					{feedback && (
						<div className={styles.feedback}>
							<h3 className={styles.feedbackTitle}>Results:</h3>
							<pre className={styles.feedbackText}>
								{feedback}
							</pre>
						</div>
					)}

					{/* Items Tray */}
					<div className={styles.itemsTray}>
						<h3 className={styles.trayTitle}>
							Items Tray 托盤物品 - Type {trayType}
						</h3>
						<div className={styles.trayItems}>
							{Object.entries(ITEMS_CONFIG).map(
								([itemId, config]) => {
									const isPlaced = placedItems[itemId];
									return (
										<div
											key={itemId}
											className={`${styles.trayItem} ${
												isPlaced ? styles.placed : ""
											}`}
											style={{
												width: config.traySize.width,
												height: config.traySize.height,
											}}
											draggable={!isPlaced}
											onDragStart={(e) =>
												!isPlaced &&
												handleDragStart(e, itemId)
											}
											onDragEnd={handleDragEnd}
											onTouchStart={(e) =>
												!isPlaced &&
												handleTouchStart(e, itemId)
											}
											onTouchMove={
												!isPlaced
													? handleTouchMove
													: undefined
											}
											onTouchEnd={
												!isPlaced
													? handleTouchEnd
													: undefined
											}
											onMouseEnter={() =>
												setHoveredItem(itemId)
											}
											onMouseLeave={() =>
												setHoveredItem(null)
											}
											title={config.name}
										>
											<Image
												src={config.image}
												alt={config.name}
												className={styles.itemImage}
												width={100}
												height={100}
												draggable={false}
												unoptimized
											/>
											{hoveredItem === itemId &&
												!isPlaced && (
													<div
														className={
															styles.itemTooltip
														}
													>
														{config.name}
													</div>
												)}
										</div>
									);
								}
							)}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default BusinessClass;