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

const BusinessClass: React.FC<BusinessClassProps> = () => {
	const [trayType, setTrayType] = useState<TrayType>("A");
	const [ITEMS_CONFIG, setItemsConfig] = useState<ItemsConfig>({});
	const [placedItems, setPlacedItems] = useState<PlacedItems>({});
	const [correctPositions, setCorrectPositions] = useState<CorrectPositions>({});
	const [draggedItem, setDraggedItem] = useState<string | null>(null);
	const [feedback, setFeedback] = useState<string>("");
	const [showCorrectPositions, setShowCorrectPositions] = useState<boolean>(false);
	const [isLandscape, setIsLandscape] = useState<boolean>(true);
	const [hoveredItem, setHoveredItem] = useState<string | null>(null);
	const dropZoneRef = useRef<HTMLDivElement>(null);
	const tableSurfaceRef = useRef<HTMLDivElement>(null);

	// Physical measurements in centimeters - REPLACE THESE WITH YOUR ACTUAL MEASUREMENTS
	const PHYSICAL_MEASUREMENTS: {
		TABLE_TRAY_WIDTH_CM: number;
		TABLE_TRAY_HEIGHT_CM: number;
		A: {
			MAIN_PLATE_WIDTH_CM: number;
			MAIN_PLATE_HEIGHT_CM: number;
			SALAD_PLATE_DIAMETER_CM: number;
			FRUIT_BOWL_DIAMETER_CM: number;
			BREAD_PLATE_DIAMETER_CM: number;
			UTENSILS_WIDTH_CM: number;
			UTENSILS_HEIGHT_CM: number;
			WATER_GLASS_DIAMETER_CM: number;
			WINE_GLASS_DIAMETER_CM: number;
			SALT_PEPPER_WIDTH_CM: number;
			SALT_PEPPER_HEIGHT_CM: number;
			BUTTER_DISH_WIDTH_CM: number;
			BUTTER_DISH_HEIGHT_CM: number;
		};
		B: {
			MAIN_PLATE_WIDTH_CM: number;
			MAIN_PLATE_HEIGHT_CM: number;
			APPETIZER_PLATE_DIAMETER_CM: number;
			SOUP_BOWL_DIAMETER_CM: number;
			BREAD_PLATE_DIAMETER_CM: number;
			DESSERT_PLATE_DIAMETER_CM: number;
			UTENSILS_WIDTH_CM: number;
			UTENSILS_HEIGHT_CM: number;
			WATER_GLASS_DIAMETER_CM: number;
			WINE_GLASS_DIAMETER_CM: number;
			NAPKIN_WIDTH_CM: number;
			NAPKIN_HEIGHT_CM: number;
			CONDIMENT_TRAY_WIDTH_CM: number;
			CONDIMENT_TRAY_HEIGHT_CM: number;
		};
	} = {
		TABLE_TRAY_WIDTH_CM: 38,
		TABLE_TRAY_HEIGHT_CM: 27.5,
		A: {
			MAIN_PLATE_WIDTH_CM: 19.5,
			MAIN_PLATE_HEIGHT_CM: 15.5,
			SALAD_PLATE_DIAMETER_CM: 12.5,
			FRUIT_BOWL_DIAMETER_CM: 12.5,
			BREAD_PLATE_DIAMETER_CM: 19.8,
			UTENSILS_WIDTH_CM: 6,
			UTENSILS_HEIGHT_CM: 21,
			WATER_GLASS_DIAMETER_CM: 5.5,
			WINE_GLASS_DIAMETER_CM: 5.5,
			SALT_PEPPER_WIDTH_CM: 3,
			SALT_PEPPER_HEIGHT_CM: 6.8,
			BUTTER_DISH_WIDTH_CM: 7.7,
			BUTTER_DISH_HEIGHT_CM: 7.7,
		},
		B: {
			MAIN_PLATE_WIDTH_CM: 19.5,
			MAIN_PLATE_HEIGHT_CM: 15.5,
			APPETIZER_PLATE_DIAMETER_CM: 16,
			SOUP_BOWL_DIAMETER_CM: 20,
			BREAD_PLATE_DIAMETER_CM: 19.8,
			DESSERT_PLATE_DIAMETER_CM: 16,
			UTENSILS_WIDTH_CM: 6,
			UTENSILS_HEIGHT_CM: 21,
			WATER_GLASS_DIAMETER_CM: 5.5,
			WINE_GLASS_DIAMETER_CM: 5.5,
			NAPKIN_WIDTH_CM: 12,
			NAPKIN_HEIGHT_CM: 10,
			CONDIMENT_TRAY_WIDTH_CM: 14,
			CONDIMENT_TRAY_HEIGHT_CM: 8,
		},
	};

	const getBaseItemConfig = useCallback((trayType: TrayType = "A"): ItemsConfig => {
		const dropZoneWidth = dropZoneRef.current?.clientWidth || (typeof window !== "undefined" ? window.innerWidth * 0.9 : 1000);
		const tableSurfaceWidthPx = dropZoneWidth * 0.5;
		const pixelsPerCm = tableSurfaceWidthPx / PHYSICAL_MEASUREMENTS.TABLE_TRAY_WIDTH_CM;
		
		const cmToRem = (cm: number): string => {
			const pixels = cm * pixelsPerCm;
			const rem = pixels / 16;
			return `${rem}rem`;
		};
		
		const getSizeFromCm = (widthCm: number, heightCm: number) => ({
			width: cmToRem(widthCm),
			height: cmToRem(heightCm),
		});

		const trayConfigurations: Record<TrayType, Record<string, PositionPercent>> = {
			A: {
				"main-plate": { xPercent: 52, yPercent: 66 },
				"salad-plate": { xPercent: 29, yPercent: 29 },
				"fruit-bowl": { xPercent: 52.5, yPercent: 27 },
				"bread-plate": { xPercent: 29, yPercent: 71 },
				utensils: { xPercent: 68, yPercent: 65 },
				"water-glass": { xPercent: 68, yPercent: 16 },
				"wine-glass": { xPercent: 76, yPercent: 16 },
				"salt-pepper": { xPercent: 42.5, yPercent: 17 },
				"butter-dish": { xPercent: 41, yPercent: 25 },
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
		const TRAY_SCALE = 0.22;
		
		if (trayType === "A") {
			const measA = PHYSICAL_MEASUREMENTS.A;
			return {
				"main-plate": {
					name: "Main Plate",
					color: "#e5e7eb",
					size: getSizeFromCm(measA.MAIN_PLATE_WIDTH_CM, measA.MAIN_PLATE_HEIGHT_CM),
					traySize: getSizeFromCm(measA.MAIN_PLATE_WIDTH_CM * TRAY_SCALE, measA.MAIN_PLATE_HEIGHT_CM * TRAY_SCALE),
					positionPercent: basePositions["main-plate"],
					image: mainPlaceholder.src,
				},
				"salad-plate": {
					name: "Salad Plate",
					color: "#fecaca",
					size: getSizeFromCm(measA.SALAD_PLATE_DIAMETER_CM, measA.SALAD_PLATE_DIAMETER_CM),
					traySize: getSizeFromCm(measA.SALAD_PLATE_DIAMETER_CM * TRAY_SCALE, measA.SALAD_PLATE_DIAMETER_CM * TRAY_SCALE),
					positionPercent: basePositions["salad-plate"],
					image: saladPlaceholder.src,
				},
				"fruit-bowl": {
					name: "Fruit Bowl",
					color: "#fecaca",
					size: getSizeFromCm(measA.FRUIT_BOWL_DIAMETER_CM, measA.FRUIT_BOWL_DIAMETER_CM),
					traySize: getSizeFromCm(measA.FRUIT_BOWL_DIAMETER_CM * TRAY_SCALE, measA.FRUIT_BOWL_DIAMETER_CM * TRAY_SCALE),
					positionPercent: basePositions["fruit-bowl"],
					image: fruitPlaceholder.src,
				},
				"bread-plate": {
					name: "Bread Plate",
					color: "#fef3c7",
					size: getSizeFromCm(measA.BREAD_PLATE_DIAMETER_CM, measA.BREAD_PLATE_DIAMETER_CM),
					traySize: getSizeFromCm(measA.BREAD_PLATE_DIAMETER_CM * TRAY_SCALE, measA.BREAD_PLATE_DIAMETER_CM * TRAY_SCALE),
					positionPercent: basePositions["bread-plate"],
					image: breadPlaceholder.src,
				},
				utensils: {
					name: "Utensils",
					color: "#d1d5db",
					size: getSizeFromCm(measA.UTENSILS_WIDTH_CM, measA.UTENSILS_HEIGHT_CM),
					traySize: getSizeFromCm(measA.UTENSILS_WIDTH_CM * TRAY_SCALE, measA.UTENSILS_HEIGHT_CM * TRAY_SCALE),
					positionPercent: basePositions["utensils"],
					image: utensilPlaceholder.src,
				},
				"water-glass": {
					name: "Water Glass",
					color: "#dbeafe",
					size: getSizeFromCm(measA.WATER_GLASS_DIAMETER_CM, measA.WATER_GLASS_DIAMETER_CM),
					traySize: getSizeFromCm(measA.WATER_GLASS_DIAMETER_CM * TRAY_SCALE, measA.WATER_GLASS_DIAMETER_CM * TRAY_SCALE),
					positionPercent: basePositions["water-glass"],
					image: waterPlaceholder.src,
				},
				"wine-glass": {
					name: "Wine Glass",
					color: "#e9d5ff",
					size: getSizeFromCm(measA.WINE_GLASS_DIAMETER_CM, measA.WINE_GLASS_DIAMETER_CM),
					traySize: getSizeFromCm(measA.WINE_GLASS_DIAMETER_CM * TRAY_SCALE, measA.WINE_GLASS_DIAMETER_CM * TRAY_SCALE),
					positionPercent: basePositions["wine-glass"],
					image: winePlaceholder.src,
				},
				"salt-pepper": {
					name: "Salt & Pepper",
					color: "#9ca3af",
					size: getSizeFromCm(measA.SALT_PEPPER_WIDTH_CM, measA.SALT_PEPPER_HEIGHT_CM),
					traySize: getSizeFromCm(measA.SALT_PEPPER_WIDTH_CM * TRAY_SCALE, measA.SALT_PEPPER_HEIGHT_CM * TRAY_SCALE),
					positionPercent: basePositions["salt-pepper"],
					image: saltpepperPlaceholder.src,
				},
				"butter-dish": {
					name: "Butter Dish",
					color: "#fecaca",
					size: getSizeFromCm(measA.BUTTER_DISH_WIDTH_CM, measA.BUTTER_DISH_HEIGHT_CM),
					traySize: getSizeFromCm(measA.BUTTER_DISH_WIDTH_CM * TRAY_SCALE, measA.BUTTER_DISH_HEIGHT_CM * TRAY_SCALE),
					positionPercent: basePositions["butter-dish"],
					image: butterPlaceholder.src,
				},
			};
		} else {
			const measB = PHYSICAL_MEASUREMENTS.B;
			return {
				"main-plate": {
					name: "Main Plate",
					color: "#e5e7eb",
					size: getSizeFromCm(measB.MAIN_PLATE_WIDTH_CM, measB.MAIN_PLATE_HEIGHT_CM),
					traySize: getSizeFromCm(measB.MAIN_PLATE_WIDTH_CM * TRAY_SCALE, measB.MAIN_PLATE_HEIGHT_CM * TRAY_SCALE),
					positionPercent: basePositions["main-plate"],
					image: mainPlaceholder.src,
				},
				"appetizer-plate": {
					name: "Appetizer Plate",
					color: "#fed7d7",
					size: getSizeFromCm(measB.APPETIZER_PLATE_DIAMETER_CM, measB.APPETIZER_PLATE_DIAMETER_CM),
					traySize: getSizeFromCm(measB.APPETIZER_PLATE_DIAMETER_CM * TRAY_SCALE, measB.APPETIZER_PLATE_DIAMETER_CM * TRAY_SCALE),
					positionPercent: basePositions["appetizer-plate"],
					image: saladPlaceholder.src,
				},
				"soup-bowl": {
					name: "Soup Bowl",
					color: "#fef5e7",
					size: getSizeFromCm(measB.SOUP_BOWL_DIAMETER_CM, measB.SOUP_BOWL_DIAMETER_CM),
					traySize: getSizeFromCm(measB.SOUP_BOWL_DIAMETER_CM * TRAY_SCALE, measB.SOUP_BOWL_DIAMETER_CM * TRAY_SCALE),
					positionPercent: basePositions["soup-bowl"],
					image: fruitPlaceholder.src,
				},
				"bread-plate": {
					name: "Bread Plate",
					color: "#fef3c7",
					size: getSizeFromCm(measB.BREAD_PLATE_DIAMETER_CM, measB.BREAD_PLATE_DIAMETER_CM),
					traySize: getSizeFromCm(measB.BREAD_PLATE_DIAMETER_CM * TRAY_SCALE, measB.BREAD_PLATE_DIAMETER_CM * TRAY_SCALE),
					positionPercent: basePositions["bread-plate"],
					image: breadPlaceholder.src,
				},
				"dessert-plate": {
					name: "Dessert Plate",
					color: "#e0e7ff",
					size: getSizeFromCm(measB.DESSERT_PLATE_DIAMETER_CM, measB.DESSERT_PLATE_DIAMETER_CM),
					traySize: getSizeFromCm(measB.DESSERT_PLATE_DIAMETER_CM * TRAY_SCALE, measB.DESSERT_PLATE_DIAMETER_CM * TRAY_SCALE),
					positionPercent: basePositions["dessert-plate"],
					image: saladPlaceholder.src,
				},
				utensils: {
					name: "Utensils",
					color: "#d1d5db",
					size: getSizeFromCm(measB.UTENSILS_WIDTH_CM, measB.UTENSILS_HEIGHT_CM),
					traySize: getSizeFromCm(measB.UTENSILS_WIDTH_CM * TRAY_SCALE, measB.UTENSILS_HEIGHT_CM * TRAY_SCALE),
					positionPercent: basePositions["utensils"],
					image: utensilPlaceholder.src,
				},
				"water-glass": {
					name: "Water Glass",
					color: "#dbeafe",
					size: getSizeFromCm(measB.WATER_GLASS_DIAMETER_CM, measB.WATER_GLASS_DIAMETER_CM),
					traySize: getSizeFromCm(measB.WATER_GLASS_DIAMETER_CM * TRAY_SCALE, measB.WATER_GLASS_DIAMETER_CM * TRAY_SCALE),
					positionPercent: basePositions["water-glass"],
					image: waterPlaceholder.src,
				},
				"wine-glass": {
					name: "Wine Glass",
					color: "#e9d5ff",
					size: getSizeFromCm(measB.WINE_GLASS_DIAMETER_CM, measB.WINE_GLASS_DIAMETER_CM),
					traySize: getSizeFromCm(measB.WINE_GLASS_DIAMETER_CM * TRAY_SCALE, measB.WINE_GLASS_DIAMETER_CM * TRAY_SCALE),
					positionPercent: basePositions["wine-glass"],
					image: winePlaceholder.src,
				},
				napkin: {
					name: "Napkin",
					color: "#f0f9ff",
					size: getSizeFromCm(measB.NAPKIN_WIDTH_CM, measB.NAPKIN_HEIGHT_CM),
					traySize: getSizeFromCm(measB.NAPKIN_WIDTH_CM * TRAY_SCALE, measB.NAPKIN_HEIGHT_CM * TRAY_SCALE),
					positionPercent: basePositions["napkin"],
					image: saltpepperPlaceholder.src,
				},
				"condiment-tray": {
					name: "Condiment Tray",
					color: "#f7fafc",
					size: getSizeFromCm(measB.CONDIMENT_TRAY_WIDTH_CM, measB.CONDIMENT_TRAY_HEIGHT_CM),
					traySize: getSizeFromCm(measB.CONDIMENT_TRAY_WIDTH_CM * TRAY_SCALE, measB.CONDIMENT_TRAY_HEIGHT_CM * TRAY_SCALE),
					positionPercent: basePositions["condiment-tray"],
					image: butterPlaceholder.src,
				},
			};
		}
	}, []);

	const updateCorrectPositions = useCallback((): void => {
		if (!dropZoneRef.current) return;

		const dropZoneRect = dropZoneRef.current.getBoundingClientRect();
		const newCorrectPositions: CorrectPositions = {};

		Object.entries(ITEMS_CONFIG).forEach(([itemId, config]) => {
			const { xPercent, yPercent } = config.positionPercent;
			const x = (dropZoneRect.width * xPercent) / 100;
			const y = (dropZoneRect.height * yPercent) / 100;
			const itemWidthPx = parseFloat(config.size.width) * 16;
			const itemHeightPx = parseFloat(config.size.height) * 16;

			newCorrectPositions[itemId] = {
				x: x - itemWidthPx / 2,
				y: y - itemHeightPx / 2,
			};
		});

		setCorrectPositions(newCorrectPositions);
	}, [ITEMS_CONFIG]);

	useEffect(() => {
		const checkOrientation = (): void => {
			if (typeof window === "undefined") return;

			const isLandscapeMode = window.innerWidth > window.innerHeight;
			setIsLandscape(isLandscapeMode);

			const newConfig = getBaseItemConfig(trayType);
			setItemsConfig(newConfig);

			setTimeout(() => {
				updateCorrectPositions();
			}, 100);
		};

		checkOrientation();

		if (typeof window !== "undefined") {
			window.addEventListener("resize", checkOrientation);
			window.addEventListener("orientationchange", checkOrientation);

			return () => {
				window.removeEventListener("resize", checkOrientation);
				window.removeEventListener("orientationchange", checkOrientation);
			};
		}
	}, [trayType, getBaseItemConfig, updateCorrectPositions]);

	useEffect(() => {
		const initialConfig = getBaseItemConfig(trayType);
		setItemsConfig(initialConfig);
	}, [trayType, getBaseItemConfig]);

	useEffect(() => {
		if (dropZoneRef.current && Object.keys(ITEMS_CONFIG).length > 0) {
			updateCorrectPositions();
		}
	}, [ITEMS_CONFIG, updateCorrectPositions]);

	const handleDragStart = (e: React.DragEvent<HTMLDivElement>, itemId: string): void => {
		setDraggedItem(itemId);
		e.dataTransfer.effectAllowed = "move";
	};

	const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>, itemId: string): void => {
		setDraggedItem(itemId);
		e.preventDefault();
	};

	const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>): void => {
		e.preventDefault();
		if (!draggedItem || !dropZoneRef.current) return;

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
		if (!draggedItem || !tableSurfaceRef.current) return;

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
		if (!draggedItem || !dropZoneRef.current || !tableSurfaceRef.current) return;

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

		if (isWithinTableSurface) {
			let x = e.clientX - dropZoneRect.left - widthPx / 2;
			let y = e.clientY - dropZoneRect.top - heightPx / 2;

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
		} else {
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
		const newConfig = getBaseItemConfig(newTrayType);
		setItemsConfig(newConfig);
		setPlacedItems({});
		setCorrectPositions({});
		setFeedback("");
		setShowCorrectPositions(false);
		setTimeout(() => {
			updateCorrectPositions();
		}, 100);
	};

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
				<div className={styles.header}>
					<div className={styles.headerContent}>
						<div className={styles.trayTypeToggle}>
							<span className={styles.trayTypeLabel}>Tray Type:</span>
							<div className={styles.toggleButtons}>
								<button
									onClick={() => handleTrayTypeChange("A")}
									className={`${styles.toggleButton} ${trayType === "A" ? styles.active : ""}`}
								>
									Type A
								</button>
								<button
									onClick={() => handleTrayTypeChange("B")}
									className={`${styles.toggleButton} ${trayType === "B" ? styles.active : ""}`}
								>
									Type B
								</button>
							</div>
						</div>
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

					<div className={styles.controlButtons}>
						<button onClick={checkPlacement} className={`${styles.button} ${styles.submitButton}`}>
							Submit & Check
						</button>
						<button onClick={resetPlacement} className={`${styles.button} ${styles.resetButton}`}>
							Reset
						</button>
						<button onClick={toggleCorrectPositions} className={`${styles.button} ${styles.toggleButton}`}>
							{showCorrectPositions ? "Hide" : "Show"} Correct Positions
						</button>
					</div>

					{feedback && (
						<div className={styles.feedback}>
							<h3 className={styles.feedbackTitle}>Results:</h3>
							<pre className={styles.feedbackText}>{feedback}</pre>
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