// src/components/auth/LoginForm/LoginForm.tsx - Flight Radar redesign
"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import styles from "./LoginForm.module.css";

const STARS = [
	{ top: "10%", left: "14%", delay: "0s", size: 2 },
	{ top: "18%", left: "78%", delay: "0.4s", size: 2 },
	{ top: "8%", left: "50%", delay: "0.8s", size: 3 },
	{ top: "30%", left: "8%", delay: "1.2s", size: 2 },
	{ top: "75%", left: "88%", delay: "0.2s", size: 2 },
	{ top: "82%", left: "10%", delay: "1.6s", size: 3 },
	{ top: "14%", left: "35%", delay: "0.6s", size: 2 },
	{ top: "65%", left: "22%", delay: "1s", size: 2 },
];

const RADAR_BASE = 900; // px, authored size of the radar diagram
const RADAR_MIN_RATIO = 1.0;
const RADAR_MAX_SCALE = 1.15;

const LoginForm = () => {
	const [formData, setFormData] = useState({
		identifier: "", // Can be employee ID or email
		password: "",
		email: "", // Only for password reset
	});
	const [isLoading, setIsLoading] = useState(false);
	const [error, setError] = useState("");
	const [success, setSuccess] = useState("");
	const [radarScale, setRadarScale] = useState(1);
	const [pathScale, setPathScale] = useState({ x: 1, y: 1 });

	const { login } = useAuth();
	const router = useRouter();

	// Scale the radar diagram to the viewport; smaller footprint than a full-bleed background
	useEffect(() => {
		const updateScale = () => {
			const vmin = Math.min(window.innerWidth, window.innerHeight);
			const s = Math.min((vmin * RADAR_MIN_RATIO) / RADAR_BASE, RADAR_MAX_SCALE);
			setRadarScale(s);
			// Paths layer scales x/y independently (uncapped) so flight paths reach every edge
			// regardless of aspect ratio, instead of being boxed inside the circular sonar's vmin scale.
			setPathScale({
				x: window.innerWidth / RADAR_BASE,
				y: window.innerHeight / RADAR_BASE,
			});
		};
		updateScale();
		window.addEventListener("resize", updateScale);
		return () => window.removeEventListener("resize", updateScale);
	}, []);

	const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		const { name, value } = e.target;
		setFormData((prev) => ({
			...prev,
			[name]: value,
		}));
		setError("");
		setSuccess("");
	};

	const showAlert = (message: string, type: 'error' | 'success' | 'warning' = 'error') => {
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
				setSuccess("Login successful! Redirecting to dashboard...");
				setTimeout(() => {
					router.replace("/dashboard");
				}, 500);
			} else {
				const errorMessage = "Invalid credentials. Please check your email and password.";
				setError(errorMessage);
				showAlert(errorMessage, 'error');
			}
		} catch (err: any) {
			let errorMessage = "Login failed. Please try again.";

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
		<div className={styles.loginContainer}>
			{STARS.map((s, i) => (
				<div
					key={i}
					className={styles.star}
					style={{
						top: s.top,
						left: s.left,
						width: s.size,
						height: s.size,
						animationDelay: s.delay,
					}}
				/>
			))}

			<div className={styles.radarViewport}>
				<div className={styles.radar} style={{ transform: `scale(${radarScale})` }}>
					<div className={`${styles.ring} ${styles.ringOuter}`} />
					<div className={`${styles.ring} ${styles.ringPulse}`} />
					<div className={`${styles.ring} ${styles.ringPulse}`} />
					<div className={`${styles.ring} ${styles.ringPulse}`} />
					<div className={`${styles.ring} ${styles.ringInner}`} />
					<div className={styles.sweep} />
				</div>

				<div className={styles.pathsLayer} style={{ transform: `scale(${pathScale.x}, ${pathScale.y})` }}>
					<svg width={RADAR_BASE} height={RADAR_BASE} className={styles.tracks}>
						<path d="M 0 480 Q 300 250 560 180 T 900 60" fill="none" stroke="rgba(217,164,92,0.4)" strokeWidth="1.5" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
						<path d="M 900 520 Q 620 420 430 300 T 0 140" fill="none" stroke="rgba(79,143,176,0.4)" strokeWidth="1.5" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
						<path d="M 0 220 Q 260 150 520 470 T 900 430" fill="none" stroke="rgba(217,164,92,0.4)" strokeWidth="1.5" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
						<path d="M 0 40 Q 400 30 780 230 T 900 700" fill="none" stroke="rgba(79,143,176,0.4)" strokeWidth="1.5" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
						<path d="M 900 850 Q 560 800 260 620 T 0 380" fill="none" stroke="rgba(217,164,92,0.4)" strokeWidth="1.5" strokeDasharray="3 5" vectorEffect="non-scaling-stroke" />
					</svg>

					<div className={`${styles.plane} ${styles.plane1}`}>
						<div className={`${styles.planeIcon} ${styles.planeGold}`} style={{ transform: `scale(${1 / pathScale.x}, ${1 / pathScale.y})` }} />
					</div>
					<div className={`${styles.plane} ${styles.plane2}`}>
						<div className={`${styles.planeIcon} ${styles.planeBlue}`} style={{ transform: `scale(${1 / pathScale.x}, ${1 / pathScale.y})` }} />
					</div>
					<div className={`${styles.plane} ${styles.plane3}`}>
						<div className={`${styles.planeIcon} ${styles.planeGold}`} style={{ transform: `scale(${1 / pathScale.x}, ${1 / pathScale.y})` }} />
					</div>
					<div className={`${styles.plane} ${styles.plane1}`} style={{ animationDuration: '14s', animationDelay: '2s' }}>
						<div className={`${styles.planeIcon} ${styles.planeBlue}`} style={{ transform: `scale(${1 / pathScale.x}, ${1 / pathScale.y})` }} />
					</div>
					<div className={`${styles.plane} ${styles.plane2}`} style={{ animationDuration: '16s', animationDelay: '4s' }}>
						<div className={`${styles.planeIcon} ${styles.planeGold}`} style={{ transform: `scale(${1 / pathScale.x}, ${1 / pathScale.y})` }} />
					</div>
				</div>
			</div>

			<div className={styles.vignette} />

			<div className={styles.loginCard}>
				<h1><span className={styles['brand-name']}>豪神</span>Instructor</h1>

				<form onSubmit={handleSubmit} className={styles.loginForm}>
					{error && (
						<div className={styles.errorMessage}>{error}</div>
					)}

					{success && (
						<div className={styles.successMessage}>{success}</div>
					)}

					<div className={styles.inputGroup}>
						<label htmlFor="identifier">ID</label>
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
							placeholder="Enter your ID or email"
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