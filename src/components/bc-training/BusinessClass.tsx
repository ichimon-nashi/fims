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
	Position,
	PositionPercent,
} from "./types";

// Import all assets
import breadPlaceholder from "./assets/bread-placeholder.png";
import fruitPlaceholder from "./assets/fruit-placeholder.png";
import saladPlaceholder from "./assets/salad-placeholder.png";
import mainPlaceholder from "./assets/main-placeholder.png";
import butterPlaceholder from "./assets/butter-placeholder.png";
import saltpepperPlaceholder from "./assets/saltpepper-placeholder.png";
import waterPlaceholder from "./assets/water-placeholder.png";
import winePlaceholder from "./assets/wine-placeholder.png";
import utensilPlaceholder from "./assets/utensil-placeholder.png";

const BusinessClass: React.FC<BusinessClassProps> = () => {
	const [trayType, setTrayType] = useState<TrayType>("A");
	const [ITEMS_CONFIG, setItemsConfig] = useState<ItemsConfig>({});
	const [placedItems, setPlacedItems] = useState<PlacedItems>({});
	const [correctPositions, setCorrectPositions] = useState<CorrectPositions>({});
	const [draggedItem, setDraggedItem] = useState<string | null>(null);
	const [feedback, setFeedback] = useState<string>("");
	const [showCorrectPositions, setShowCorrectPositions] = useState<boolean>(false);
	const [hoveredItem, setHoveredItem] = useState<string | null>(null);
	const [isInitialized, setIsInitialized] = useState<boolean>(false);
	
	const dropZoneRef = useRef<HTMLDivElement>(null);
	const tableSurfaceRef = useRef<HTMLDivElement>(null);

	console.log("🚀 BusinessClass component render - isInitialized:", isInitialized);

	// Physical measurements in centimeters - defined once for all items
	const ITEM_MEASUREMENTS = {
		TABLE_TRAY_WIDTH_CM: 35,
		TABLE_TRAY_HEIGHT_CM: 30, //27.5,
		MAIN_PLATE: { width: 19.5, height: 15.5 },
		SALAD_BOWL: { diameter: 12.5 },
		BREAD_PLATE: { diameter: 19.8 },
		DESSERT_BOWL: { diameter: 16 },
		WATER_GLASS: { diameter: 5.5 },
		WINE_GLASS: { diameter: 5.5 },
		SALT_PEPPER: { width: 6.8, height: 3 },
		UTENSILS: { width: 6, height: 21 },
		BUTTER_DISH: { width: 7.7, height: 7.7 },
	};

	// Define which items each type uses
	const TYPE_ITEMS = {
		A: [
			"main-plate",
			"salad-bowl",
			"bread-plate",
			"water-glass",
			"wine-glass",
			"salt-pepper",
			"utensils",
			"butter-dish",
		],
		B: [
			"main-plate",
			"salad-bowl",
			"bread-plate",
			"dessert-bowl",
			"utensils",
			"salt-pepper",
			"butter-dish",
			"water-glass",
		],
	};

	// FIXED: Wrap in useCallback to satisfy ESLint dependency requirements
	const getBaseItemConfig = useCallback((currentTrayType: TrayType): ItemsConfig => {
		const dropZoneWidth = dropZoneRef.current?.clientWidth || (typeof window !== "undefined" ? window.innerWidth * 0.9 : 1000);
		const dropZoneHeight = dropZoneRef.current?.clientHeight || (typeof window !== "undefined" ? window.innerHeight * 0.6 : 600);
		
		// Get actual table surface dimensions from rendered element
		// The CSS uses: width: 85%, aspect-ratio: 38/27.5, max-height: 90%
		// We need to calculate what the actual rendered size will be
		const targetWidth = dropZoneWidth * 0.85;
		const targetHeight = targetWidth * (ITEM_MEASUREMENTS.TABLE_TRAY_HEIGHT_CM / ITEM_MEASUREMENTS.TABLE_TRAY_WIDTH_CM); // aspect ratio
		const maxHeight = dropZoneHeight * 0.90;
		
		// If aspect-ratio height exceeds max-height, constrain by height
		let tableSurfaceWidthPx, tableSurfaceHeightPx;
		if (targetHeight > maxHeight) {
			tableSurfaceHeightPx = maxHeight;
			tableSurfaceWidthPx = tableSurfaceHeightPx * (ITEM_MEASUREMENTS.TABLE_TRAY_WIDTH_CM / ITEM_MEASUREMENTS.TABLE_TRAY_HEIGHT_CM);
		} else {
			tableSurfaceWidthPx = targetWidth;
			tableSurfaceHeightPx = targetHeight;
		}
		
		// Calculate scale based on table dimensions
		// The table tray is 38cm x 27.5cm in real life
		const scaleX = tableSurfaceWidthPx / ITEM_MEASUREMENTS.TABLE_TRAY_WIDTH_CM;
		const scaleY = tableSurfaceHeightPx / ITEM_MEASUREMENTS.TABLE_TRAY_HEIGHT_CM;
		
		// Use the smaller scale to maintain aspect ratio and fit within table
		const pixelsPerCm = Math.min(scaleX, scaleY);
		
		console.log("📏 Size calculations:", {
			dropZoneWidth,
			dropZoneHeight,
			tableSurfaceWidthPx: tableSurfaceWidthPx.toFixed(1),
			tableSurfaceHeightPx: tableSurfaceHeightPx.toFixed(1),
			aspectRatio: (tableSurfaceWidthPx / tableSurfaceHeightPx).toFixed(3),
			targetAspectRatio: (ITEM_MEASUREMENTS.TABLE_TRAY_WIDTH_CM / ITEM_MEASUREMENTS.TABLE_TRAY_HEIGHT_CM).toFixed(3),
			pixelsPerCm: pixelsPerCm.toFixed(2),
			tableTrayDimensions: `${ITEM_MEASUREMENTS.TABLE_TRAY_WIDTH_CM}cm × ${ITEM_MEASUREMENTS.TABLE_TRAY_HEIGHT_CM}cm`
		});
		
		const cmToRem = (cm: number): string => {
			const pixels = cm * pixelsPerCm;
			const rem = pixels / 16;
			return `${rem}rem`;
		};
		
		const getSizeFromCm = (widthCm: number, heightCm: number) => ({
			width: cmToRem(widthCm),
			height: cmToRem(heightCm),
		});

		// Position configurations for each type
		const POSITIONS: Record<TrayType, Record<string, PositionPercent>> = {
			A: {
				"main-plate": { xPercent: 52, yPercent: 66 },
				"salad-bowl": { xPercent: 50, yPercent: 27 },
				"bread-plate": { xPercent: 29, yPercent: 71 },
				"water-glass": { xPercent: 68, yPercent: 16 },
				"wine-glass": { xPercent: 76, yPercent: 16 },
				"salt-pepper": { xPercent: 25, yPercent: 15 },
				utensils: { xPercent: 75, yPercent: 60 },
				"butter-dish": { xPercent: 31, yPercent: 32 },
			},
			B: {
				"main-plate": { xPercent: 45, yPercent: 45 },
				"salad-bowl": { xPercent: 25, yPercent: 12 },
				"bread-plate": { xPercent: 15, yPercent: 45 },
				"dessert-bowl": { xPercent: 75, yPercent: 45 },
				utensils: { xPercent: 88, yPercent: 35 },
				"salt-pepper": { xPercent: 52, yPercent: 18 },
				"butter-dish": { xPercent: 52, yPercent: 32 },
				"water-glass": { xPercent: 65, yPercent: 8 },
			},
		};

		// All possible item definitions
		const ALL_ITEMS: Record<string, { name: string; color: string; image: string; meas: { width?: number; height?: number; diameter?: number } }> = {
			"main-plate": {
				name: "Main Plate",
				color: "#e5e7eb",
				image: mainPlaceholder.src,
				meas: ITEM_MEASUREMENTS.MAIN_PLATE,
			},
			"salad-bowl": {
				name: "Salad Bowl",
				color: "#fecaca",
				image: saladPlaceholder.src,
				meas: ITEM_MEASUREMENTS.SALAD_BOWL,
			},
			"bread-plate": {
				name: "Bread Plate",
				color: "#fef3c7",
				image: breadPlaceholder.src,
				meas: ITEM_MEASUREMENTS.BREAD_PLATE,
			},
			"dessert-bowl": {
				name: "Dessert Bowl",
				color: "#e0e7ff",
				image: fruitPlaceholder.src,
				meas: ITEM_MEASUREMENTS.DESSERT_BOWL,
			},
			"water-glass": {
				name: "Water Glass",
				color: "#dbeafe",
				image: waterPlaceholder.src,
				meas: ITEM_MEASUREMENTS.WATER_GLASS,
			},
			"wine-glass": {
				name: "Wine Glass",
				color: "#e9d5ff",
				image: winePlaceholder.src,
				meas: ITEM_MEASUREMENTS.WINE_GLASS,
			},
			"salt-pepper": {
				name: "Salt & Pepper",
				color: "#9ca3af",
				image: saltpepperPlaceholder.src,
				meas: ITEM_MEASUREMENTS.SALT_PEPPER,
			},
			utensils: {
				name: "Utensils",
				color: "#d1d5db",
				image: utensilPlaceholder.src,
				meas: ITEM_MEASUREMENTS.UTENSILS,
			},
			"butter-dish": {
				name: "Butter Dish",
				color: "#fecaca",
				image: butterPlaceholder.src,
				meas: ITEM_MEASUREMENTS.BUTTER_DISH,
			},
		};

		const TRAY_SCALE = 0.22;
		const itemsForType = TYPE_ITEMS[currentTrayType];
		const positions = POSITIONS[currentTrayType];

		// Build config only for items used by this type
		const config: ItemsConfig = {};
		itemsForType.forEach((itemId) => {
			const itemDef = ALL_ITEMS[itemId];
			if (!itemDef || !positions[itemId]) return;

			const { meas } = itemDef;
			const width = meas.width || meas.diameter || 0;
			const height = meas.height || meas.diameter || 0;

			config[itemId] = {
				name: itemDef.name,
				color: itemDef.color,
				size: getSizeFromCm(width, height),
				traySize: getSizeFromCm(width * TRAY_SCALE, height * TRAY_SCALE),
				positionPercent: positions[itemId],
				image: itemDef.image,
			};
		});

		console.log(`Config generated with ${Object.keys(config).length} items for Type ${currentTrayType}`);
		return config;
	}, []); // FIXED: Empty dependencies - function doesn't depend on external state

	const updateCorrectPositions = useCallback((config: ItemsConfig): void => {
		if (!dropZoneRef.current || Object.keys(config).length === 0) return;

		const dropZoneRect = dropZoneRef.current.getBoundingClientRect();
		const newCorrectPositions: CorrectPositions = {};

		Object.entries(config).forEach(([itemId, itemConfig]) => {
			const { xPercent, yPercent } = itemConfig.positionPercent;
			const x = (dropZoneRect.width * xPercent) / 100;
			const y = (dropZoneRect.height * yPercent) / 100;
			const itemWidthPx = parseFloat(itemConfig.size.width) * 16;
			const itemHeightPx = parseFloat(itemConfig.size.height) * 16;

			newCorrectPositions[itemId] = {
				x: x - itemWidthPx / 2,
				y: y - itemHeightPx / 2,
			};
		});

		setCorrectPositions(newCorrectPositions);
	}, []);

	// Initialize on mount only
	useEffect(() => {
		if (!isInitialized) {
			console.log("Initializing BusinessClass component...");
			// Generate config immediately - don't wait for refs
			const config = getBaseItemConfig(trayType);
			console.log("Config generated with", Object.keys(config).length, "items");
			setItemsConfig(config);
			setIsInitialized(true);
		}
	}, [isInitialized, trayType, getBaseItemConfig]); // FIXED: Added getBaseItemConfig dependency

	// Update correct positions when refs become available
	useEffect(() => {
		if (isInitialized && Object.keys(ITEMS_CONFIG).length > 0 && dropZoneRef.current) {
			console.log("Refs are ready, updating correct positions...");
			updateCorrectPositions(ITEMS_CONFIG);
		}
	}, [isInitialized, ITEMS_CONFIG, updateCorrectPositions]); // FIXED: Added updateCorrectPositions dependency

	// Handle ESC key to close modal
	useEffect(() => {
		const handleEscape = (e: KeyboardEvent) => {
			if (e.key === 'Escape' && feedback) {
				setFeedback("");
			}
		};
		
		window.addEventListener('keydown', handleEscape);
		return () => window.removeEventListener('keydown', handleEscape);
	}, [feedback]);

	// Handle resize events
	useEffect(() => {
		if (!isInitialized) return;

		let resizeTimer: NodeJS.Timeout;
		
		const handleResize = () => {
			clearTimeout(resizeTimer);
			resizeTimer = setTimeout(() => {
				const config = getBaseItemConfig(trayType);
				setItemsConfig(config);
				updateCorrectPositions(config);
			}, 250);
		};

		window.addEventListener("resize", handleResize);
		window.addEventListener("orientationchange", handleResize);

		return () => {
			clearTimeout(resizeTimer);
			window.removeEventListener("resize", handleResize);
			window.removeEventListener("orientationchange", handleResize);
		};
	}, [isInitialized, trayType, updateCorrectPositions, getBaseItemConfig]); // FIXED: Added getBaseItemConfig dependency

	const handleDragStart = (e: React.DragEvent<HTMLDivElement>, itemId: string): void => {
		setDraggedItem(itemId);
		e.dataTransfer.effectAllowed = "move";
		console.log("Drag started:", itemId);
	};

	const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>, itemId: string): void => {
		setDraggedItem(itemId);
		console.log("Touch started:", itemId);
		// Don't preventDefault - let CSS touch-action handle it
	};

	const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>): void => {
		if (!draggedItem || !dropZoneRef.current) return;
		
		// Don't preventDefault - it won't work in passive listeners
		// CSS touch-action: none will prevent scrolling instead

		const touch = e.touches[0];
		const config = ITEMS_CONFIG[draggedItem];
		const dropZoneRect = dropZoneRef.current.getBoundingClientRect();
		const widthPx = parseFloat(config.size.width) * 16;
		const heightPx = parseFloat(config.size.height) * 16;

		let x = touch.clientX - dropZoneRect.left - widthPx / 2;
		let y = touch.clientY - dropZoneRect.top - heightPx / 2;

		const maxX = dropZoneRect.width - widthPx;
		const minX = 0;
		x = Math.max(minX, Math.min(maxX, x));

		const maxY = dropZoneRect.height - heightPx;
		const minY = 0;
		y = Math.max(minY, Math.min(maxY, y));

		setPlacedItems((prev) => ({
			...prev,
			[draggedItem]: { x, y },
		}));
	};

	const handleTouchEnd = (e: React.TouchEvent<HTMLDivElement>): void => {
		if (!draggedItem || !tableSurfaceRef.current) {
			setDraggedItem(null);
			return;
		}

		const touch = e.changedTouches[0];
		const tableSurfaceRect = tableSurfaceRef.current.getBoundingClientRect();

		const isWithinTableSurface =
			touch.clientX >= tableSurfaceRect.left &&
			touch.clientX <= tableSurfaceRect.right &&
			touch.clientY >= tableSurfaceRect.top &&
			touch.clientY <= tableSurfaceRect.bottom;

		if (!isWithinTableSurface) {
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
		console.log("Drop event triggered");
		
		if (!draggedItem || !dropZoneRef.current || !tableSurfaceRef.current) {
			console.log("Drop cancelled - missing refs or draggedItem");
			return;
		}

		const dropZoneRect = dropZoneRef.current.getBoundingClientRect();
		const tableSurfaceRect = tableSurfaceRef.current.getBoundingClientRect();
		const config = ITEMS_CONFIG[draggedItem];

		const widthPx = parseFloat(config.size.width) * 16;
		const heightPx = parseFloat(config.size.height) * 16;

		const isWithinTableSurface =
			e.clientX >= tableSurfaceRect.left &&
			e.clientX <= tableSurfaceRect.right &&
			e.clientY >= tableSurfaceRect.top &&
			e.clientY <= tableSurfaceRect.bottom;

		console.log("Drop within table surface:", isWithinTableSurface);

		if (isWithinTableSurface) {
			let x = e.clientX - dropZoneRect.left - widthPx / 2;
			let y = e.clientY - dropZoneRect.top - heightPx / 2;

			const maxX = dropZoneRect.width - widthPx;
			const minX = 0;
			x = Math.max(minX, Math.min(maxX, x));

			const maxY = dropZoneRect.height - heightPx;
			const minY = 0;
			y = Math.max(minY, Math.min(maxY, y));

			console.log("Placing item at:", { x, y });

			setPlacedItems((prev) => ({
				...prev,
				[draggedItem]: { x, y },
			}));
		} else {
			console.log("Item dropped outside table surface - removing from placed items");
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
		if (draggedItem) {
			console.log("Drag ended:", draggedItem);
			setDraggedItem(null);
		}
	};

	const calculateDistance = (pos1: Position, pos2: Position): number => {
		return Math.sqrt(Math.pow(pos1.x - pos2.x, 2) + Math.pow(pos1.y - pos2.y, 2));
	};

	const checkPlacement = (): void => {
		const results: string[] = [];
		const tolerance = 30;

		Object.keys(ITEMS_CONFIG).forEach((itemId) => {
			const placedPos = placedItems[itemId];
			const correctPos = correctPositions[itemId];

			if (!placedPos) {
				results.push(`❌ ${ITEMS_CONFIG[itemId].name}: Not placed`);
			} else if (!correctPos) {
				results.push(`⚠️ ${ITEMS_CONFIG[itemId].name}: Position not calculated`);
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
						`❌ ${ITEMS_CONFIG[itemId].name}: Off by ${Math.abs(xDiff)}px ${xDirection}, ${Math.abs(yDiff)}px ${yDirection}`
					);
				}
			}
		});

		const correctCount = results.filter((r) => r.includes("✅")).length;
		const totalItems = Object.keys(ITEMS_CONFIG).length;
		const score = Math.round((correctCount / totalItems) * 100);

		setFeedback(`Score: ${score}% (${correctCount}/${totalItems} correct)\n\n${results.join("\n")}`);
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
		setPlacedItems({});
		setFeedback("");
		setShowCorrectPositions(false);
		
		// Update config for new tray type
		const config = getBaseItemConfig(newTrayType);
		setItemsConfig(config);
		
		setTimeout(() => {
			updateCorrectPositions(config);
		}, 100);
	};

	// Don't render until initialized
	if (!isInitialized || Object.keys(ITEMS_CONFIG).length === 0) {
		console.log("Loading state - isInitialized:", isInitialized, "ITEMS_CONFIG keys:", Object.keys(ITEMS_CONFIG).length);
		return (
			<div className={styles.businessClassContainer}>
				<Navbar />
				<div className={styles.container}>
					<div style={{ 
						display: 'flex', 
						flexDirection: 'column',
						justifyContent: 'center', 
						alignItems: 'center', 
						height: '100vh',
						gap: '1rem'
					}}>
						<p style={{ fontSize: '1.5rem' }}>Loading Business Class Training...</p>
						<p style={{ fontSize: '0.9rem', color: '#666' }}>
							{!isInitialized ? 'Initializing component...' : 'Loading configuration...'}
						</p>
						{/* Debug info - remove in production */}
						<p style={{ fontSize: '0.8rem', color: '#999' }}>
							Check console (F12) for debug info
						</p>
					</div>
				</div>
			</div>
		);
	}

	return (
		<div className={styles.businessClassContainer}>
			<Navbar />
			<div className={styles.container}>
				{/* Top Controls - Game-inspired UI */}
				<div className={styles.topControls}>
					<div className={styles.trayTypeSelector}>
						<button
							onClick={() => handleTrayTypeChange("A")}
							className={`${styles.trayTypeBtn} ${trayType === "A" ? styles.activeTray : ""}`}
						>
							<span className={styles.trayLabel}>A</span>
						</button>
						<button
							onClick={() => handleTrayTypeChange("B")}
							className={`${styles.trayTypeBtn} ${trayType === "B" ? styles.activeTray : ""}`}
						>
							<span className={styles.trayLabel}>B</span>
						</button>
					</div>
					{trayType === "B" && (
						<div className={styles.typeBRemark}>
							<span className={styles.remarkIcon}>ℹ️</span>
							<span className={styles.remarkText}>除台中出發往返航班，(S/P)無須主動擺設</span>
						</div>
					)}

					<div className={styles.actionButtons}>
						<button onClick={checkPlacement} className={`${styles.gameBtn} ${styles.submitBtn}`}>
							<span className={styles.btnIcon}>✓</span>
							<span className={styles.btnText}>Submit</span>
						</button>
						<button onClick={resetPlacement} className={`${styles.gameBtn} ${styles.resetBtn}`}>
							<span className={styles.btnIcon}>↻</span>
							<span className={styles.btnText}>Reset</span>
						</button>
						<button onClick={toggleCorrectPositions} className={`${styles.gameBtn} ${styles.hintBtn}`}>
							<span className={styles.btnIcon}>💡</span>
							<span className={styles.btnText}>{showCorrectPositions ? "Hide" : "Hint"}</span>
						</button>
					</div>
				</div>

				<div className={styles.mainContent}>
					<div className={styles.dropZoneContainer}>
						<div ref={dropZoneRef} className={styles.dropZone} onDragOver={handleDragOver} onDrop={handleDrop}>
							<div className={styles.tableSurface} ref={tableSurfaceRef}>
								<div className={styles.tableSurfaceText}>Table Surface</div>
							</div>

							{showCorrectPositions &&
								Object.entries(correctPositions).map(([itemId, position]) => {
									const config = ITEMS_CONFIG[itemId];
									if (!config) return null;
									return (
										<div
											key={`correct-${itemId}`}
											className={styles.correctPosition}
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
								})}

							{Object.entries(placedItems).map(([itemId, position]) => {
								const config = ITEMS_CONFIG[itemId];
								if (!config) return null;
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
										onDragStart={(e) => handleDragStart(e, itemId)}
										onDragEnd={handleDragEnd}
										onTouchStart={(e) => handleTouchStart(e, itemId)}
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
							})}
						</div>
					</div>

					{feedback && (
						<div className={styles.feedbackModal} onClick={() => setFeedback("")}>
							<div className={styles.feedbackModalContent} onClick={(e) => e.stopPropagation()}>
								<div className={styles.feedbackHeader}>
									<h3 className={styles.feedbackTitle}>Results</h3>
									<button 
										className={styles.feedbackClose}
										onClick={() => setFeedback("")}
										title="Close"
									>
										✕
									</button>
								</div>
								<div className={styles.feedbackBody}>
									<pre className={styles.feedbackText}>{feedback}</pre>
								</div>
							</div>
						</div>
					)}

					<div className={styles.itemsTray}>
						<h3 className={styles.trayTitle}>Items Tray 托盘物品 - Type {trayType}</h3>
						<div className={styles.trayItems}>
							{Object.entries(ITEMS_CONFIG).map(([itemId, config]) => {
								const isPlaced = placedItems[itemId];
								return (
									<div
										key={itemId}
										className={`${styles.trayItem} ${isPlaced ? styles.placed : ""}`}
										style={{
											width: config.traySize.width,
											height: config.traySize.height,
										}}
										draggable={!isPlaced}
										onDragStart={(e) => !isPlaced && handleDragStart(e, itemId)}
										onDragEnd={handleDragEnd}
										onTouchStart={(e) => !isPlaced && handleTouchStart(e, itemId)}
										onTouchMove={!isPlaced ? handleTouchMove : undefined}
										onTouchEnd={!isPlaced ? handleTouchEnd : undefined}
										onMouseEnter={() => setHoveredItem(itemId)}
										onMouseLeave={() => setHoveredItem(null)}
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
										{hoveredItem === itemId && !isPlaced && (
											<div className={styles.itemTooltip}>{config.name}</div>
										)}
									</div>
								);
							})}
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default BusinessClass;