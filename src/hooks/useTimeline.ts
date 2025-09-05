// Updated src/hooks/useTimeline.ts - FIXED positioning calculations
import { useMemo, useState } from 'react';
import { ZoomLevel } from '@/lib/task.types';

export const useTimeline = () => {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('days');
  const [viewStartDate, setViewStartDate] = useState(() => {
    const today = new Date();
    today.setDate(today.getDate() - 7);
    return today;
  });

  const { dateRange, dateUnit, gridColumns } = useMemo(() => {
    const start = new Date(viewStartDate);
    let range: Date[] = [];
    let unit = '';
    let columns = 0;

    switch (zoomLevel) {
      case 'days':
        columns = 37;
        unit = 'day';
        for (let i = 0; i < columns; i++) {
          const date = new Date(start);
          date.setDate(start.getDate() + i);
          range.push(date);
        }
        break;
      case 'weeks':
        columns = 26;
        unit = 'week';
        for (let i = 0; i < columns; i++) {
          const date = new Date(start);
          date.setDate(start.getDate() + (i * 7));
          range.push(date);
        }
        break;
      case 'months':
        columns = 12;
        unit = 'month';
        for (let i = 0; i < columns; i++) {
          const date = new Date(start);
          date.setMonth(start.getMonth() + i);
          range.push(date);
        }
        break;
      case 'quarters':
        columns = 8;
        unit = 'quarter';
        for (let i = 0; i < columns; i++) {
          const date = new Date(start);
          date.setMonth(start.getMonth() + (i * 3));
          range.push(date);
        }
        break;
    }

    return { dateRange: range, dateUnit: unit, gridColumns: columns };
  }, [zoomLevel, viewStartDate]);

  // FIXED: Completely rewritten getTaskPosition with proper calculations
  const getTaskPosition = (startDate: string, endDate: string) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    const viewStart = dateRange[0];
    const viewEnd = dateRange[dateRange.length - 1];
    
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