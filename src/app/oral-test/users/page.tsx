// src/app/oral-test/users/page.tsx
"use client";

import { useAuth } from "@/context/AuthContext";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import PermissionGuard from "@/components/common/PermissionGuard";
import UserManagement from "@/components/oral-test/management/UserManagement/UserManagement";
import OralTestNavigation from "@/components/oral-test/OralTestNavigation/OralTestNavigation";
import Image from 'next/image';

function UsersPageContent() {
	const { user } = useAuth();
	const router = useRouter();

	const hasUsersAccess = user?.app_permissions?.oral_test?.pages?.includes("users") ?? false;

	useEffect(() => {
		// Check if user has users page permission
		if (user && !hasUsersAccess) {
			router.push("/oral-test/dashboard");
		}
	}, [user, hasUsersAccess, router]);

	// Show loading or redirect if insufficient permissions
	if (!user || !hasUsersAccess) {
		return (
			<div style={{ 
				height: '100vh', 
				display: 'flex',
				flexDirection: 'column',
				alignItems: 'center', 
				justifyContent: 'center',
				background: 'linear-gradient(135deg, #1a1f35 0%, #2d3651 100%)'
			}}>
				<div style={{
					marginBottom: '2rem',
					position: 'relative',
					width: '350px',
					height: '350px'
				}}>
					<Image
						src="/K-dogmatic.png"
						alt="Loading"
						fill
						style={{ objectFit: 'contain' }}
						priority
						unoptimized
					/>
				</div>
				<div style={{ 
					color: '#e8e9ed', 
					textAlign: 'center',
					fontSize: '1.5rem',
					fontWeight: 'bold'
				}}>
					豪神FIMS載入中...
				</div>
			</div>
		);
	}

	return (
		<>
			<style jsx>{`
				.test-page-container {
					padding: 0;
					width: 100%;
					display: flex;
					flex-direction: column;
				}

				.test-page-content {
					display: flex;
					flex-direction: column;
				}

				.test-page-header {
					padding: 1rem 1.5rem 0.75rem 1.5rem;
					background: rgba(255, 255, 255, 0.03);
					border-bottom: 1px solid rgba(255, 255, 255, 0.1);
					flex-shrink: 0;
				}

				.test-page-title {
					font-size: 3rem;
					font-weight: bold;
					color: #4a9eff;
					text-align: center;
					margin-bottom: 0.35rem;
					text-shadow: 0 2px 4px rgba(74, 158, 255, 0.3);
				}

				.test-page-subtitle {
					text-align: center;
					color: #a0aec0;
					font-size: 1.2rem;
				}

				.test-page-nav {
					padding: 0.5rem 1rem;
					flex-shrink: 0;
				}

				.test-interface-wrapper {
					flex: 1;
				}

				/* DESKTOP ONLY - Overflow Hidden & Fixed Height */
				@media (min-width: 1025px) {
					.test-page-content {
						height: 100%;
					}

					.test-interface-wrapper {
						min-height: 0;
					}
				}

				/* MOBILE & TABLET - Natural Scroll */
				@media (max-width: 1024px) {
					.test-page-container {
						min-height: auto;
						overflow: visible;
					}

					.test-page-content {
						min-height: auto;
						overflow: visible;
					}

					.test-interface-wrapper {
						min-height: auto;
						overflow: visible;
					}

					.test-page-header {
						padding: 1.5rem 1.5rem 1rem 1.5rem;
					}

					.test-page-title {
						font-size: 2.25rem;
						margin-bottom: 0.5rem;
					}

					.test-page-subtitle {
						font-size: 1rem;
					}

					.test-page-nav {
						padding: 0.75rem 1rem;
					}
				}
			`}</style>
			<div className="test-page-container">
				<div className="test-page-content fade-in">
					{/* Page Header */}
					<div className="test-page-header">
						<h1 className="test-page-title">學員管理</h1>
						<p className="test-page-subtitle">
							User Management System
						</p>
					</div>

					{/* Internal Navigation */}
					<div className="test-page-nav">
						<OralTestNavigation currentPath="/oral-test/users" />
					</div>

					{/* User Management Component */}
					<div className="test-interface-wrapper">
						<UserManagement />
					</div>
				</div>
			</div>
		</>
	);
}

export default function UsersPage() {
	return (
		<PermissionGuard app="oral_test">
			<UsersPageContent />
		</PermissionGuard>
	);
}