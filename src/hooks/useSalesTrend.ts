import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { eachDayOfInterval, format } from "date-fns";
import { formatInTimeZone } from "date-fns-tz";
import { PACIFIC_TZ } from "@/lib/timezones";

interface SalesTrendData {
  date: string;
  revenue: number;
  units: number;
}

export const useSalesTrend = (from: Date, to: Date) => {
  return useQuery({
    queryKey: ["sales-trend", from.toISOString(), to.toISOString()],
    queryFn: async (): Promise<SalesTrendData[]> => {
      
      // Query the pre-aggregated daily_sales_summary table using Pacific time dates
      const { data: summaries, error } = await supabase
        .from("daily_sales_summary")
        .select("summary_date, total_revenue, units_sold")
        .gte("summary_date", formatInTimeZone(from, PACIFIC_TZ, 'yyyy-MM-dd'))
        .lte("summary_date", formatInTimeZone(to, PACIFIC_TZ, 'yyyy-MM-dd'))
        .order("summary_date");

      if (error) throw error;

      // Create a map of existing summaries
      const summaryMap = new Map(
        summaries?.map(s => [s.summary_date, s]) || []
      );

      // Generate all days in range and fill with data or zeros (in Pacific time)
      const days = eachDayOfInterval({ start: from, end: to });
      const dailyData = days.map(day => {
        const dateKey = formatInTimeZone(day, PACIFIC_TZ, 'yyyy-MM-dd');
        const summary = summaryMap.get(dateKey);

        return {
          date: formatInTimeZone(day, PACIFIC_TZ, 'MMM dd'),
          revenue: summary ? Number(summary.total_revenue) : 0,
          units: summary ? summary.units_sold : 0,
        };
      });

      return dailyData;
    },
  });
};
