// src/lib/auth.ts
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { User, JWTPayload } from "./types";

const JWT_SECRET =
	process.env.JWT_SECRET || "your-secret-key-change-in-production";

export const hashPassword = async (password: string): Promise<string> => {
	const saltRounds = 12;
	return await bcrypt.hash(password, saltRounds);
};

export const verifyPassword = async (
	password: string,
	hashedPassword: string
): Promise<boolean> => {
	return await bcrypt.compare(password, hashedPassword);
};

export const generateToken = (user: Omit<User, "password" | "password_hash">): string => {
	console.log("Generating token for user:", user.id, user.email);
	
	const payload: JWTPayload = {
		userId: user.id,
		email: user.email,
		authLevel: user.authentication_level,
	};
	
	console.log("Token payload:", payload);
	
	const token = jwt.sign(payload, JWT_SECRET, { expiresIn: "8h" });
	
	console.log("Token generated successfully, length:", token.length);
	return token;
};

export const verifyToken = (token: string): JWTPayload => {
	try {
		console.log("Verifying token, length:", token.length);
		console.log("Token starts with:", token.substring(0, 20) + "...");
		console.log("JWT_SECRET defined:", !!JWT_SECRET);
		console.log("JWT_SECRET length:", JWT_SECRET.length);
		
		const decoded = jwt.verify(token, JWT_SECRET) as JWTPayload;
		
		console.log("Token verified successfully:", {
			userId: decoded.userId,
			email: decoded.email,
			authLevel: decoded.authLevel,
			exp: decoded.exp ? new Date(decoded.exp * 1000) : 'no expiration'
		});
		
		return decoded;
	} catch (error) {
		console.error("Token verification failed:", error);
		console.error("Error details:", {
			name: error instanceof Error ? error.name : 'Unknown',
			message: error instanceof Error ? error.message : String(error),
			tokenPreview: token.substring(0, 50) + "..."
		});
		throw new Error("Invalid token");
	}
};

export const extractTokenFromHeader = (
	authHeader: string | null
): string | null => {
	console.log("Extracting token from header:", authHeader ? "Bearer " + authHeader.substring(7, 27) + "..." : "null");
	
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		console.log("Invalid auth header format");
		return null;
	}
	
	const token = authHeader.substring(7);
	console.log("Extracted token length:", token.length);
	return token;
};

export const requireAuth = (minAuthLevel: number = 1) => {
	return (req: any, res: any, next: any) => {
		try {
			const token = extractTokenFromHeader(req.headers.authorization);

			if (!token) {
				return res.status(401).json({ message: "No token provided" });
			}

			const decoded = verifyToken(token);

			if (decoded.authLevel < minAuthLevel) {
				return res
					.status(403)
					.json({ message: "Insufficient permissions" });
			}

			req.user = decoded;
			next();
		} catch (error: unknown) {
			console.error("Auth middleware error:", error);
			return res.status(401).json({ 
				message: "Invalid token",
				error: error instanceof Error ? error.message : String(error)
			});
		}
	};
};