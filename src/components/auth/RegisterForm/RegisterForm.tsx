// src/components/auth/RegisterForm/RegisterForm.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import styles from "./RegisterForm.module.css";

const RegisterForm = () => {
	const [formData, setFormData] = useState({
		employee_id: "",
		full_name: "",
		rank: "",
		base: "",
		email: "",
		password: "",
		confirmPassword: "",
	});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [showRankDropdown, setShowRankDropdown] = useState(false);
	const vantaRef = useRef<HTMLDivElement>(null);
	const vantaEffect = useRef<any>(null);
	const rankDropdownRef = useRef<HTMLDivElement>(null);

	const { login } = useAuth();
	const router = useRouter();

	// Rank options - same as User Management
	const commonRanks = [
		"FA - Flight Attendant", 
		"FS - Flight Stewardess", 
		"LF - Leading Flight Attendant", 
		"PR - Purser", 
		"FI - Flight Attendant Instructor", 
		"SC - Section Chief", 
		"MG - Manager"
	];

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			if (rankDropdownRef.current && !rankDropdownRef.current.contains(event.target as Node)) {
				setShowRankDropdown(false);
			}
		};

		document.addEventListener('mousedown', handleClickOutside);
		return () => document.removeEventListener('mousedown', handleClickOutside);
	}, []);

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
	};

	const handleRankSelect = (rank: string) => {
		setFormData((prev) => ({ ...prev, rank }));
		setShowRankDropdown(false);
		setError("");
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");

		// Validate password confirmation
		if (formData.password !== formData.confirmPassword) {
			setError("Passwords do not match");
			setIsLoading(false);
			return;
		}

		try {
			const response = await fetch("/api/auth/register", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({
					employee_id: formData.employee_id,
					full_name: formData.full_name,
					rank: formData.rank,
					base: formData.base,
					email: formData.email,
					password: formData.password,
				}),
			});

			if (response.ok) {
				// Auto-login after successful registration
				const success = await login(formData.email, formData.password);
				if (success) {
					router.push("/dashboard");
				} else {
					setError(
						"Registration successful, but login failed. Please try logging in manually."
					);
				}
			} else {
				const errorData = await response.json();
				setError(errorData.message || "Registration failed");
			}
		} catch (err) {
			setError("Registration failed. Please try again.");
		} finally {
			setIsLoading(false);
		}
	};

	// Get display text for selected rank
	const getSelectedRankDisplay = () => {
		if (!formData.rank) return "Select your rank";
		return formData.rank;
	};

	return (
		<div className={styles.registerContainer} ref={vantaRef}>
			<div className={styles.registerCard}>
				<div className={styles.registerHeader}>
					<h1>Create Account</h1>
					<p>Join the Oral Test Application</p>
				</div>

				<form onSubmit={handleSubmit} className={styles.registerForm}>
					{error && (
						<div className={styles.errorMessage}>{error}</div>
					)}

					<div className={styles.formGrid}>
						<div className={styles.inputGroup}>
							<label htmlFor="employee_id">Employee ID</label>
							<input
								type="text"
								id="employee_id"
								name="employee_id"
								value={formData.employee_id}
								onChange={handleInputChange}
								required
								autoComplete="off"
								disabled={isLoading}
								className={styles.input}
								placeholder="Enter your employee ID"
							/>
						</div>

						<div className={styles.inputGroup}>
							<label htmlFor="full_name">Full Name</label>
							<input
								type="text"
								id="full_name"
								name="full_name"
								value={formData.full_name}
								onChange={handleInputChange}
								required
								autoComplete="off"
								disabled={isLoading}
								className={styles.input}
								placeholder="Enter your full name"
							/>
						</div>

						<div className={styles.inputGroup} ref={rankDropdownRef}>
							<label htmlFor="rank">Rank</label>
							<div className={styles.customSelect}>
								<button
									type="button"
									className={`${styles.selectButton} ${formData.rank ? styles.selected : ''}`}
									onClick={() => setShowRankDropdown(!showRankDropdown)}
									disabled={isLoading}
								>
									<span className={styles.selectValue}>
										{getSelectedRankDisplay()}
									</span>
									<span className={`${styles.selectArrow} ${showRankDropdown ? styles.open : ''}`}>
										▼
									</span>
								</button>
								{showRankDropdown && (
									<div className={styles.selectDropdown}>
										{commonRanks.map((rank) => (
											<button
												key={rank}
												type="button"
												className={`${styles.selectOption} ${formData.rank === rank ? styles.selectedOption : ''}`}
												onClick={() => handleRankSelect(rank)}
											>
												{rank}
											</button>
										))}
									</div>
								)}
							</div>
						</div>

						<div className={styles.inputGroup}>
							<label htmlFor="base">Base</label>
							<input
								type="text"
								id="base"
								name="base"
								value={formData.base}
								onChange={handleInputChange}
								required
								autoComplete="off"
								disabled={isLoading}
								className={styles.input}
								placeholder="Enter your base"
							/>
						</div>
					</div>

					<div className={styles.inputGroup}>
						<label htmlFor="email">Email Address</label>
						<input
							type="email"
							id="email"
							name="email"
							value={formData.email}
							onChange={handleInputChange}
							required
							autoComplete="off"
							disabled={isLoading}
							className={styles.input}
							placeholder="Enter your email"
						/>
					</div>

					<div className={styles.formGrid}>
						<div className={styles.inputGroup}>
							<label htmlFor="password">Password</label>
							<input
								type="password"
								id="password"
								name="password"
								value={formData.password}
								onChange={handleInputChange}
								required
								autoComplete="off"
								disabled={isLoading}
								className={styles.input}
								placeholder="Create a password"
								minLength={4}
							/>
						</div>

						<div className={styles.inputGroup}>
							<label htmlFor="confirmPassword">
								Confirm Password
							</label>
							<input
								type="password"
								id="confirmPassword"
								name="confirmPassword"
								value={formData.confirmPassword}
								onChange={handleInputChange}
								required
								autoComplete="off"
								disabled={isLoading}
								className={styles.input}
								placeholder="Confirm your password"
								minLength={4}
							/>
						</div>
					</div>

					<button
						type="submit"
						disabled={isLoading}
						className={styles.submitButton}
					>
						{isLoading ? "Creating Account..." : "Create Account"}
					</button>

					<div className={styles.registerFooter}>
						<p>Already have an account?</p>
						<button
							type="button"
							onClick={() => router.push("/login")}
							className={styles.loginButton}
						>
							Sign In
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

export default RegisterForm;