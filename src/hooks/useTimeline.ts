// Fixed src/hooks/useTimeline.ts - Accurate date calculations
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
        
        // FIXED: Proper month generation to avoid duplicates
        const currentDate = new Date(start.getFullYear(), start.getMonth(), 1); // Start at beginning of month
        for (let i = 0; i < columns; i++) {
          range.push(new Date(currentDate));
          currentDate.setMonth(currentDate.getMonth() + 1); // Move to next month
        }
        break;
        
      case 'quarters':
        unit = 'quarter';
        const totalMonths = (endDate.getFullYear() - start.getFullYear()) * 12 + (endDate.getMonth() - start.getMonth());
        const quartersDiff = Math.ceil(totalMonths / 3);
        columns = Math.max(4, Math.min(20, Math.max(1, quartersDiff))); // Min 4 quarters, max 5 years
        
        // FIXED: Proper quarter generation
        const quarterStart = new Date(start.getFullYear(), Math.floor(start.getMonth() / 3) * 3, 1);
        for (let i = 0; i < columns; i++) {
          range.push(new Date(quarterStart));
          quarterStart.setMonth(quarterStart.getMonth() + 3); // Move to next quarter
        }
        break;
    }

    return { dateRange: range, dateUnit: unit, gridColumns: columns };
  }, [zoomLevel, viewStartDate, tasks]);

  // FIXED: Accurate task position calculations without extending end dates
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
        // FIXED: Precise day calculations - tasks end exactly on due date
        const startDays = (start.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24);
        const endDays = (end.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24); // Removed +1
        startPosition = startDays;
        endPosition = endDays + 1; // Add 1 only for display width, not date calculation
        break;
        
      case 'weeks':
        // More precise week calculations
        const startWeeks = (start.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24 * 7);
        const endWeeks = (end.getTime() - viewStart.getTime()) / (1000 * 60 * 60 * 24 * 7);
        startPosition = startWeeks;
        endPosition = endWeeks + 0.2;
        break;
        
      case 'months':
        // FIXED: Accurate month calculations without extra month extension
        const startYear = start.getFullYear();
        const startMonth = start.getMonth();
        const startDay = start.getDate();
        
        const endYear = end.getFullYear();
        const endMonth = end.getMonth(); 
        const endDay = end.getDate();
        
        const viewYear = viewStart.getFullYear();
        const viewMonth = viewStart.getMonth();
        
        // Calculate exact months from view start
        const startMonthsFromView = (startYear - viewYear) * 12 + (startMonth - viewMonth);
        const endMonthsFromView = (endYear - viewYear) * 12 + (endMonth - viewMonth);
        
        // Add day fractions within the month (0-1)
        const startDaysInMonth = new Date(startYear, startMonth + 1, 0).getDate();
        const endDaysInMonth = new Date(endYear, endMonth + 1, 0).getDate();
        
        const startDayFraction = (startDay - 1) / startDaysInMonth;
        const endDayFraction = (endDay - 1) / endDaysInMonth; // FIXED: Changed from endDay to (endDay - 1)
        
        startPosition = startMonthsFromView + startDayFraction;
        endPosition = endMonthsFromView + endDayFraction + (1 / endDaysInMonth); // Add one day width for visibility
        break;
        
      case 'quarters':
        // More precise quarter calculations
        const startQuarterMonths = (start.getFullYear() - viewStart.getFullYear()) * 12 + (start.getMonth() - viewStart.getMonth());
        const endQuarterMonths = (end.getFullYear() - viewStart.getFullYear()) * 12 + (end.getMonth() - viewStart.getMonth());
        
        const startDayInQuarter = start.getDate() / new Date(start.getFullYear(), start.getMonth() + 1, 0).getDate();
        const endDayInQuarter = end.getDate() / new Date(end.getFullYear(), end.getMonth() + 1, 0).getDate();
        
        startPosition = (startQuarterMonths + startDayInQuarter) / 3;
        endPosition = (endQuarterMonths + endDayInQuarter) / 3;
        break;
        
      default:
        startPosition = 0;
        endPosition = 1;
    }
    
    // Ensure minimum width and clamp to visible range
    const width = Math.max(0.5, endPosition - startPosition);
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