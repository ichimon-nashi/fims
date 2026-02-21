// src/context/AuthContext.tsx
// Fixed version with better error handling and weather cache management
"use client";

import { createContext, useContext, useEffect, useState, useCallback } from "react";
import WeatherService from '@/services/weatherService';
import { User } from '@/lib/types'; // Import User type from types.ts

interface AuthContextType {
	user: User | null;
	token: string | null;
	permissions: any; // User's app permissions from database
	login: (identifier: string, password: string) => Promise<boolean>;
	logout: () => void;
	loading: boolean;
}

const AuthContext = createContext<AuthContextType>({
	user: null,
	token: null,
	permissions: null,
	login: async () => false,
	logout: () => {},
	loading: true,
});

export function AuthProvider({ children }: { children: React.ReactNode }) {
	const [user, setUser] = useState<User | null>(null);
	const [token, setToken] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	// Extract permissions from user object
	const permissions = user?.app_permissions || null;

	// Get weather service instance
	const weatherService = WeatherService.getInstance();

	const verifyToken = useCallback(async (tokenToVerify: string) => {
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
				localStorage.setItem("token", tokenToVerify);
				
				// Preload weather for verified user's base
				if (data.user.base) {
					console.log("🌤️ Preloading weather for verified user's base:", data.user.base);
					weatherService.preloadWeatherForBase(data.user.base);
				}
			} else {
				console.log("Token verification failed");
				// Token is invalid - clear weather cache
				weatherService.clearCacheForNewSession();
				localStorage.removeItem("token");
				setUser(null);
				setToken(null);
			}
		} catch (error) {
			console.error("Token verification error:", error);
			// Clear weather cache on error
			weatherService.clearCacheForNewSession();
			localStorage.removeItem("token");
			setUser(null);
			setToken(null);
		} finally {
			setLoading(false);
		}
	}, [weatherService]);

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
	}, [verifyToken]);

	// Debug: Log token changes
	useEffect(() => {
		console.log("Token state changed:", token ? `${token.substring(0, 20)}...` : "null");
	}, [token]);

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
				
				// Clear old weather cache for new session
				console.log("🗑️ Clearing weather cache for new login session");
				weatherService.clearCacheForNewSession();
				
				// Set state first
				setUser(data.user);
				setToken(data.token);
				
				// Then save to localStorage with consistent key
				localStorage.setItem("token", data.token);
				
				console.log("Token saved to localStorage with key 'token'");
				console.log("Auth state updated - hasUser:", !!data.user, "hasToken:", !!data.token);
				
				// Preload weather data for user's base after successful login
				if (data.user.base) {
					console.log("🚀 Scheduling weather preload for base:", data.user.base);
					setTimeout(() => {
						weatherService.preloadWeatherForBase(data.user.base);
					}, 1000); // 1 second delay to ensure session is fully established
				}
				
				return true;
			} else {
				const errorData = await response.json();
				console.log("Login failed:", errorData.message);
				
				// Throw error with specific message for access denied
				if (response.status === 403) {
					throw new Error(errorData.message);
				}
				
				return false;
			}
		} catch (error: any) {
			console.error("Login error:", error);
			// Re-throw the error so the login form can handle it
			throw error;
		}
	};

	const logout = () => {
		console.log("=== LOGOUT ===");
		
		// Clear weather cache for the session
		console.log("🗑️ Clearing weather cache on logout");
		weatherService.clearCacheForNewSession();
		
		// Clear auth state
		setUser(null);
		setToken(null);
		localStorage.removeItem("token");
		
		console.log("✅ Logout completed with weather cache cleared");
		// No automatic redirect - let the component handle it
	};

	// Debug: Log current state
	console.log("Current auth state:", {
		hasUser: !!user,
		hasToken: !!token,
		loading,
		userEmail: user?.email || 'none',
		userBase: user?.base || 'none'
	});

	return (
		<AuthContext.Provider
			value={{
				user,
				token,
				permissions,
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