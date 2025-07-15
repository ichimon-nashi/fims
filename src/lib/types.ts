// Add these new types to your existing src/lib/types.ts file

// Schedule-related types for FI roster
export interface ScheduleEntry {
  id: string;
  employee_id: string;
  full_name: string;
  rank: string;
  base: string;
  date: string; // YYYY-MM-DD format
  duties: string[];
  year: number;
  created_at: Date;
  updated_at: Date;
}

export type DutyType = "OD" | "SAG" | "教師會" | "訓練" | "課" | "專案" | "休假" | "航查" | "IOSA";

export const DUTY_TYPES: DutyType[] = [
  "OD", 
  "SAG", 
  "教師會", 
  "訓練", 
  "課", 
  "專案", 
  "休假", 
  "航查", 
  "IOSA"
];

// Color scheme for different duties
export const DUTY_COLORS: Record<DutyType, string> = {
  "OD": "#FF6B6B",        // Red
  "SAG": "#4ECDC4",       // Teal
  "教師會": "#45B7D1",     // Blue
  "訓練": "#96CEB4",       // Green
  "課": "#FFEAA7",         // Yellow
  "專案": "#DDA0DD",       // Plum
  "休假": "#98D8C8",       // Mint
  "航查": "#F7DC6F",       // Light Yellow
  "IOSA": "#BB8FCE"       // Lavender
};

export interface CalendarDay {
  date: string;
  day: number;
  month: number;
  year: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  duties: string[];
}

export interface ScheduleFilters {
  year: number;
  month?: number;
  employeeId?: string;
}

export interface ExportData {
  employee_id: string;
  full_name: string;
  rank: string;
  base: string;
  schedule: Record<string, string[]>; // date -> duties mapping
}