import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { startOfDay, endOfDay, eachDayOfInterval, format } from "date-fns";

interface SalesTrendData {
  date: string;
  revenue: number;
  units: number;
}

export const useSalesTrend = (from: Date, to: Date) => {
  return useQuery({
    queryKey: ["sales-trend", from.toISOString(), to.toISOString()],
    queryFn: async (): Promise<SalesTrendData[]> => {
      const fromStart = startOfDay(from);
      const toEnd = endOfDay(to);
      const fromISO = new Date(fromStart.getTime() - fromStart.getTimezoneOffset() * 60000).toISOString();
      const toISO = new Date(toEnd.getTime() - toEnd.getTimezoneOffset() * 60000).toISOString();

      // Fetch all orders in date range (UTC-safe bounds)
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id, placed_at, total_amount")
        .gte("placed_at", fromISO)
        .lte("placed_at", toISO)
        .order("placed_at");

      if (ordersError) throw ordersError;

      const orderIds = orders?.map(o => o.id) || [];

      // Fetch line items in chunks to avoid URL length issues
      let lineItems: any[] = [];
      const chunkSize = 100;
      for (let i = 0; i < orderIds.length; i += chunkSize) {
        const chunk = orderIds.slice(i, i + chunkSize);
        const { data, error } = await supabase
          .from("order_line_items")
          .select("order_id, quantity")
          .in("order_id", chunk);

        if (error) throw error;
        if (data) lineItems.push(...data);
      }

      // Group by local day
      const days = eachDayOfInterval({ start: fromStart, end: toEnd });
      const dailyData = days.map(day => {
        const dayStart = startOfDay(day);
        const dayEnd = endOfDay(day);

        const dayOrders = (orders || []).filter(o => {
          const orderDate = new Date(o.placed_at);
          return orderDate >= dayStart && orderDate <= dayEnd;
        });

        const dayOrderIds = new Set(dayOrders.map(o => o.id));
        const dayLineItems = lineItems.filter(item => dayOrderIds.has(item.order_id));

        const revenue = dayOrders.reduce((sum, o) => sum + Number(o.total_amount), 0);
        const units = dayLineItems.reduce((sum, item) => sum + (item.quantity || 0), 0);

        return {
          date: format(day, 'MMM dd'),
          revenue,
          units,
        };
      });

      return dailyData;
    },
  });
};
