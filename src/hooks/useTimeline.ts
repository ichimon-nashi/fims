// Fixed src/hooks/useTimeline.ts - Cleaned up duplicate code and proper TypeScript types
import { useMemo, useState } from 'react';
import { ZoomLevel } from '@/lib/task.types';

interface Task {
  start_date?: string;
  due_date?: string;
}

export const useTimeline = (tasks: Task[] = []) => {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('days');
  const [viewStartDate, setViewStartDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - 7);
    return today;
  });

  const { dateRange, dateUnit, gridColumns } = useMemo(() => {
    const start = new Date(viewStartDate);
    const range: Date[] = [];
    let unit = '';
    let columns = 0;

    // Calculate dynamic end date based on tasks
    const calculateEndDate = (): Date => {
      if (!tasks || tasks.length === 0) {
        // Default range if no tasks
        const defaultEnd = new Date(start);
        switch (zoomLevel) {
          case 'days': defaultEnd.setDate(start.getDate() + 60); break;
          case 'weeks': defaultEnd.setDate(start.getDate() + (26 * 7)); break;
          case 'months': defaultEnd.setMonth(start.getMonth() + 12); break;
          case 'quarters': defaultEnd.setMonth(start.getMonth() + (8 * 3)); break;
        }
        return defaultEnd;
      }

      // Find the latest due date from all tasks
      let latestDate = new Date(start);
      tasks.forEach(task => {
        if (task.due_date) {
          const taskEndDate = new Date(task.due_date);
          if (taskEndDate > latestDate) {
            latestDate = taskEndDate;
          }
        }
      });

      // Add padding after the latest task
      switch (zoomLevel) {
        case 'days': latestDate.setDate(latestDate.getDate() + 30); break;
        case 'weeks': latestDate.setDate(latestDate.getDate() + (4 * 7)); break;
        case 'months': latestDate.setMonth(latestDate.getMonth() + 3); break;
        case 'quarters': latestDate.setMonth(latestDate.getMonth() + 6); break;
      }

      return latestDate;
    };

    const endDate = calculateEndDate();

    switch (zoomLevel) {
      case 'days':
        unit = 'day';
        const daysDiff = Math.ceil((endDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
        columns = Math.max(30, Math.min(365, daysDiff)); // Min 30 days, max 1 year
        
        for (let i = 0; i < columns; i++) {
          const date = new Date(start);
          date.setDate(start.getDate() + i);
          range.push(date);
        }
        break;
        
      case 'weeks':
        unit = 'week';
        const weeksDiff = Math.ceil((endDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24 * 7));
        columns = Math.max(12, Math.min(104, weeksDiff)); // Min 12 weeks, max 2 years
        
        for (let i = 0; i < columns; i++) {
          const date = new Date(start);
          date.setDate(start.getDate() + (i * 7));
          range.push(date);
        }
        break;
        
      case 'months':
        unit = 'month';
        const monthsDiff = (endDate.getFullYear() - start.getFullYear()) * 12 + (endDate.getMonth() - start.getMonth());
        columns = Math.max(6, Math.min(36, Math.max(1, monthsDiff))); // Min 6 months, max 3 years
        
        for (let i = 0; i < columns; i++) {
          const date = new Date(start);
          date.setMonth(start.getMonth() + i);
          range.push(date);
        }
        break;
        
      case 'quarters':
        unit = 'quarter';
        const totalMonths = (endDate.getFullYear() - start.getFullYear()) * 12 + (endDate.getMonth() - start.getMonth());
        const quartersDiff = Math.ceil(totalMonths / 3);
        columns = Math.max(4, Math.min(20, Math.max(1, quartersDiff))); // Min 4 quarters, max 5 years
        
        for (let i = 0; i < columns; i++) {
          const date = new Date(start);
          date.setMonth(start.getMonth() + (i * 3));
          range.push(date);
        }
        break;
    }

    return { dateRange: range, dateUnit: unit, gridColumns: columns };
  }, [zoomLevel, viewStartDate, tasks]);

  // Completely rewritten getTaskPosition with proper calculations
  const getTaskPosition = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const viewStart = dateRange[0];
    
    if (!viewStart) {
      return { left: '0px', width: '100px' };
    }
    
    let startPosition: number;
    let endPosition: number;

    switch (zoomLevel) {
      case 'days':
        // Calculate position based on actual date difference in days
        const startDays = Math.floor((start.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24));
        const endDays = Math.floor((end.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24)) + 1;
        startPosition = startDays;
        endPosition = endDays;
        break;
        
      case 'weeks':
        // Calculate position based on weeks
        const startWeeks = Math.floor((start.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24 * 7));
        const endWeeks = Math.floor((end.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24 * 7)) + 1;
        startPosition = startWeeks;
        endPosition = endWeeks;
        break;
        
      case 'months':
        // Calculate position based on months with proper handling of month boundaries
        const startMonths = (start.getFullYear() - viewStart.getFullYear()) * 12 + (start.getMonth() - viewStart.getMonth());
        const endMonths = (end.getFullYear() - viewStart.getFullYear()) * 12 + (end.getMonth() - viewStart.getMonth()) + 1;
        startPosition = startMonths;
        endPosition = endMonths;
        break;
        
      case 'quarters':
        // Calculate position based on quarters
        const startQuarter = Math.floor(((start.getFullYear() - viewStart.getFullYear()) * 12 + (start.getMonth() - viewStart.getMonth())) / 3);
        const endQuarter = Math.floor(((end.getFullYear() - viewStart.getFullYear()) * 12 + (end.getMonth() - viewStart.getMonth())) / 3) + 1;
        startPosition = startQuarter;
        endPosition = endQuarter;
        break;
        
      default:
        startPosition = 0;
        endPosition = 1;
    }
    
    // Ensure minimum width and clamp to visible range
    const width = Math.max(1, endPosition - startPosition);
    const left = Math.max(0, startPosition);
    
    // Calculate pixel positions based on column width
    const getColumnWidth = () => {
      switch (zoomLevel) {
        case "days": return 80;
        case "weeks": return 100;
        case "months": return 120;
        case "quarters": return 150;
        default: return 80;
      }
    };
    
    const columnWidth = getColumnWidth();
    
    return { 
      left: `${left * columnWidth}px`, 
      width: `${width * columnWidth}px`,
    };
  };

  // Fixed getTodayPosition function with pixel-based positioning
  const getTodayPosition = () => {
    const today = new Date();
    const firstDate = dateRange[0];
    
    if (!firstDate) return '0px';
    
    let todayPosition: number;
    
    switch (zoomLevel) {
      case 'days':
        const daysDiff = Math.floor((today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24));
        todayPosition = daysDiff + (today.getHours() / 24); // Add hour precision
        break;
      case 'weeks':
        const weeksDiff = (today.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 7);
        todayPosition = weeksDiff;
        break;
      case 'months':
        const yearsDiff = today.getFullYear() - firstDate.getFullYear();
        const monthsDiff = yearsDiff * 12 + (today.getMonth() - firstDate.getMonth());
        const dayProgress = today.getDate() / new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
        todayPosition = monthsDiff + dayProgress;
        break;
      case 'quarters':
        const totalMonthsDiff = (today.getFullYear() - firstDate.getFullYear()) * 12 + (today.getMonth() - firstDate.getMonth());
        const quarterProgress = (today.getDate() / new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate()) / 3;
        todayPosition = totalMonthsDiff / 3 + quarterProgress;
        break;
      default:
        todayPosition = 0;
    }
    
    // Clamp to valid range
    todayPosition = Math.max(0, Math.min(dateRange.length, todayPosition));
    
    // Return pixel position instead of percentage
    const getColumnWidth = () => {
      switch (zoomLevel) {
        case "days": return 80;
        case "weeks": return 100;
        case "months": return 120;
        case "quarters": return 150;
        default: return 80;
      }
    };
    
    return `${todayPosition * getColumnWidth()}px`;
  };

  return {
    zoomLevel,
    setZoomLevel,
    viewStartDate,
    setViewStartDate,
    dateRange,
    getTaskPosition,
    getTodayPosition
  };
};