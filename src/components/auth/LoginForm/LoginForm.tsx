// src/components/auth/LoginForm/LoginForm.tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import styles from "./LoginForm.module.css";

// Type declarations for external libraries
declare global {
	interface Window {
		VANTA?: {
			CLOUDS: (config: any) => {
				destroy: () => void;
			};
		};
		THREE?: any;
	}
}

const LoginForm = () => {
	const [formData, setFormData] = useState({
		identifier: "", // Can be employee ID or email
		password: "",
		email: "", // Only for password reset
	});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
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

	const showAlert = (message: string, type: 'error' | 'success' | 'warning' = 'error') => {
		const alertType = type === 'error' ? 'error' : 
						 type === 'success' ? 'info' : 'warning';
		
		const alertMessage = type === 'error' && message.includes('Access denied') 
			? 'Access Denied\n\nYou do not have permission to access this system. Please contact your administrator if you believe this is an error.\n\nAccess is limited to:\n• Flight Instructors (FI)\n• Section Chiefs (SC)\n• Managers (MG)\n• Specific authorized personnel'
			: message;

		alert(alertMessage);
	};

	const handleSubmit = async (e: React.FormEvent) => {
		e.preventDefault();
		setIsLoading(true);
		setError("");
		setSuccess("");

		try {
			const success = await login(formData.identifier, formData.password);
			if (success) {
				// showAlert("Login successful! Redirecting to dashboard...", 'success');
				router.push("/roster");
			} else {
				const errorMessage = "Invalid credentials. Please check your email and password.";
				setError(errorMessage);
				showAlert(errorMessage, 'error');
			}
		} catch (err: any) {
			let errorMessage = "Login failed. Please try again.";
			
			// Check if it's an access denied error
			if (err.message && err.message.includes('Access denied')) {
				errorMessage = err.message;
				setError("Access denied. You do not have permission to access this APP.");
			} else if (err.message && err.message.includes('Invalid credentials')) {
				errorMessage = "Invalid credentials. Please check your email and password.";
				setError(errorMessage);
			} else {
				setError(errorMessage);
			}
			
			showAlert(errorMessage, 'error');
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
				
			</div>
		</div>
	);
};

export default LoginForm;