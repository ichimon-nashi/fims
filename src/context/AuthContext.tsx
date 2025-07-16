// src/context/AuthContext.tsx
// Fixed version with consistent localStorage key
"use client";

import { createContext, useContext, useEffect, useState } from "react";

interface User {
	id: string;
	employee_id: string;
	full_name: string;
	rank: string;
	base: string;
	email: string;
	filter: string[];
	handicap_level: number;
	authentication_level: number;
}

interface AuthContextType {
	user: User | null;
	token: string | null;
	login: (identifier: string, password: string) => Promise<boolean>;
	logout: () => void;
	loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
	user: null,
	token: null,
	login: async () => false,
	logout: () => {},
	loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	useEffect(() => {
		console.log("=== AUTH CONTEXT INIT ===");
		
		// Check for existing token on mount - using consistent key "token"
		const savedToken = localStorage.getItem("token");
		console.log("Saved token from localStorage:", savedToken ? `${savedToken.substring(0, 20)}...` : "null");
		
		if (savedToken) {
			console.log("Found saved token, verifying...");
			verifyToken(savedToken);
		} else {
			console.log("No saved token found");
			setLoading(false);
		}
	}, []);

	// Debug: Log token changes
	useEffect(() => {
		console.log("Token state changed:", token ? `${token.substring(0, 20)}...` : "null");
	}, [token]);

	const verifyToken = async (tokenToVerify: string) => {
		try {
			console.log("Verifying token:", tokenToVerify.substring(0, 20) + "...");
			
			const response = await fetch("/api/auth/verify", {
				headers: {
					Authorization: `Bearer ${tokenToVerify}`,
				},
			});

			console.log("Verify response status:", response.status);

			if (response.ok) {
				const data = await response.json();
				console.log("Token verification successful:", data.user.email);
				setUser(data.user);
				setToken(tokenToVerify);
				localStorage.setItem("token", tokenToVerify); // Fixed: use "token" key
			} else {
				console.log("Token verification failed");
				// Token is invalid
				localStorage.removeItem("token"); // Fixed: use "token" key
				setUser(null);
				setToken(null);
			}
		} catch (error) {
			console.error("Token verification error:", error);
			localStorage.removeItem("token"); // Fixed: use "token" key
			setUser(null);
			setToken(null);
		} finally {
			setLoading(false);
		}
	};

	const login = async (identifier: string, password: string): Promise<boolean> => {
		try {
			console.log("=== LOGIN ATTEMPT ===");
			console.log("Identifier:", identifier);
			
			const response = await fetch("/api/auth/login", {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
				},
				body: JSON.stringify({ identifier, password }),
			});

			console.log("Login response status:", response.status);

			if (response.ok) {
				const data = await response.json();
				console.log("Login successful for:", data.user.email);
				console.log("Received token:", data.token ? `${data.token.substring(0, 20)}...` : "null");
				
				// Set state first
				setUser(data.user);
				setToken(data.token);
				
				// Then save to localStorage with consistent key
				localStorage.setItem("token", data.token); // Fixed: use "token" key
				
				console.log("Token saved to localStorage with key 'token'");
				console.log("Auth state updated - hasUser:", !!data.user, "hasToken:", !!data.token);
				
				return true;
			} else {
				const errorData = await response.json();
				console.log("Login failed:", errorData.message);
				return false;
			}
		} catch (error) {
			console.error("Login error:", error);
			return false;
		}
	};

	const logout = () => {
		console.log("=== LOGOUT ===");
		setUser(null);
		setToken(null);
		localStorage.removeItem("token"); // Fixed: use "token" key
	};

	// Debug: Log current state
	console.log("Current auth state:", {
		hasUser: !!user,
		hasToken: !!token,
		loading,
		userEmail: user?.email || 'none'
	});

	return (
		<AuthContext.Provider
			value={{
				user,
				token,
				login,
				logout,
				loading,
			}}
		>
			{children}
		</AuthContext.Provider>
	);
}

export const useAuth = () => useContext(AuthContext);