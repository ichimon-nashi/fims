// src/components/test/ExamineeInfo/ExamineeInfo.tsx
"use client";

import React from "react";
import { User } from "@/lib/types";
import Avatar from "@/components/ui/Avatar/Avatar";
import styles from "./ExamineeInfo.module.css";

interface ExamineeInfoProps {
	examinee: User;
	hidePrivateInfo?: boolean;
}

const ExamineeInfo: React.FC<ExamineeInfoProps> = ({
	examinee,
	hidePrivateInfo = false,
}) => {
	// Use the correct property name from User type
	const employeeId = examinee.employee_id;
	
	// Format rank to show only first two characters unless it's "admin"
	const formatRank = (rank: string | undefined | null): string => {
		if (!rank) return "N/A";
		
		// Keep "admin" as is, otherwise show only first 2 characters
		if (rank.toLowerCase() === "admin") {
			return rank;
		}
		
		return rank.substring(0, 2).toUpperCase();
	};
	
	return (
		<div className={styles.examineeInfo}>
			<Avatar
				employeeId={employeeId}
				fullName={examinee.full_name}
				size="large"
				className={styles.avatar}
			/>

			<div className={styles.details}>
				<h3 className={styles.name}>{examinee.full_name}</h3>

				<div className={styles.infoGrid}>
					<div className={styles.infoItem}>
						<span className={styles.label}>Employee ID:</span>
						<span className={styles.value}>
							{employeeId || "N/A"}
						</span>
					</div>

					<div className={styles.infoItem}>
						<span className={styles.label}>Rank:</span>
						<span className={styles.value}>{formatRank(examinee.rank)}</span>
					</div>

					<div className={styles.infoItem}>
						<span className={styles.label}>Base:</span>
						<span className={styles.value}>{examinee.base || "N/A"}</span>
					</div>

					{!hidePrivateInfo && (
						<>
							<div className={styles.infoItem}>
								<span className={styles.label}>Email:</span>
								<span className={styles.value}>
									{examinee.email || "N/A"}
								</span>
							</div>

							{examinee.handicap_level && (
								<div className={styles.infoItem}>
									<span className={styles.label}>
										Handicap Level:
									</span>
									<span className={styles.value}>
										{examinee.handicap_level}
									</span>
								</div>
							)}

							{examinee.authentication_level && (
								<div className={styles.infoItem}>
									<span className={styles.label}>
										Auth Level:
									</span>
									<span className={styles.value}>
										{examinee.authentication_level}
									</span>
								</div>
							)}
						</>
					)}

					{examinee.filter && Array.isArray(examinee.filter) && examinee.filter.length > 0 && (
						<div className={styles.infoItem}>
							<span className={styles.label}>Excluded Categories:</span>
							<div className={styles.filterTags}>
								{examinee.filter.map((filter: string, index: number) => (
									<span
										key={index}
										className={styles.filterTag}
									>
										{filter}
									</span>
								))}
							</div>
						</div>
					)}
				</div>
			</div>
		</div>
	);
};

export default ExamineeInfo;