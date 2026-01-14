// src/components/ads/AdS.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import styles from "./AdS.module.css";

export default function AdS() {
	const [selectedSounds, setSelectedSounds] = useState<string[]>([]);
	const [frequency, setFrequency] = useState(5);
	const [volume, setVolume] = useState(20);
	const [isRunning, setIsRunning] = useState(false);
	const [playLogs, setPlayLogs] = useState<
		{ timestamp: string; sound: string }[]
	>([]);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);

	// Sound files from public folder
	const sounds = [
		{ id: "A", name: "客艙服務鈴", url: "/sounds/sound-a.mp3" },
		{ id: "B", name: "安全帶", url: "/sounds/sound-b.mp3" },
		{ id: "C", name: "簡訊聲", url: "/sounds/sound-c.mp3" },
		{ id: "D", name: "LINE聲響 1", url: "/sounds/sound-d.mp3" },
		{ id: "E", name: "LINE聲響 2", url: "/sounds/sound-e.mp3" },
		{ id: "F", name: "LINE聲響 3", url: "/sounds/sound-f.mp3" },
		{ id: "G", name: "LINE聲響 4", url: "/sounds/sound-g.mp3" },
	];

	const handleSoundToggle = (soundId: string) => {
		setSelectedSounds((prev) =>
			prev.includes(soundId)
				? prev.filter((id) => id !== soundId)
				: [...prev, soundId]
		);
	};

	const resetSounds = () => {
		setSelectedSounds([]);
	};

	const resetSettings = () => {
		setFrequency(5);
		setVolume(20);
	};

	const playTestSound = (soundUrl: string) => {
		const audio = new Audio(soundUrl);
		audio.volume = volume / 100;
		audio.play();
	};

	const playRandomSound = () => {
		if (selectedSounds.length === 0) return;

		const randomIndex = Math.floor(Math.random() * selectedSounds.length);
		const selectedSoundId = selectedSounds[randomIndex];
		const sound = sounds.find((s) => s.id === selectedSoundId);

		if (sound) {
			const audio = new Audio(sound.url);
			audio.volume = volume / 100;
			audio.play();

			// Log the play event with UTC+8 timestamp
			const now = new Date();
			const utc8Time = new Date(now.getTime() + 8 * 60 * 60 * 1000);
			const timestamp = utc8Time
				.toISOString()
				.replace("T", " ")
				.substring(0, 19);

			setPlayLogs((prev) =>
				[
					{
						timestamp: timestamp,
						sound: sound.name,
					},
					...prev,
				].slice(0, 50)
			); // Keep last 50 logs
		}
	};

	const handleStartStop = () => {
		if (isRunning) {
			// Stop
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
			setIsRunning(false);
			setPlayLogs([]); // Clear play logs when stopping
		} else {
			// Start
			if (selectedSounds.length === 0) {
				alert("請至少選擇一個聲音！");
				return;
			}
			setIsRunning(true);
		}
	};

	useEffect(() => {
		if (isRunning && selectedSounds.length > 0) {
			// Clear any existing timeout
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}

			// Schedule the next sound
			const randomDelay = Math.random() * frequency * 60 * 1000;

			timeoutRef.current = setTimeout(() => {
				playRandomSound();
			}, randomDelay);
		}

		return () => {
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
			}
		};
	}, [isRunning, frequency, selectedSounds, volume, playLogs]);

	return (
		<div className={styles.adsContainer}>
			<div className={styles.adsTitle}>
				<h1>AdS</h1>
				<h2>Aufmerksamkeit der Schüler</h2>
			</div>

			<fieldset className={styles.fieldset}>
				<legend className={styles.fieldsetTitle}>Sounds</legend>
				<div className={styles.fieldsetHeader}>
					<div></div>
					<button
						className={styles.resetButton}
						onClick={resetSounds}
					>
						Reset
					</button>
				</div>
				<div className={styles.soundsGrid}>
					{sounds.map((sound) => (
						<div key={sound.id} className={styles.soundItem}>
							<div className={styles.checkboxWrapper}>
								<input
									type="checkbox"
									className={styles.soundCheckbox}
									checked={selectedSounds.includes(sound.id)}
									onChange={() => handleSoundToggle(sound.id)}
									id={`sound-${sound.id}`}
								/>
							</div>
							<div className={styles.soundName}>{sound.name}</div>
							<button
								className={styles.testButton}
								onClick={() => playTestSound(sound.url)}
							>
								TEST
							</button>
						</div>
					))}
				</div>
			</fieldset>

			<fieldset className={styles.fieldset}>
				<legend className={styles.fieldsetTitle}>Settings</legend>
				<div className={styles.fieldsetHeader}>
					<div></div>
					<button
						className={styles.resetButton}
						onClick={resetSettings}
					>
						Reset
					</button>
				</div>
				<div className={styles.settingsGrid}>
					<div className={styles.settingItem}>
						<div className={styles.settingLabel}>Frequency</div>
						<div className={styles.sliderContainer}>
							<input
								type="range"
								min="0"
								max="60"
								value={frequency}
								onChange={(e) =>
									setFrequency(parseInt(e.target.value))
								}
								className={styles.slider}
							/>
							<div className={styles.valueDisplay}>
								{frequency} min
							</div>
						</div>
					</div>

					<div className={styles.settingItem}>
						<div className={styles.settingLabel}>Volume</div>
						<div className={styles.sliderContainer}>
							<input
								type="range"
								min="0"
								max="100"
								value={volume}
								onChange={(e) =>
									setVolume(parseInt(e.target.value))
								}
								className={styles.slider}
							/>
							<div className={styles.valueDisplay}>
								{volume} %
							</div>
						</div>
					</div>
				</div>
			</fieldset>

			<div className={styles.startButtonContainer}>
				<button
					className={`${styles.startButton} ${
						isRunning ? styles.running : ""
					}`}
					onClick={handleStartStop}
				>
					{isRunning ? "STOP" : "START"}
				</button>
			</div>

			<div className={styles.playLogContainer}>
				<div className={styles.playLogTitle}>Play Log (UTC+8)</div>
				<div className={styles.playLogList}>
					{playLogs.length === 0 ? (
						<div className={styles.playLogEmpty}>
							No sounds played yet...
						</div>
					) : (
						playLogs.map((log, index) => (
							<div key={index} className={styles.playLogItem}>
								<span className={styles.playLogTimestamp}>
									{log.timestamp}
								</span>
								<span className={styles.playLogSound}>
									{log.sound}
								</span>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}
