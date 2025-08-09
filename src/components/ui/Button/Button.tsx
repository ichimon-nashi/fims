// src/components/ui/Button/Button.tsx
"use client";

import { ReactNode } from "react";
import styles from "./Button.module.css";

interface ButtonProps {
	children: ReactNode;
	onClick?: () => void;
	type?: "button" | "submit" | "reset";
	variant?: "primary" | "secondary" | "success" | "danger" | "warning";
	size?: "small" | "medium" | "large";
	disabled?: boolean;
	loading?: boolean;
	className?: string;
}

const Button = ({
	children,
	onClick,
	type = "button",
	variant = "primary",
	size = "medium",
	disabled = false,
	loading = false,
	className = "",
}: ButtonProps) => {
	const buttonClasses = [
		styles.button,
		styles[variant],
		styles[size],
		className,
	]
		.filter(Boolean)
		.join(" ");

	return (
		<button
			type={type}
			onClick={onClick}
			disabled={disabled || loading}
			className={buttonClasses}
		>
			{loading ? (
				<span className={styles.loadingContent}>
					<span className={styles.spinner}></span>
					Loading...
				</span>
			) : (
				children
			)}
		</button>
	);
};

export default Button;
