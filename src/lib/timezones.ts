import { toZonedTime, fromZonedTime } from "date-fns-tz";

/**
 * Pacific timezone constant - NEVER change this
 * All date operations in the dashboard use Pacific Time (America/Los_Angeles)
 */
export const PACIFIC_TZ = 'America/Los_Angeles';

/**
 * Converts a Date to the start of day in Pacific Time (00:00:00)
 * Returns the equivalent UTC timestamp
 */
export const getPacificStartOfDay = (date: Date): Date => {
  const pacificDate = toZonedTime(date, PACIFIC_TZ);
  const year = pacificDate.getFullYear();
  const month = String(pacificDate.getMonth() + 1).padStart(2, '0');
  const day = String(pacificDate.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}T00:00:00`;
  return fromZonedTime(dateStr, PACIFIC_TZ);
};

/**
 * Converts a Date to the end of day in Pacific Time (23:59:59.999)
 * Returns the equivalent UTC timestamp
 */
export const getPacificEndOfDay = (date: Date): Date => {
  const pacificDate = toZonedTime(date, PACIFIC_TZ);
  const year = pacificDate.getFullYear();
  const month = String(pacificDate.getMonth() + 1).padStart(2, '0');
  const day = String(pacificDate.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}T23:59:59.999`;
  return fromZonedTime(dateStr, PACIFIC_TZ);
};

/**
 * Formats a date/timestamp string in Pacific Time
 * @param date - ISO string or Date object (stored in UTC)
 * @param formatStr - Format string (e.g., "MMM d, yyyy", "MMM d, yyyy HH:mm", "HH:mm:ss")
 */
export const formatPacificTime = (date: string | Date, formatStr: string = "MMM d, yyyy"): string => {
  const dateObj = typeof date === 'string' ? new Date(date) : date;
  const pacificDate = toZonedTime(dateObj, PACIFIC_TZ);
  
  // Manual formatting to avoid importing date-fns format
  const year = pacificDate.getFullYear();
  const month = pacificDate.getMonth();
  const day = pacificDate.getDate();
  const hours = pacificDate.getHours();
  const minutes = pacificDate.getMinutes();
  const seconds = pacificDate.getSeconds();
  
  const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  
  return formatStr
    .replace('yyyy', String(year))
    .replace('MMM', monthNames[month])
    .replace('dd', String(day).padStart(2, '0'))
    .replace('d', String(day))
    .replace('HH', String(hours).padStart(2, '0'))
    .replace('mm', String(minutes).padStart(2, '0'))
    .replace('ss', String(seconds).padStart(2, '0'));
};
