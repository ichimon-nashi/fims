// src/components/bc-training/types.ts

import { User } from "@/lib/types";

export interface Position {
	x: number;
	y: number;
}

export interface PositionPercent {
	xPercent: number;
	yPercent: number;
}

export interface Size {
	width: string;
	height: string;
}

export interface ItemConfig {
	name: string;
	color: string;
	size: Size;
	traySize: Size;
	positionPercent: PositionPercent;
	image: string;
}

export interface ItemsConfig {
	[key: string]: ItemConfig;
}

export interface PlacedItems {
	[key: string]: Position;
}

export interface CorrectPositions {
	[key: string]: Position;
}

export type TrayType = "A" | "B";

export interface TouchOffset {
	x: number;
	y: number;
}

export interface BusinessClassProps {
	userDetails?: User;
	onLogout?: () => void;
}