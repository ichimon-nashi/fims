// src/components/oral-test/management/UserManagement/UserManagement.tsx
"use client";

import { useState, useEffect } from "react";
import { useAuth } from "@/context/AuthContext";
import { User } from "@/lib/types";
import DataTable from "../DataTable/DataTable";
import styles from "./UserManagement.module.css";
import * as XLSX from "xlsx";

// Responsive button text hook
const useResponsiveButtonText = () => {
	const [isCompactView, setIsCompactView] = useState(false);

	useEffect(() => {
		const checkViewport = () => {
			setIsCompactView(window.innerWidth >= 1024 && window.innerWidth < 1300);
		};

		checkViewport();
		window.addEventListener('resize', checkViewport);
		return () => window.removeEventListener('resize', checkViewport);
	}, []);

	return {
		addText: isCompactView ? "➕ Add" : "➕ Add User",
		exportText: isCompactView ? "📊 Export" : "📊 Export Excel",
		importText: isCompactView ? "📁 Import" : "📁 Import Excel",
		deleteText: (count: number) => isCompactView ? `🗑️ Delete (${count})` : `🗑️ Delete Selected (${count})`
	};
};

const UserManagement = () => {
	const { user: currentUser } = useAuth();
	const [users, setUsers] = useState<User[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState("");
	const [editingUser, setEditingUser] = useState<User | null>(null);
	const [showAddForm, setShowAddForm] = useState(false);
	const [selectedUsers, setSelectedUsers] = useState<string[]>([]);
	
	// Responsive button text
	const buttonText = useResponsiveButtonText();

	useEffect(() => {
		fetchUsers();
	}, []);

	const fetchUsers = async () => {
		try {
			setLoading(true);
			console.log('Fetching users...');
			
			const response = await fetch("/api/users", {
				headers: {
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
			});

			console.log('Users response status:', response.status);

			if (response.ok) {
				const data = await response.json();
				console.log('Users API response:', data);
				
				// Access data.users array instead of trying to filter data directly
				const usersArray = data.users || data; // Handle both response formats
				
				if (Array.isArray(usersArray)) {
					// Show admin user only if current user is admin
					const filteredUsers = usersArray.filter((user: User) => {
						// If current user is admin, show all users (including admin)
						if (currentUser && currentUser.employee_id === "admin") {
							return true;
						}
						// Otherwise, filter out admin users
						return user.employee_id !== "admin";
					});
					
					// Sort users to show admin at top when logged in as admin
					const sortedUsers = filteredUsers.sort((a: User, b: User) => {
						// If current user is admin, put admin user at the top
						if (currentUser?.employee_id === "admin") {
							if (a.employee_id === "admin") return -1;
							if (b.employee_id === "admin") return 1;
						}
						// Otherwise sort alphabetically by full name
						return a.full_name.localeCompare(b.full_name);
					});
					
					console.log('Filtered and sorted users:', sortedUsers);
					setUsers(sortedUsers);
				} else {
					console.error('Invalid users data format:', usersArray);
					setError("Invalid users data format received");
				}
			} else {
				const errorData = await response.json();
				console.error('Users API error:', errorData);
				setError(errorData.message || "Failed to load users");
			}
		} catch (err) {
			console.error('Users fetch error:', err);
			setError("Failed to load users");
		} finally {
			setLoading(false);
		}
	};

	const handleSaveUser = async (userData: Partial<User>) => {
		try {
			// More strict password change validation
			if (editingUser && userData.password && currentUser) {
				// If editing another user (not yourself)
				if (editingUser.id !== currentUser.id) {
					// Only level 20+ can change other users' passwords
					if (currentUser.authentication_level < 20) {
						setError("Access denied: You can only change your own password. Authentication level 20+ required to change other users' passwords.");
						return;
					}
				}
			}

			// Prevent users from setting authentication_level higher than their own
			if (userData.authentication_level && currentUser) {
				if (
					userData.authentication_level >
					currentUser.authentication_level
				) {
					setError(
						"Cannot set authentication level higher than your own"
					);
					return;
				}
			}

			const url = editingUser
				? `/api/users/${editingUser.id}`
				: "/api/users";
			const method = editingUser ? "PUT" : "POST";

			const response = await fetch(url, {
				method,
				headers: {
					"Content-Type": "application/json",
					Authorization: `Bearer ${localStorage.getItem("token")}`,
				},
				body: JSON.stringify(userData),
			});

			if (response.ok) {
				await fetchUsers();
				setEditingUser(null);
				setShowAddForm(false);
				setError("");
			} else {
				const errorData = await response.json();
				setError(errorData.message || "Failed to save user");
			}
		} catch (err) {
			setError("Failed to save user");
		}
	};

	const handleDeleteUsers = async (userIds: string[]) => {
		// Prevent deletion of admin user
		const adminUser = users.find(user => user.employee_id === "admin" && userIds.includes(user.id));
		if (adminUser) {
			setError("Cannot delete admin user");
			return;
		}

		if (
			!confirm(
				`Are you sure you want to delete ${userIds.length} user(s)?`
			)
		) {
			return;
		}

		try {
			await Promise.all(
				userIds.map((id) =>
					fetch(`/api/users/${id}`, {
						method: "DELETE",
						headers: {
							Authorization: `Bearer ${localStorage.getItem("token")}`,
						},
					})
				)
			);

			await fetchUsers();
			setSelectedUsers([]);
			setError("");
		} catch (err) {
			setError("Failed to delete users");
		}
	};

	const handleExportExcel = () => {
		try {
			// Prepare data for export (exclude sensitive fields)
			const exportData = users.map((user) => ({
				"Employee ID": user.employee_id,
				"Full Name": user.full_name,
				"Rank": getRankAbbreviation(user.rank),
				Base: user.base,
				Email: user.email,
				"Excluded Categories": Array.isArray(user.filter)
					? user.filter.join(", ")
					: "",
				"Created Date": user.created_at 
					? new Date(user.created_at).toLocaleDateString("en-US")
					: "N/A",
				"Last Modified": user.updated_at
					? new Date(user.updated_at).toLocaleDateString("en-US")
					: user.created_at
					? new Date(user.created_at).toLocaleDateString("en-US")
					: "N/A",
			}));

			// Create workbook and worksheet
			const ws = XLSX.utils.json_to_sheet(exportData);
			const wb = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(wb, ws, "Users");

			// Auto-size columns
			const maxWidth = 50;
			const colWidths = Object.keys(exportData[0] || {}).map((key) => ({
				wch: Math.min(Math.max(key.length, 10), maxWidth),
			}));
			ws["!cols"] = colWidths;

			// Generate filename with current date
			const today = new Date().toISOString().split("T")[0];
			const filename = `users_export_${today}.xlsx`;

			// Save file
			XLSX.writeFile(wb, filename);
		} catch (err) {
			console.error("Export error:", err);
			setError("Failed to export Excel file");
		}
	};

	const handleImportExcel = async (file: File) => {
		try {
			const data = await file.arrayBuffer();
			const workbook = XLSX.read(data);
			const worksheet = workbook.Sheets[workbook.SheetNames[0]];
			const jsonData = XLSX.utils.sheet_to_json(worksheet);

			// Validate and transform imported data
			const importedUsers = jsonData.map((row: any) => {
				// Map Excel columns to database fields
				return {
					employee_id: row["Employee ID"] || row["employee_id"],
					full_name: row["Full Name"] || row["full_name"],
					rank: row["Rank"] || row["rank"],
					base: row["Base"] || row["base"],
					email: row["Email"] || row["email"],
					filter:
						typeof row["Excluded Categories"] === "string"
							? row["Excluded Categories"]
									.split(",")
									.map((s) => s.trim())
									.filter((s) => s)
							: row["filter"] || [],
					// Set default values for fields not in import
					authentication_level: 1,
					handicap_level: 3,
					password: "TempPassword123!", // Temporary password - users should change
				};
			});

			// Prevent importing admin users (except by admin)
			if (currentUser?.employee_id !== "admin") {
				const hasAdminUser = importedUsers.some(user => user.employee_id === "admin");
				if (hasAdminUser) {
					setError("Cannot import admin users. Only admin can manage admin accounts.");
					return;
				}
			}

			// Validate required fields
			const errors = [];
			importedUsers.forEach((user, index) => {
				if (!user.employee_id)
					errors.push(`Row ${index + 2}: Employee ID is required`);
				if (!user.full_name)
					errors.push(`Row ${index + 2}: Full Name is required`);
				if (!user.rank)
					errors.push(`Row ${index + 2}: Rank is required`);
				if (!user.base)
					errors.push(`Row ${index + 2}: Base is required`);
				if (!user.email)
					errors.push(`Row ${index + 2}: Email is required`);
			});

			if (errors.length > 0) {
				setError(`Import validation errors:\n${errors.join("\n")}`);
				return;
			}

			// Batch create users
			let successCount = 0;
			let errorCount = 0;
			const importErrors = [];

			for (const userData of importedUsers) {
				try {
					const response = await fetch("/api/users", {
						method: "POST",
						headers: {
							"Content-Type": "application/json",
							Authorization: `Bearer ${localStorage.getItem("token")}`,
						},
						body: JSON.stringify(userData),
					});

					if (response.ok) {
						successCount++;
					} else {
						errorCount++;
						const errorData = await response.json();
						const errorMsg = errorData.message || errorData.error || "Unknown error";
						importErrors.push(`${userData.employee_id}: ${errorMsg}`);
					}
				} catch (err) {
					errorCount++;
					console.error(`Import error for ${userData.employee_id}:`, err);
					importErrors.push(`${userData.employee_id}: Network/connection error`);
				}
			}

			// Show import results
			let message = `Import completed: ${successCount} users created successfully`;
			if (errorCount > 0) {
				message += `, ${errorCount} errors:\n${importErrors.join(
					"\n"
				)}`;
			}

			if (errorCount > 0) {
				setError(message);
			} else {
				alert(message);
			}

			await fetchUsers();
		} catch (err) {
			console.error("Import processing error:", err);
			setError("Failed to process Excel file. Please check the format.");
		}
	};

	// Helper function to get authentication level CSS class
	const getAuthClass = (level: number) => {
		// Map specific authentication levels to CSS classes
		switch (level) {
			case 1:
				return "auth1";
			case 2:
				return "auth2";
			case 3:
				return "auth3";
			case 4:
				return "auth4";
			case 5:
				return "auth5";
			case 10:
				return "auth10";
			case 20:
				return "auth20";
			case 99:
				return "auth99";
			default:
				// For any other levels, map to closest
				if (level >= 99) return "auth99";
				if (level >= 20) return "auth20";
				if (level >= 10) return "auth10";
				if (level >= 5) return "auth5";
				if (level >= 4) return "auth4";
				if (level >= 3) return "auth3";
				if (level >= 2) return "auth2";
				return "auth1";
		}
	};

	// Helper function to get handicap level CSS class
	const getHandicapClass = (level: number) => {
		// Map handicap levels to CSS classes
		switch (level) {
			case 1:
				return "handicap1";
			case 2:
				return "handicap2";
			case 3:
				return "handicap3";
			case 4:
				return "handicap4";
			case 5:
				return "handicap5";
			default:
				return "handicap3"; // Default to level 3
		}
	};

	// Helper function to extract rank abbreviation
	const getRankAbbreviation = (rank: string) => {
		if (!rank) return "";
		
		// Special case for admin
		if (rank.toLowerCase() === "admin") return "admin";
		
		// Extract abbreviation before the first " - " or return first part
		const parts = rank.split(" - ");
		return parts[0];
	};

	// Build columns based on user permissions
	const columns = [
		// Employee ID - Always show Employee ID column for level 5+ users
		...(currentUser && currentUser.authentication_level >= 5
			? [
					{
						key: "employee_id",
						label: "ID",
						sortable: true,
						filterable: true,
						// Special styling for admin user
						render: (value: string) => (
							<span className={value === "admin" ? styles.adminEmployeeId : ""}>
								{value}
							</span>
						),
					},
			  ]
			: []),
		{
			key: "full_name",
			label: "Name",
			sortable: true,
			filterable: true,
			// Special styling for admin user
			render: (value: string, user: User) => (
				<span className={user.employee_id === "admin" ? styles.adminFullName : ""}>
					{value}
					{user.employee_id === "admin" && (
						<span className={styles.adminBadge}>🔑 ADMIN</span>
					)}
				</span>
			),
		},
		{
			key: "rank",
			label: "Rank",
			sortable: true,
			filterable: true,
			// Show only rank abbreviation in table
			render: (value: string) => (
				<span>{getRankAbbreviation(value)}</span>
			),
		},
		{
			key: "base",
			label: "Base",
			sortable: true,
			filterable: true,
		},
		{
			key: "email",
			label: "Email",
			sortable: true,
			filterable: true,
		},
		// Handicap Level - only visible to level 10+
		...(currentUser && currentUser.authentication_level >= 10
			? [
					{
						key: "handicap_level",
						label: "Handicap",
						sortable: true,
						filterable: false,
						render: (value: number) => (
							<span
								className={`${styles.handicapBadge} ${
									styles[getHandicapClass(value)]
								}`}
							>
								Level {value}
							</span>
						),
					},
			  ]
			: []),
		// Auth Level - only visible to level 20+
		...(currentUser && currentUser.authentication_level >= 20
			? [
					{
						key: "authentication_level",
						label: "Auth Level",
						sortable: true,
						filterable: false,
						render: (value: number) => (
							<span
								className={`${styles.authBadge} ${
									styles[getAuthClass(value)]
								}`}
							>
								Level {value}
							</span>
						),
					},
			  ]
			: []),
		{
			key: "filter",
			label: "Excluded Categories",
			sortable: false,
			filterable: false,
			render: (value: string[]) => (
				<div className={styles.filterTags}>
					{value && value.length > 0 ? (
						value.map((filter, index) => (
							<span key={index} className={styles.filterTag}>
								{filter}
							</span>
						))
					) : (
						<span className={styles.noFilters}>None</span>
					)}
				</div>
			),
		},
	];

	if (loading) {
		return (
			<div className={styles.loading}>
				<div className="loading-spinner"></div>
				<p>Loading users...</p>
			</div>
		);
	}

	return (
		<div className={styles.userManagement}>
			<div className={styles.header}>
				<h1>User Management</h1>
				{/* Show admin status if current user is admin */}
				{currentUser?.employee_id === "admin" && (
					<div className={styles.adminStatus}>
						<span className={styles.adminIndicator}>
							🔑 Admin Mode - Admin user visible
						</span>
					</div>
				)}
				<div className={styles.actions}>
					<button
						className="btn btn-primary"
						onClick={() => setShowAddForm(true)}
					>
						{buttonText.addText}
					</button>
					<button
						className="btn btn-secondary"
						onClick={handleExportExcel}
					>
						{buttonText.exportText}
					</button>
					<input
						type="file"
						accept=".xlsx,.xls"
						onChange={(e) => {
							const file = e.target.files?.[0];
							if (file) handleImportExcel(file);
						}}
						style={{ display: "none" }}
						id="import-excel"
					/>
					<label htmlFor="import-excel" className="btn btn-secondary">
						{buttonText.importText}
					</label>
					{selectedUsers.length > 0 && (
						<button
							className="btn btn-danger"
							onClick={() => handleDeleteUsers(selectedUsers)}
						>
							{buttonText.deleteText(selectedUsers.length)}
						</button>
					)}
				</div>
			</div>

			{error && <div className="alert alert-error">{error}</div>}

			<div className={styles.importHelp}>
				<details>
					<summary>💡 Excel Import Format Guide</summary>
					<p>Your Excel file should contain the following columns:</p>
					<ul>
						<li>
							<strong>Employee ID</strong> - Unique identifier
							(required)
						</li>
						<li>
							<strong>Full Name</strong> - User's full name
							(required)
						</li>
						<li>
							<strong>Rank</strong> - User's rank (required)
						</li>
						<li>
							<strong>Base</strong> - User's base location
							(required)
						</li>
						<li>
							<strong>Email</strong> - User's email address
							(required)
						</li>
						<li>
							<strong>Excluded Categories</strong> -
							Comma-separated list (optional)
						</li>
					</ul>
					<p>
						<em>
							Default password "TempPassword123!" will be assigned
							to imported users.
						</em>
					</p>
				</details>
			</div>

			<div className={styles.tableContainer}>
				<DataTable
					data={users}
					columns={columns}
					onEdit={(user) => setEditingUser(user)}
					onDelete={(user) => handleDeleteUsers([user.id])}
					onSelectionChange={setSelectedUsers}
					selectedItems={selectedUsers}
					rowKey="id"
				/>
			</div>

			{(showAddForm || editingUser) && (
				<UserForm
					user={editingUser}
					onSave={handleSaveUser}
					onCancel={() => {
						setEditingUser(null);
						setShowAddForm(false);
					}}
					currentUserAuthLevel={
						currentUser?.authentication_level || 1
					}
					currentUser={currentUser}
				/>
			)}
		</div>
	);
};

interface UserFormProps {
	user: User | null;
	onSave: (userData: Partial<User>) => void;
	onCancel: () => void;
	currentUserAuthLevel: number;
	currentUser: User | null;
}

const UserForm = ({
	user,
	onSave,
	onCancel,
	currentUserAuthLevel,
	currentUser,
}: UserFormProps) => {
	const [formData, setFormData] = useState({
		employee_id: user?.employee_id || "",
		full_name: user?.full_name || "",
		rank: user?.rank || "",
		base: user?.base || "",
		email: user?.email || "",
		password: "",
		filter: user?.filter || [],
		handicap_level: user?.handicap_level || 3,
		authentication_level: user?.authentication_level || 1,
	});

	// Available filter categories
	const availableCategories = [
		"Safety",
		"Regulations",
		"Protocol",
		"Operations",
		"Emergency",
		"Equipment",
		"Training",
		"Compliance",
		"B738機種",
		"ATR機種"
	];

	const handleSubmit = (e: React.FormEvent) => {
		e.preventDefault();
		const submitData = { ...formData };

		// Remove password if empty (for updates)
		if (!submitData.password && user) {
			delete submitData.password;
		}

		onSave(submitData);
	};

	const handleFilterToggle = (category: string) => {
		setFormData((prev) => {
			const newFilters = prev.filter.includes(category)
				? prev.filter.filter((f) => f !== category)
				: [...prev.filter, category];
			return { ...prev, filter: newFilters };
		});
	};

	const handleRankSelect = (e: React.ChangeEvent<HTMLSelectElement>) => {
		setFormData((prev) => ({ ...prev, rank: e.target.value }));
	};

	// Updated rank options with full descriptions
	const commonRanks = [
		"FA - Flight Attendant", 
		"FS - Flight Stewardess", 
		"LF - Leading Flight Attendant", 
		"PR - Purser", 
		"FI - Flight Attendant Instructor", 
		"SC - Section Chief", 
		"MG - Manager"
	];

	// Determine if password field should be shown and if it's editable
	const canChangePassword = () => {
		if (!user) return true; // New user, always show password
		if (!currentUser) return false;
		if (currentUser.authentication_level >= 20) return true; // Level 20+ can change any password
		if (user.id === currentUser.id) return true; // Can change own password
		return false; // Cannot change other users' passwords
	};

	// Determine if this is editing another user's account
	const isEditingOtherUser = () => {
		if (!user || !currentUser) return false;
		return user.id !== currentUser.id;
	};

	return (
		<div className={styles.modal}>
			<div className={styles.modalContent}>
				<div className={styles.modalHeader}>
					<h2>
						{user ? "✏️ Edit User" : "➕ Add New User"}
						{/* Show admin indicator in form */}
						{user?.employee_id === "admin" && (
							<span className={styles.adminFormBadge}>🔑 ADMIN ACCOUNT</span>
						)}
					</h2>
					<button
						type="button"
						className={styles.closeButton}
						onClick={onCancel}
						aria-label="Close"
					>
						✕
					</button>
				</div>

				<form onSubmit={handleSubmit} className={styles.userForm}>
					<div className={styles.formGrid}>
						{/* Employee ID - show based on permissions and form type */}
						{currentUser && 
							(currentUser.authentication_level >= 5) && (
							<div className={styles.formGroup}>
								<label className={styles.formLabel}>
									Employee ID *
								</label>
								<input
									type="text"
									className={styles.formInput}
									value={formData.employee_id}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											employee_id: e.target.value,
										}))
									}
									required
									placeholder="e.g., USER001"
									// Disable editing admin employee ID for non-admin users
									disabled={
										user?.employee_id === "admin" && 
										currentUser?.employee_id !== "admin"
									}
								/>
								{user?.employee_id === "admin" && (
									<small className={styles.adminNote}>
										⚠️ Admin account - handle with care
									</small>
								)}
							</div>
						)}

						<div className={styles.formGroup}>
							<label className={styles.formLabel}>Full Name *</label>
							<input
								type="text"
								className={styles.formInput}
								value={formData.full_name}
								onChange={(e) =>
									setFormData((prev) => ({
										...prev,
										full_name: e.target.value,
									}))
								}
								required
								placeholder="Enter full name"
							/>
						</div>

						<div className={styles.formGroup}>
							<label className={styles.formLabel}>Rank *</label>
							<select
								className={styles.formSelect}
								value={formData.rank}
								onChange={handleRankSelect}
								required
							>
								<option value="">Select Rank</option>
								{commonRanks.map((rank) => (
									<option key={rank} value={rank}>
										{rank}
									</option>
								))}
							</select>
						</div>

						<div className={styles.formGroup}>
							<label className={styles.formLabel}>Base *</label>
							<input
								type="text"
								className={styles.formInput}
								value={formData.base}
								onChange={(e) =>
									setFormData((prev) => ({
										...prev,
										base: e.target.value,
									}))
								}
								required
								placeholder="e.g., KHH"
							/>
						</div>

						<div className={styles.formGroup}>
							<label className={styles.formLabel}>Email *</label>
							<input
								type="email"
								className={styles.formInput}
								value={formData.email}
								onChange={(e) =>
									setFormData((prev) => ({
										...prev,
										email: e.target.value,
									}))
								}
								required
								placeholder="user@example.com"
							/>
						</div>

						{/* Password field - only show if user has permission and restrict editing other users */}
						{canChangePassword() && !isEditingOtherUser() && (
							<div className={styles.formGroup}>
								<label className={styles.formLabel}>
									Password {!user && "*"}
									{user && (
										<span className={styles.optional}>
											(Leave blank to keep current)
										</span>
									)}
								</label>
								<input
									type="password"
									className={styles.formInput}
									value={formData.password}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											password: e.target.value,
										}))
									}
									required={!user}
									placeholder={
										user
											? "Leave blank to keep current password"
											: "Enter password"
									}
									minLength={6}
								/>
								{user?.employee_id === "admin" && (
									<small className={styles.adminNote}>
										⚠️ Changing admin password affects system access
									</small>
								)}
							</div>
						)}

						{/* Show password field for level 20+ users editing other users */}
						{canChangePassword() && isEditingOtherUser() && currentUser?.authentication_level >= 20 && (
							<div className={styles.formGroup}>
								<label className={styles.formLabel}>
									Password 
									<span className={styles.optional}>
										(Leave blank to keep current)
									</span>
								</label>
								<input
									type="password"
									className={styles.formInput}
									value={formData.password}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											password: e.target.value,
										}))
									}
									placeholder="Leave blank to keep current password"
									minLength={6}
								/>
								{user?.employee_id === "admin" && (
									<small className={styles.adminNote}>
										⚠️ Changing admin password affects system access
									</small>
								)}
								<small className={styles.authNote}>
									✅ You have level {currentUser?.authentication_level} access - can modify other users' passwords
								</small>
							</div>
						)}

						{/* Handicap Level - only for level 10+ users */}
						{currentUser && currentUser.authentication_level >= 10 && (
							<div className={styles.formGroup}>
								<label className={styles.formLabel}>
									Handicap Level
								</label>
								<select
									className={styles.formSelect}
									value={formData.handicap_level}
									onChange={(e) =>
										setFormData((prev) => ({
											...prev,
											handicap_level: parseInt(
												e.target.value
											),
										}))
									}
								>
									<option value={1}>
										1 - Hardest Questions Only
									</option>
									<option value={2}>
										2 - Hard Questions
									</option>
									<option value={3}>
										3 - Mixed Questions (Default)
									</option>
									<option value={4}>
										4 - Easy Questions
									</option>
									<option value={5}>
										5 - Easiest Questions Only
									</option>
								</select>
								<small>
									Controls difficulty of test questions for
									this user
								</small>
							</div>
						)}

						{/* Auth Level - only for level 20+ users */}
						{currentUser && currentUser.authentication_level >= 20 && (
							<div className={styles.formGroup}>
								<label className={styles.formLabel}>
									Authentication Level
								</label>
								<AuthLevelDropdown
									value={formData.authentication_level}
									onChange={(level) =>
										setFormData((prev) => ({
											...prev,
											authentication_level: level,
										}))
									}
									maxLevel={currentUserAuthLevel}
								/>
								<small>
									Controls access to different parts of the
									application. Cannot exceed your level (
									{currentUserAuthLevel}).
								</small>
								{user?.employee_id === "admin" && (
									<small className={styles.adminNote}>
										⚠️ Admin typically has level 99 access
									</small>
								)}
							</div>
						)}
					</div>

					{/* Filter Categories Section */}
					<div className={styles.filterCategoriesSection}>
						<label className={styles.formLabel}>
							🚫 Excluded Test Categories
							<span className={styles.optional}>(Optional)</span>
						</label>
						<div className={styles.filterCategories}>
							{availableCategories.map((category) => (
								<label
									key={category}
									className={styles.filterCheckbox}
								>
									<input
										type="checkbox"
										checked={formData.filter.includes(
											category
										)}
										onChange={() =>
											handleFilterToggle(category)
										}
									/>
									<span>{category}</span>
								</label>
							))}
						</div>
						<small>
							Selected categories will be excluded from this
							user's oral tests. Leave unchecked to allow all
							question types.
						</small>
					</div>

					<div className={styles.formActions}>
						<button
							type="button"
							className="btn btn-secondary"
							onClick={onCancel}
						>
							❌ Cancel
						</button>
						<button type="submit" className="btn btn-primary">
							{user ? "💾 Update User" : "✅ Create User"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};

