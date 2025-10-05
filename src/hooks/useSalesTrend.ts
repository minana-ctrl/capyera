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
      
      // Fetch raw orders within Pacific "from" and "to" boundaries (converted to UTC dates)
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, placed_at, total_amount")
        .gte("placed_at", from.toISOString())
        .lte("placed_at", to.toISOString());

      if (ordersError) throw ordersError;

      // Seed all days
      const days = eachDayOfInterval({ start: from, end: to });
      const revenueByDay = new Map<string, number>();
      const unitsByDay = new Map<string, number>();
      days.forEach((day) => {
        const k = formatInTimeZone(day, PACIFIC_TZ, 'yyyy-MM-dd');
        revenueByDay.set(k, 0);
        unitsByDay.set(k, 0);
      });

      // Revenue per day from orders
      orders?.forEach((o) => {
        const k = formatInTimeZone(new Date(o.placed_at), PACIFIC_TZ, 'yyyy-MM-dd');
        revenueByDay.set(k, (revenueByDay.get(k) || 0) + Number(o.total_amount || 0));
      });

      // Units per day via line items
      const orderIds = (orders || []).map((o) => o.id);
      if (orderIds.length) {
        const chunkSize = 100;
        const chunks = Array.from({ length: Math.ceil(orderIds.length / chunkSize) }, (_, i) =>
          orderIds.slice(i * chunkSize, (i + 1) * chunkSize)
        );
        const results = await Promise.all(
          chunks.map(async (ids) => {
            const { data, error } = await supabase
              .from('order_line_items')
              .select('order_id, quantity')
              .in('order_id', ids);
            if (error) throw error;
            return data || [];
          })
        );
        const lineItems = results.flat();
        const placedAtByOrder = new Map<string, string>();
        orders?.forEach((o) => placedAtByOrder.set(o.id, o.placed_at));
        lineItems.forEach((li) => {
          const placedAt = placedAtByOrder.get(li.order_id);
          if (!placedAt) return;
          const k = formatInTimeZone(new Date(placedAt), PACIFIC_TZ, 'yyyy-MM-dd');
          unitsByDay.set(k, (unitsByDay.get(k) || 0) + (li.quantity || 0));
        });
      }

      const dailyData = days.map((day) => {
        const k = formatInTimeZone(day, PACIFIC_TZ, 'yyyy-MM-dd');
        return {
          date: formatInTimeZone(day, PACIFIC_TZ, 'MMM dd'),
          revenue: revenueByDay.get(k) || 0,
          units: unitsByDay.get(k) || 0,
        };
      });

      return dailyData;
    },
  });
};
