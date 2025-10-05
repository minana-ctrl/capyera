import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, Calendar } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { DateRangePresets } from "./DateRangePresets";
import { DateRangeFilter } from "@/components/DateRangeFilter";
import { useSalesTrend } from "@/hooks/useSalesTrend";
import { subDays } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

export const SalesTrendCard = () => {
  const PACIFIC_TZ = 'America/Los_Angeles';
  
  const getPacificStartOfDay = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}T00:00:00`;
    return fromZonedTime(dateStr, PACIFIC_TZ);
  };

  const getPacificEndOfDay = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}T23:59:59.999`;
    return fromZonedTime(dateStr, PACIFIC_TZ);
  };

  const [dateRange, setDateRange] = useState({
    from: getPacificStartOfDay(subDays(new Date(), 29)),
    to: getPacificEndOfDay(new Date()),
  });
  const [chartMetric, setChartMetric] = useState<'revenue' | 'units'>('revenue');

  const { data: salesTrend, isLoading } = useSalesTrend(dateRange.from, dateRange.to);

  const handlePresetSelect = (from: Date, to: Date) => {
    setDateRange({ from, to });
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div className="space-y-2">
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Sales Trend
            </CardTitle>
            <DateRangePresets
              onRangeSelect={handlePresetSelect}
              currentFrom={dateRange.from}
              currentTo={dateRange.to}
            />
          </div>
          <div className="flex items-center gap-4">
            <Tabs value={chartMetric} onValueChange={(v) => setChartMetric(v as 'revenue' | 'units')}>
              <TabsList>
                <TabsTrigger value="revenue">Revenue</TabsTrigger>
                <TabsTrigger value="units">Units Sold</TabsTrigger>
              </TabsList>
            </Tabs>
            <DateRangeFilter onDateChange={(from, to) => setDateRange({ from, to })} />
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-[350px] w-full" />
        ) : !salesTrend || salesTrend.length === 0 ? (
          <div className="h-[350px] flex items-center justify-center text-muted-foreground">
            No sales data available for selected period
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={350}>
            <LineChart data={salesTrend}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis 
                dataKey="date" 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
              />
              <YAxis 
                className="text-xs"
                tick={{ fill: 'hsl(var(--muted-foreground))' }}
                tickFormatter={(value) => 
                  chartMetric === 'revenue' ? `$${value.toFixed(0)}` : value
                }
              />
              <Tooltip 
                contentStyle={{ 
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: '6px'
                }}
                formatter={(value: number) => 
                  chartMetric === 'revenue' ? `$${value.toFixed(2)}` : value
                }
              />
              <Legend />
              <Line 
                type="monotone" 
                dataKey={chartMetric} 
                name={chartMetric === 'revenue' ? 'Revenue' : 'Units Sold'}
                stroke="hsl(var(--primary))" 
                strokeWidth={2}
                dot={{ fill: 'hsl(var(--primary))' }}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  );
};
