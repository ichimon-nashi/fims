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
	return jwt.sign(
		{
			userId: user.id,
			email: user.email,
			authLevel: user.authentication_level,
		},
		JWT_SECRET,
		{ expiresIn: "8h" }
	);
};

export const verifyToken = (token: string): JWTPayload => {
	try {
		return jwt.verify(token, JWT_SECRET) as JWTPayload;
	} catch (error) {
		throw new Error("Invalid token");
	}
};

export const extractTokenFromHeader = (
	authHeader: string | null
): string | null => {
	if (!authHeader || !authHeader.startsWith("Bearer ")) {
		return null;
	}
	return authHeader.substring(7);
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
			return res.status(401).json({ 
				message: "Invalid token",
				error: error instanceof Error ? error.message : String(error)
			});
		}
	};
};