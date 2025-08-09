// src/components/layout/DeviceCheck/DeviceCheck.tsx
"use client";

import { useEffect, useState } from "react";
import styles from "./DeviceCheck.module.css";

const DeviceCheck = ({ children }: { children: React.ReactNode }) => {
	const [isSmallDevice, setIsSmallDevice] = useState(false);

	useEffect(() => {
		const checkDeviceSize = () => {
			// Check if device is smaller than tablet landscape (1024px)
			setIsSmallDevice(window.innerWidth < 1024);
		};

		checkDeviceSize();
		window.addEventListener("resize", checkDeviceSize);

		return () => window.removeEventListener("resize", checkDeviceSize);
	}, []);

	if (isSmallDevice) {
		return (
			<div className={styles.deviceWarning}>
				<div className={styles.warningContent}>
					<img
						src="/images/tablet-redirect.png"
						alt="Use larger device"
						className={styles.warningImage}
					/>
					<h2>Device Too Small</h2>
					<p>
						This application is designed for tablet (landscape) and
						desktop devices.
					</p>
					<p>
						Please use a device with a larger screen.
					</p>
				</div>
			</div>
		);
	}

	return <>{children}</>;
};

export default DeviceCheck;
