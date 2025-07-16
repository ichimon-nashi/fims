// src/components/auth/LoginForm/LoginForm.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import styles from "./LoginForm.module.css";

const LoginForm = () => {
	const [formData, setFormData] = useState({
		identifier: "", // Can be employee ID or email
		password: "",
		email: "", // Only for password reset
	});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [showForgotPassword, setShowForgotPassword] = useState(false);
	const vantaRef = useRef<HTMLDivElement>(null);
	const vantaEffect = useRef<any>(null);

	const { login } = useAuth();
	const router = useRouter();

	// Initialize Vanta.js effect
	useEffect(() => {
		let vantaScript: HTMLScriptElement | null = null;
		let threeScript: HTMLScriptElement | null = null;

		const initVanta = () => {
			if (window.VANTA && window.THREE && vantaRef.current && !vantaEffect.current) {
				vantaEffect.current = window.VANTA.CLOUDS({
					el: vantaRef.current,
					THREE: window.THREE,
					backgroundAlpha: 1,
					backgroundColor: 0xffffff,
					cloudColor: 0xadc1de,
					cloudShadowColor: 0x183550,
					gyroControls: true,
					minHeight: 200,
					minWidth: 200,
					mouseControls: true,
					mouseEase: true,
					scale: 3,
					scaleMobile: 12,
					skyColor: 0x68b8d7,
					speed: 0.75,
					sunColor: 0xff9919,
					sunGlareColor: 0xff6633,
					sunlightColor: 0xff9933,
					touchControls: true
				});
			}
		};

		// Load Three.js first
		if (!window.THREE) {
			threeScript = document.createElement('script');
			threeScript.src = 'https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js';
			threeScript.onload = () => {
				// Then load Vanta.js
				if (!window.VANTA) {
					vantaScript = document.createElement('script');
					vantaScript.src = 'https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.clouds.min.js';
					vantaScript.onload = initVanta;
					document.head.appendChild(vantaScript);
				} else {
					initVanta();
				}
			};
			document.head.appendChild(threeScript);
		} else if (!window.VANTA) {
			vantaScript = document.createElement('script');
			vantaScript.src = 'https://cdn.jsdelivr.net/npm/vanta@latest/dist/vanta.clouds.min.js';
			vantaScript.onload = initVanta;
			document.head.appendChild(vantaScript);
		} else {
			initVanta();
		}

		// Cleanup function
		return () => {
			if (vantaEffect.current) {
				vantaEffect.current.destroy();
				vantaEffect.current = null;
			}
			if (vantaScript && vantaScript.parentNode) {
				vantaScript.parentNode.removeChild(vantaScript);
			}
			if (threeScript && threeScript.parentNode) {
				threeScript.parentNode.removeChild(threeScript);
			}
		};
	}, []);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
		setError(""); // Clear error when user types
		setSuccess(""); // Clear success when user types
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");
		setSuccess("");

		try {
			const success = await login(formData.identifier, formData.password);
			if (success) {
				router.push("/roster");
			} else {
				setError("Invalid credentials");
			}
		} catch (err) {
			setError("Login failed. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	const handleForgotPassword = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!formData.email) {
			setError("Please enter your email address");
			return;
		}

		setIsLoading(true);
		setError("");
		setSuccess("");

		try {
			const response = await fetch("/api/auth/forgot-password", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ email: formData.email }),
			});

			const data = await response.json();

			if (response.ok) {
				setSuccess("Password reset instructions have been sent to your email if an account exists.");
				setShowForgotPassword(false);
			} else {
				setError(data.message || "Failed to send recovery email");
			}
		} catch (err) {
			setError("Failed to send recovery email. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	return (
		<div className={styles.loginContainer} ref={vantaRef}>
			<div className={styles.loginCard}>
				<div className={styles.loginHeader}>
					<h1>豪神教師排班系統</h1>
					<p>Sign in to continue</p>
				</div>

				{!showForgotPassword ? (
					<form onSubmit={handleSubmit} className={styles.loginForm}>
						{error && (
							<div className={styles.errorMessage}>{error}</div>
						)}

						{success && (
							<div className={styles.successMessage}>{success}</div>
						)}

						<div className={styles.inputGroup}>
							<label htmlFor="identifier">Email</label>
							<input
								type="text"
								id="identifier"
								name="identifier"
								value={formData.identifier}
								onChange={handleInputChange}
								required
								autoComplete="username"
								disabled={isLoading}
								className={styles.input}
								placeholder="Enter your email"
							/>
						</div>

						<div className={styles.inputGroup}>
							<label htmlFor="password">Password</label>
							<input
								type="password"
								id="password"
								name="password"
								value={formData.password}
								onChange={handleInputChange}
								required
								autoComplete="current-password"
								disabled={isLoading}
								className={styles.input}
								placeholder="Enter your password"
							/>
						</div>

						<button
							type="submit"
							disabled={isLoading}
							className={styles.submitButton}
						>
							{isLoading ? "Signing in..." : "Sign In"}
						</button>

					</form>
				) : (
					<form
						onSubmit={handleForgotPassword}
						className={styles.loginForm}
					>
						<div className={styles.forgotPasswordHeader}>
							<h2>Reset Password</h2>
							<p>
								Enter your email address to receive password reset instructions
							</p>
						</div>

						{error && (
							<div className={styles.errorMessage}>{error}</div>
						)}

						{success && (
							<div className={styles.successMessage}>{success}</div>
						)}

						<div className={styles.inputGroup}>
							<label htmlFor="email">Email Address</label>
							<input
								type="email"
								id="email"
								name="email"
								value={formData.email}
								onChange={handleInputChange}
								required
								autoComplete="email"
								disabled={isLoading}
								className={styles.input}
								placeholder="Enter your email address"
							/>
						</div>

						<button
							type="submit"
							disabled={isLoading}
							className={styles.submitButton}
						>
							{isLoading ? "Sending..." : "Send Reset Instructions"}
						</button>

						<button
							type="button"
							onClick={() => setShowForgotPassword(false)}
							className={styles.backButton}
						>
							Back to Login
						</button>
					</form>
				)}
			</div>
		</div>
	);
};

export default LoginForm;