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
