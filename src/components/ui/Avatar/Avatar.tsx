// src/components/ui/Avatar/Avatar.tsx - Fixed version with correct URL handling
"use client";

import { useState } from "react";
import Image from "next/image";
import styles from "./Avatar.module.css";

interface AvatarProps {
	employeeId: string;
	fullName: string;
	size?: "small" | "medium" | "large";
	className?: string;
}

const Avatar = ({
	employeeId,
	fullName,
	size = "medium",
	className = "",
}: AvatarProps) => {
	const [imageError, setImageError] = useState(false);
	const [fallbackError, setFallbackError] = useState(false);

	// Fixed URL construction - using your actual Supabase URL
	const avatarUrl = employeeId
		? `https://rhdpkxkmugimtlbdizfp.supabase.co/storage/v1/object/public/avatars/${employeeId}.png`
		: null;
	const fallbackUrl = `https://rhdpkxkmugimtlbdizfp.supabase.co/storage/v1/object/public/avatars/avatar-default.png`;

	const handleImageError = () => {
		console.log(`Failed to load avatar for ${employeeId}: ${avatarUrl}`);
		setImageError(true);
	};

	const handleFallbackError = () => {
		console.log(`Failed to load fallback avatar: ${fallbackUrl}`);
		setFallbackError(true);
	};

	const getInitials = (name: string) => {
		if (!name) return "U";

		// Handle Chinese names (usually 2-3 characters)
		if (/[\u4e00-\u9fff]/.test(name)) {
			return name.slice(-2); // Take last 2 characters for Chinese names
		}

		// Handle English names
		return name
			.split(" ")
			.map((part) => part.charAt(0))
			.join("")
			.toUpperCase()
			.slice(0, 2);
	};

	// Generate consistent background color based on employee ID
	const getBackgroundColor = (id: string) => {
		if (!id) return "#6b7280";

		const colors = [
			"#ef4444",
			"#f97316",
			"#f59e0b",
			"#eab308",
			"#84cc16",
			"#22c55e",
			"#10b981",
			"#06b6d4",
			"#0ea5e9",
			"#3b82f6",
			"#6366f1",
			"#8b5cf6",
			"#a855f7",
			"#d946ef",
			"#ec4899",
			"#f43f5e",
		];

		let hash = 0;
		for (let i = 0; i < id.length; i++) {
			hash = id.charCodeAt(i) + ((hash << 5) - hash);
		}

		return colors[Math.abs(hash) % colors.length];
	};

	// Get size dimensions for Next.js Image component
	const getSizeDimensions = (size: string) => {
		switch (size) {
			case "small":
				return { width: 32, height: 32 };
			case "large":
				return { width: 80, height: 80 };
			case "medium":
			default:
				return { width: 48, height: 48 };
		}
	};

	const { width, height } = getSizeDimensions(size);

	// Debug logging
	console.log(`Avatar for ${employeeId}:`, {
		employeeId,
		fullName,
		avatarUrl,
		imageError,
		fallbackError,
	});

	// If no employee ID, show initials immediately
	if (!employeeId) {
		const backgroundColor = getBackgroundColor("");
		return (
			<div
				className={`${styles.avatar} ${styles[size]} ${styles.letterAvatar} ${className}`}
				style={{
					background: `linear-gradient(135deg, ${backgroundColor}, ${backgroundColor}dd)`,
				}}
			>
				{getInitials(fullName)}
			</div>
		);
	}

	// If we've had an error loading both the custom avatar and fallback, show initials
	if ((imageError && fallbackError) || !avatarUrl) {
		const backgroundColor = getBackgroundColor(employeeId);

		return (
			<div
				className={`${styles.avatar} ${styles[size]} ${styles.letterAvatar} ${className}`}
				style={{
					background: `linear-gradient(135deg, ${backgroundColor}, ${backgroundColor}dd)`,
				}}
			>
				{getInitials(fullName)}
			</div>
		);
	}

	return (
		<div className={`${styles.avatar} ${styles[size]} ${className}`}>
			{!imageError ? (
				<Image
					src={avatarUrl}
					alt={`${fullName}的頭像`}
					className={styles.avatarImage}
					width={width}
					height={height}
					onError={handleImageError}
					onLoad={() =>
						console.log(
							`Successfully loaded avatar for ${employeeId}`
						)
					}
					priority={false}
					unoptimized={true}
				/>
			) : (
				<Image
					src={fallbackUrl}
					alt={`${fullName}的預設頭像`}
					className={styles.avatarImage}
					width={width}
					height={height}
					onError={handleFallbackError}
					onLoad={() =>
						console.log(`Successfully loaded fallback avatar`)
					}
					priority={false}
					unoptimized={true}
				/>
			)}
		</div>
	);
};

export default Avatar;