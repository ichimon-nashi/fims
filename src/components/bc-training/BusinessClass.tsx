"use client";

import React, { useState, useRef, useEffect } from "react";
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
	PositionPercent,
	Size,
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

const BusinessClass: React.FC<BusinessClassProps> = ({
	userDetails,
	onLogout,
}) => {
	// Base item configurations with percentage-based positioning
	const getBaseItemConfig = (trayType: TrayType = "A"): ItemsConfig => {
		const width = typeof window !== "undefined" ? window.innerWidth : 1920;
		const height =
			typeof window !== "undefined" ? window.innerHeight : 1080;
		const deviceSize = Math.min(width, height);
		const isTouchDevice =
			typeof window !== "undefined" &&
			("ontouchstart" in window || navigator.maxTouchPoints > 0);

		let scaleFactor: number;
		if (deviceSize >= 900 && !isTouchDevice) {
			scaleFactor = 1; // Desktop
		} else if (width >= 768) {
			scaleFactor = 0.75; // Tablet
		} else {
			scaleFactor = 0.1; // Mobile
		}

		// Define positions as percentages of the drop zone for each tray type
		const trayConfigurations: Record<
			TrayType,
			Record<string, PositionPercent>
		> = {
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

		const basePositions = trayConfigurations[trayType];

		// Item configurations for both tray types
		const itemConfigurations: Record<TrayType, ItemsConfig> = {
			A: {
				"main-plate": {
					name: "Main Plate",
					color: "#e5e7eb",
					size: {
						width: `${17 * scaleFactor}rem`,
						height: `${10 * scaleFactor}rem`,
					},
					traySize: {
						width: `${4 * scaleFactor}rem`,
						height: `${2.8 * scaleFactor}rem`,
					},
					positionPercent: basePositions["main-plate"],
					image: mainPlaceholder.src,
				},
				"salad-plate": {
					name: "Salad Plate",
					color: "#fecaca",
					size: {
						width: `${10 * scaleFactor}rem`,
						height: `${10 * scaleFactor}rem`,
					},
					traySize: {
						width: `${2.5 * scaleFactor}rem`,
						height: `${2.5 * scaleFactor}rem`,
					},
					positionPercent: basePositions["salad-plate"],
					image: saladPlaceholder.src,
				},
				"fruit-bowl": {
					name: "Fruit Bowl",
					color: "#fecaca",
					size: {
						width: `${10 * scaleFactor}rem`,
						height: `${10 * scaleFactor}rem`,
					},
					traySize: {
						width: `${2.5 * scaleFactor}rem`,
						height: `${2.5 * scaleFactor}rem`,
					},
					positionPercent: basePositions["fruit-bowl"],
					image: fruitPlaceholder.src,
				},
				"bread-plate": {
					name: "Bread Plate",
					color: "#fef3c7",
					size: {
						width: `${10 * scaleFactor}rem`,
						height: `${10 * scaleFactor}rem`,
					},
					traySize: {
						width: `${2.8 * scaleFactor}rem`,
						height: `${2.8 * scaleFactor}rem`,
					},
					positionPercent: basePositions["bread-plate"],
					image: breadPlaceholder.src,
				},
				utensils: {
					name: "Utensils",
					color: "#d1d5db",
					size: {
						width: `${4 * scaleFactor}rem`,
						height: `${10 * scaleFactor}rem`,
					},
					traySize: {
						width: `${1.2 * scaleFactor}rem`,
						height: `${3.2 * scaleFactor}rem`,
					},
					positionPercent: basePositions["utensils"],
					image: utensilPlaceholder.src,
				},
				"water-glass": {
					name: "Water Glass",
					color: "#dbeafe",
					size: {
						width: `${4 * scaleFactor}rem`,
						height: `${10 * scaleFactor}rem`,
					},
					traySize: {
						width: `${0.8 * scaleFactor}rem`,
						height: `${2 * scaleFactor}rem`,
					},
					positionPercent: basePositions["water-glass"],
					image: waterPlaceholder.src,
				},
				"wine-glass": {
					name: "Wine Glass",
					color: "#e9d5ff",
					size: {
						width: `${4 * scaleFactor}rem`,
						height: `${10 * scaleFactor}rem`,
					},
					traySize: {
						width: `${0.8 * scaleFactor}rem`,
						height: `${2 * scaleFactor}rem`,
					},
					positionPercent: basePositions["wine-glass"],
					image: winePlaceholder.src,
				},
				"salt-pepper": {
					name: "Salt & Pepper",
					color: "#9ca3af",
					size: {
						width: `${4 * scaleFactor}rem`,
						height: `${4 * scaleFactor}rem`,
					},
					traySize: {
						width: `${1 * scaleFactor}rem`,
						height: `${1 * scaleFactor}rem`,
					},
					positionPercent: basePositions["salt-pepper"],
					image: saltpepperPlaceholder.src,
				},
				"butter-dish": {
					name: "Butter Dish",
					color: "#fecaca",
					size: {
						width: `${4 * scaleFactor}rem`,
						height: `${4 * scaleFactor}rem`,
					},
					traySize: {
						width: `${1.2 * scaleFactor}rem`,
						height: `${0.8 * scaleFactor}rem`,
					},
					positionPercent: basePositions["butter-dish"],
					image: butterPlaceholder.src,
				},
			},
			B: {
				"main-plate": {
					name: "Main Plate",
					color: "#e5e7eb",
					size: {
						width: `${18 * scaleFactor}rem`,
						height: `${12 * scaleFactor}rem`,
					},
					traySize: {
						width: `${3.6 * scaleFactor}rem`,
						height: `${2.4 * scaleFactor}rem`,
					},
					positionPercent: basePositions["main-plate"],
					image: mainPlaceholder.src,
				},
				"appetizer-plate": {
					name: "Appetizer Plate",
					color: "#fed7d7",
					size: {
						width: `${10 * scaleFactor}rem`,
						height: `${10 * scaleFactor}rem`,
					},
					traySize: {
						width: `${2 * scaleFactor}rem`,
						height: `${2 * scaleFactor}rem`,
					},
					positionPercent: basePositions["appetizer-plate"],
					image: saladPlaceholder.src,
				},
				"soup-bowl": {
					name: "Soup Bowl",
					color: "#fef5e7",
					size: {
						width: `${12 * scaleFactor}rem`,
						height: `${12 * scaleFactor}rem`,
					},
					traySize: {
						width: `${2.4 * scaleFactor}rem`,
						height: `${2.4 * scaleFactor}rem`,
					},
					positionPercent: basePositions["soup-bowl"],
					image: fruitPlaceholder.src,
				},
				"bread-plate": {
					name: "Bread Plate",
					color: "#fef3c7",
					size: {
						width: `${12 * scaleFactor}rem`,
						height: `${12 * scaleFactor}rem`,
					},
					traySize: {
						width: `${2.4 * scaleFactor}rem`,
						height: `${2.4 * scaleFactor}rem`,
					},
					positionPercent: basePositions["bread-plate"],
					image: breadPlaceholder.src,
				},
				"dessert-plate": {
					name: "Dessert Plate",
					color: "#e0e7ff",
					size: {
						width: `${10 * scaleFactor}rem`,
						height: `${10 * scaleFactor}rem`,
					},
					traySize: {
						width: `${2 * scaleFactor}rem`,
						height: `${2 * scaleFactor}rem`,
					},
					positionPercent: basePositions["dessert-plate"],
					image: saladPlaceholder.src,
				},
				utensils: {
					name: "Utensils",
					color: "#d1d5db",
					size: {
						width: `${6 * scaleFactor}rem`,
						height: `${16 * scaleFactor}rem`,
					},
					traySize: {
						width: `${1.2 * scaleFactor}rem`,
						height: `${3.2 * scaleFactor}rem`,
					},
					positionPercent: basePositions["utensils"],
					image: utensilPlaceholder.src,
				},
				"water-glass": {
					name: "Water Glass",
					color: "#dbeafe",
					size: {
						width: `${4 * scaleFactor}rem`,
						height: `${10 * scaleFactor}rem`,
					},
					traySize: {
						width: `${0.8 * scaleFactor}rem`,
						height: `${2 * scaleFactor}rem`,
					},
					positionPercent: basePositions["water-glass"],
					image: waterPlaceholder.src,
				},
				"wine-glass": {
					name: "Wine Glass",
					color: "#e9d5ff",
					size: {
						width: `${4 * scaleFactor}rem`,
						height: `${10 * scaleFactor}rem`,
					},
					traySize: {
						width: `${0.8 * scaleFactor}rem`,
						height: `${2 * scaleFactor}rem`,
					},
					positionPercent: basePositions["wine-glass"],
					image: winePlaceholder.src,
				},
				napkin: {
					name: "Napkin",
					color: "#f0f9ff",
					size: {
						width: `${8 * scaleFactor}rem`,
						height: `${6 * scaleFactor}rem`,
					},
					traySize: {
						width: `${1.6 * scaleFactor}rem`,
						height: `${1.2 * scaleFactor}rem`,
					},
					positionPercent: basePositions["napkin"],
					image: saltpepperPlaceholder.src,
				},
				"condiment-tray": {
					name: "Condiment Tray",
					color: "#f7fafc",
					size: {
						width: `${8 * scaleFactor}rem`,
						height: `${5 * scaleFactor}rem`,
					},
					traySize: {
						width: `${1.6 * scaleFactor}rem`,
						height: `${1 * scaleFactor}rem`,
					},
					positionPercent: basePositions["condiment-tray"],
					image: butterPlaceholder.src,
				},
			},
		};

		return itemConfigurations[trayType];
	};

	const [trayType, setTrayType] = useState<TrayType>("A");
	const [ITEMS_CONFIG, setItemsConfig] = useState<ItemsConfig>(
		getBaseItemConfig("A")
	);
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

	// Calculate correct positions based on current drop zone size
	const updateCorrectPositions = (): void => {
		if (!dropZoneRef.current) return;

		const dropZoneRect = dropZoneRef.current.getBoundingClientRect();
		const newCorrectPositions: CorrectPositions = {};

		Object.entries(ITEMS_CONFIG).forEach(([itemId, config]) => {
			const { xPercent, yPercent } = config.positionPercent;

			// Calculate position in pixels based on current drop zone size
			const x = (dropZoneRect.width * xPercent) / 100;
			const y = (dropZoneRect.height * yPercent) / 100;

			// Adjust for item size (center the item on the target position)
			const itemWidthPx = parseFloat(config.size.width) * 16;
			const itemHeightPx = parseFloat(config.size.height) * 16;

			newCorrectPositions[itemId] = {
				x: x - itemWidthPx / 2,
				y: y - itemHeightPx / 2,
			};
		});

		setCorrectPositions(newCorrectPositions);
	};

	// Check orientation on mount and resize
	useEffect(() => {
		const checkOrientation = (): void => {
			if (typeof window === "undefined") return;

			const isLandscapeMode = window.innerWidth > window.innerHeight;
			setIsLandscape(isLandscapeMode);

			// Update config when window resizes
			setItemsConfig(getBaseItemConfig(trayType));

			// Delay position calculation to ensure DOM has updated
			setTimeout(updateCorrectPositions, 100);
		};

		checkOrientation();

		if (typeof window !== "undefined") {
			window.addEventListener("resize", checkOrientation);
			window.addEventListener("orientationchange", checkOrientation);

			return () => {
				window.removeEventListener("resize", checkOrientation);
				window.removeEventListener(
					"orientationchange",
					checkOrientation
				);
			};
		}
	}, [trayType]);

	// Update correct positions when drop zone is ready
	useEffect(() => {
		if (dropZoneRef.current) {
			updateCorrectPositions();
		}
	}, [dropZoneRef.current, ITEMS_CONFIG]);

	const handleDragStart = (
		e: React.DragEvent<HTMLDivElement>,
		itemId: string
	): void => {
		setDraggedItem(itemId);
		e.dataTransfer.effectAllowed = "move";
	};

	const handleTouchStart = (
		e: React.TouchEvent<HTMLDivElement>,
		itemId: string
	): void => {
		setDraggedItem(itemId);
		e.preventDefault();

		// Store initial touch position for drag calculation
		const touch = e.touches[0];
		setTouchOffset({
			x: touch.clientX,
			y: touch.clientY,
		});
	};

	const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>): void => {
		e.preventDefault();

		if (!draggedItem) return;

		const touch = e.touches[0];
		const config = ITEMS_CONFIG[draggedItem];

		if (!dropZoneRef.current) return;

		const dropZoneRect = dropZoneRef.current.getBoundingClientRect();
		const widthPx = parseFloat(config.size.width) * 16;
		const heightPx = parseFloat(config.size.height) * 16;

		// Calculate new position
		let x = touch.clientX - dropZoneRect.left - widthPx / 2;
		let y = touch.clientY - dropZoneRect.top - heightPx / 2;

		// Constrain to drop zone boundaries
		const maxX = dropZoneRect.width - widthPx;
		const minX = 0;
		x = Math.max(minX, Math.min(maxX, x));

		const maxY = dropZoneRect.height - heightPx;
		const minY = 0;
		y = Math.max(minY, Math.min(maxY, y));

		// Update position in real-time during drag
		setPlacedItems((prev) => ({
			...prev,
			[draggedItem]: { x, y },
		}));
	};

	const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>): void => {
		if (!draggedItem || !tableSurfaceRef.current) return;

		const touch = e.changedTouches[0];
		const tableSurfaceRect =
			tableSurfaceRef.current.getBoundingClientRect();

		// Check if final position is within table surface
		const isWithinTableSurface =
			touch.clientX >= tableSurfaceRect.left &&
			touch.clientX <= tableSurfaceRect.right &&
			touch.clientY >= tableSurfaceRect.top &&
			touch.clientY <= tableSurfaceRect.bottom;

		if (!isWithinTableSurface) {
			// Remove from placed items if dropped outside table surface
			setPlacedItems((prev) => {
				const newItems = { ...prev };
				delete newItems[draggedItem];
				return newItems;
			});
		}

		setDraggedItem(null);
		setFeedback("");
	};

	const handleDragOver = (e: React.DragEvent<HTMLDivElement>): void => {
		e.preventDefault();
		e.dataTransfer.dropEffect = "move";
	};

	const handleDrop = (e: React.DragEvent<HTMLDivElement>): void => {
		e.preventDefault();
		if (!draggedItem || !dropZoneRef.current || !tableSurfaceRef.current)
			return;

		const dropZoneRect = dropZoneRef.current.getBoundingClientRect();
		const tableSurfaceRect =
			tableSurfaceRef.current.getBoundingClientRect();
		const config = ITEMS_CONFIG[draggedItem];

		// Convert rem to pixels for positioning (assuming 1rem = 16px)
		const widthPx = parseFloat(config.size.width) * 16;
		const heightPx = parseFloat(config.size.height) * 16;

		// Check if the drop happened within the table surface boundaries
		const isWithinTableSurface =
			e.clientX >= tableSurfaceRect.left &&
			e.clientX <= tableSurfaceRect.right &&
			e.clientY >= tableSurfaceRect.top &&
			e.clientY <= tableSurfaceRect.bottom;

		if (isWithinTableSurface) {
			// Calculate position relative to the drop zone (for positioning)
			let x = e.clientX - dropZoneRect.left - widthPx / 2;
			let y = e.clientY - dropZoneRect.top - heightPx / 2;

			// Prevent horizontal overflow - constrain x position
			const maxX = dropZoneRect.width - widthPx;
			const minX = 0;
			x = Math.max(minX, Math.min(maxX, x));

			// Prevent vertical overflow - constrain y position
			const maxY = dropZoneRect.height - heightPx;
			const minY = 0;
			y = Math.max(minY, Math.min(maxY, y));

			// Place item at constrained position relative to drop zone
			setPlacedItems((prev) => ({
				...prev,
				[draggedItem]: { x, y },
			}));
		} else {
			// If outside table surface, remove from placed items (return to tray)
			setPlacedItems((prev) => {
				const newItems = { ...prev };
				delete newItems[draggedItem];
				return newItems;
			});
		}

		setDraggedItem(null);
		setFeedback("");
	};

	const handleDragEnd = (): void => {
		// Clean up drag state
		if (draggedItem) {
			setDraggedItem(null);
		}
	};

	const calculateDistance = (pos1: Position, pos2: Position): number => {
		return Math.sqrt(
			Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2)
		);
	};

	const checkPlacement = (): void => {
		const results: string[] = [];
		const tolerance = 30; // pixels tolerance for more lenient checking

		Object.keys(ITEMS_CONFIG).forEach((itemId) => {
			const placedPos = placedItems[itemId];
			const correctPos = correctPositions[itemId];

			if (!placedPos) {
				results.push(`❌ ${ITEMS_CONFIG[itemId].name}: Not placed`);
			} else if (!correctPos) {
				results.push(
					`⚠️ ${ITEMS_CONFIG[itemId].name}: Position not calculated`
				);
			} else {
				const distance = calculateDistance(placedPos, correctPos);
				const xDiff = Math.round(placedPos.x - correctPos.x);
				const yDiff = Math.round(placedPos.y - correctPos.y);

				if (distance <= tolerance) {
					results.push(`✅ ${ITEMS_CONFIG[itemId].name}: Correct!`);
				} else {
					const xDirection = xDiff > 0 ? "right" : "left";
					const yDirection = yDiff > 0 ? "down" : "up";
					results.push(
						`❌ ${ITEMS_CONFIG[itemId].name}: Off by ${Math.abs(
							xDiff
						)}px ${xDirection}, ${Math.abs(yDiff)}px ${yDirection}`
					);
				}
			}
		});

		const correctCount = results.filter((r) => r.includes("✅")).length;
		const totalItems = Object.keys(ITEMS_CONFIG).length;
		const score = Math.round((correctCount / totalItems) * 100);

		setFeedback(
			`Score: ${score}% (${correctCount}/${totalItems} correct)\n\n${results.join(
				"\n"
			)}`
		);
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
		setItemsConfig(getBaseItemConfig(newTrayType));
		// Reset all placements when switching tray types
		setPlacedItems({});
		setCorrectPositions({});
		setFeedback("");
		setShowCorrectPositions(false);
		// Delay position calculation to ensure DOM has updated
		setTimeout(updateCorrectPositions, 100);
	};

	// Show rotation prompt for portrait mode
	if (!isLandscape) {
		return (
			<div className={styles.businessClassContainer}>
				<Navbar />
				<div className={styles.rotationPrompt}>
					<img
						src={rotateDevice.src}
						alt="Rotate Device"
						className={styles.rotationGif}
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
				{/* Header */}
				<div className={styles.header}>
					<div className={styles.headerContent}>
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
											<img
												src={config.image}
												alt={config.name}
												className={styles.itemImage}
												draggable={false}
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
							className={`${styles.button} ${styles.toggleButton}`}
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
											<img
												src={config.image}
												alt={config.name}
												className={styles.itemImage}
												draggable={false}
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
