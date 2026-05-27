// src/app/audit/firstlevel/page.tsx
"use client";

import styles from "../iosa/iosa.module.css";

export default function FirstLevelAuditPage() {
	return (
		<div className={styles.pageShell}>
			<div className={styles.underConstruction}>
				<div className={styles.ucIcon}>🚧</div>
				<h2 className={styles.ucTitle}>一級查核</h2>
				<p className={styles.ucText}>此功能研發中，請耐心等候。</p>
			</div>
		</div>
	);
}