// Custom Authentication Level Dropdown Component
const AuthLevelDropdown = ({
	value,
	onChange,
	maxLevel,
}: {
	value: number;
	onChange: (level: number) => void;
	maxLevel: number;
}) => {
	const [isOpen, setIsOpen] = useState(false);

	const levels = [
		{ value: 1, short: "Squire (見習戰士)", full: "Dashboard" },
		{ value: 2, short: "Knight (騎士)", full: "Dashboard/Results" },
		{ value: 3, short: "Archer (弓手)", full: "Dashboard/Results/Test" },
		{ value: 4, short: "Oracle (陰陽師)", full: "Dashboard/Results/Test/Questions" },
		{ value: 5, short: "Black Mage (黑魔道士)", full: "Dashboard/Results/Test/Questions/Users" },
		{ value: 10, short: "Samurai (侍)", full: "+Handicap/Difficulty Level" },
		{ value: 20, short: "Dark Knight (黑暗騎士)", full: "+Authentication Level" },
		{ value: 99, short: "GOD", full: "Super Administrator" },
	].filter((level) => level.value <= maxLevel);

	const selectedLevel = levels.find((l) => l.value === value);

	// Helper function to get level CSS class for dropdown
	const getLevelClass = (level: number) => {
		// Map specific authentication levels to CSS classes
		switch (level) {
			case 1:
				return "level1";
			case 2:
				return "level2";
			case 3:
				return "level3";
			case 4:
				return "level4";
			case 5:
				return "level5";
			case 10:
				return "level10";
			case 20:
				return "level20";
			case 99:
				return "level99";
			default:
				// For any other levels, map to closest
				if (level >= 99) return "level99";
				if (level >= 20) return "level20";
				if (level >= 10) return "level10";
				if (level >= 5) return "level5";
				if (level >= 4) return "level4";
				if (level >= 3) return "level3";
				if (level >= 2) return "level2";
				return "level1";
		}
	};

	// Close dropdown when clicking outside
	useEffect(() => {
		const handleClickOutside = (event: MouseEvent) => {
			const target = event.target as Element;
			if (!target.closest(`.${styles.customDropdown}`)) {
				setIsOpen(false);
			}
		};

		if (isOpen) {
			document.addEventListener("mousedown", handleClickOutside);
			return () =>
				document.removeEventListener("mousedown", handleClickOutside);
		}
	}, [isOpen]);

	return (
		<div className={styles.customDropdown}>
			<button
				type="button"
				className={styles.dropdownButton}
				onClick={() => setIsOpen(!isOpen)}
				aria-expanded={isOpen}
				aria-haspopup="listbox"
			>
				<span
					className={`${styles.levelNumber} ${
						styles[getLevelClass(value)]
					}`}
				>
					{value}
				</span>
				<span className={styles.levelShort}>
					{selectedLevel?.short}
				</span>
				<span
					className={`${styles.dropdownArrow} ${
						isOpen ? styles.rotated : ""
					}`}
				>
					▼
				</span>
			</button>

			{isOpen && (
				<div className={styles.dropdownMenu} role="listbox">
					{levels.map((level) => (
						<button
							key={level.value}
							type="button"
							className={`${styles.dropdownItem} ${
								value === level.value ? styles.selected : ""
							}`}
							onClick={() => {
								onChange(level.value);
								setIsOpen(false);
							}}
							role="option"
							aria-selected={value === level.value}
						>
							<div className={styles.levelRow}>
								<span
									className={`${styles.levelNumber} ${
										styles[getLevelClass(level.value)]
									}`}
								>
									{level.value}
								</span>
								<div className={styles.levelInfo}>
									<div className={styles.levelShort}>
										{level.short}
									</div>
									<div className={styles.levelFull}>
										{level.full}
									</div>
								</div>
							</div>
						</button>
					))}
				</div>
			)}
		</div>
	);
};

export default UserManagement;