// src/components/ui/Timer/Timer.tsx
"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import styles from "./Timer.module.css";

interface TimerProps {
	initialTime?: number; // in seconds
	onTimeUp?: () => void; // Made optional since we're not using it for auto-submit anymore
	onTimeWarning?: (timeLeft: number) => void;
	autoStart?: boolean;
	className?: string;
}

const Timer = ({
	initialTime = 30,
	onTimeUp,
	onTimeWarning,
	autoStart = false,
	className = "",
}: TimerProps) => {
	const [timeLeft, setTimeLeft] = useState(initialTime);
	const [isRunning, setIsRunning] = useState(autoStart);
	const [hasStarted, setHasStarted] = useState(autoStart);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	const audioRef = useRef<{ [key: number]: HTMLAudioElement }>({});

	// Initialize audio files
	useEffect(() => {
		audioRef.current[20] = new Audio("/audio/beep-20s.mp3");
		audioRef.current[10] = new Audio("/audio/beep-10s.mp3");
		audioRef.current[0] = new Audio("/audio/beep-0s.mp3");

		// Preload audio files
		Object.values(audioRef.current).forEach((audio) => {
			audio.preload = "auto";
		});
	}, []);

	const playAudioAlert = useCallback((timeRemaining: number) => {
		const audio = audioRef.current[timeRemaining];
		if (audio) {
			audio.currentTime = 0;
			audio.play().catch((err) => console.log("Audio play failed:", err));
		}
	}, []);

	const resetTimer = useCallback(() => {
		setTimeLeft(initialTime);
		setIsRunning(false);
		setHasStarted(false);
		if (intervalRef.current) {
			clearInterval(intervalRef.current);
			intervalRef.current = null;
		}
	}, [initialTime]);

	// Auto-reset when component mounts (new question loaded)
	useEffect(() => {
		resetTimer();
	}, [resetTimer]);

	const startPauseTimer = useCallback(() => {
		if (!hasStarted) {
			setHasStarted(true);
		}
		setIsRunning((prev) => !prev);
	}, [hasStarted]);

	// Handle double click for reset
	const handleDoubleClick = useCallback(() => {
		resetTimer();
	}, [resetTimer]);

	// Timer logic
	useEffect(() => {
		if (isRunning && timeLeft > 0) {
			intervalRef.current = setInterval(() => {
				setTimeLeft((prevTime) => {
					const newTime = prevTime - 1;

					// Trigger audio alerts at specific intervals
					if (newTime === 20 || newTime === 10) {
						playAudioAlert(newTime);
						onTimeWarning?.(newTime);
					} else if (newTime === 0) {
						playAudioAlert(0);
						// Call onTimeUp if provided, but don't auto-submit
						// This allows for visual/audio notification only
						onTimeUp?.();
					}

					return newTime;
				});
			}, 1000);
		} else {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
		}

		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
			}
		};
	}, [isRunning, timeLeft, onTimeUp, onTimeWarning, playAudioAlert]);

	// Stop timer when time reaches 0
	useEffect(() => {
		if (timeLeft === 0) {
			setIsRunning(false);
		}
	}, [timeLeft]);

	// Format time display
	const formatTime = (seconds: number) => {
		const mins = Math.floor(seconds / 60);
		const secs = seconds % 60;
		return `${mins.toString().padStart(2, "0")}:${secs
			.toString()
			.padStart(2, "0")}`;
	};

	// Determine timer color based on time left
	const getTimerColorClass = () => {
		if (timeLeft <= 10) return styles.critical;
		if (timeLeft <= 20) return styles.warning;
		return styles.normal;
	};

	// Determine status text
	const getStatusText = () => {
		if (!hasStarted) return "Click to Start";
		if (isRunning) return "Running - Click to Pause";
		if (timeLeft === 0) return "Time Up!";
		return "Paused - Click to Resume";
	};

	return (
		<div className={`${styles.timerContainer} ${className}`}>
			<div
				className={`${styles.timerDisplay} ${getTimerColorClass()}`}
				onClick={startPauseTimer}
				onDoubleClick={handleDoubleClick}
			>
				<div className={styles.timeText}>{formatTime(timeLeft)}</div>
				<div className={styles.statusText}>{getStatusText()}</div>
			</div>

			{/* <div className={styles.timerControls}>
				<button
					className={styles.controlButton}
					onClick={startPauseTimer}
					disabled={timeLeft === 0}
				>
					{isRunning ? "⏸️ Pause" : "▶️ Start"}
				</button>

				<button className={styles.controlButton} onClick={resetTimer}>
					🔄 Reset
				</button>
			</div> */}

			{/* <div className={styles.instructions}>
				<p>Single click: Start/Pause | Double click: Reset</p>
			</div> */}
		</div>
	);
};

export default Timer;