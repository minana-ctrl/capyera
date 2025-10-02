import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isToday, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, Maximize2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface StockoutEvent {
  date: Date;
  products: Array<{
    sku: string;
    name: string;
    available: number;
    status: "critical" | "warning" | "healthy";
  }>;
}

interface StockRunwayCalendarProps {
  stockoutEvents: StockoutEvent[];
  onDateSelect?: (date: Date) => void;
  selectedDate?: Date;
}

export const StockRunwayCalendar = ({
  stockoutEvents,
  onDateSelect,
  selectedDate,
}: StockRunwayCalendarProps) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [isFullscreen, setIsFullscreen] = useState(false);

  const nextMonth = addMonths(currentMonth, 1);

  const handlePrevMonth = () => setCurrentMonth(subMonths(currentMonth, 1));
  const handleNextMonth = () => setCurrentMonth(addMonths(currentMonth, 1));
  const handleToday = () => setCurrentMonth(new Date());

  const getStockoutForDate = (date: Date) => {
    return stockoutEvents.find((event) => isSameDay(event.date, date));
  };

  const getDayColor = (date: Date) => {
    const stockout = getStockoutForDate(date);
    if (!stockout) return "";

    const criticalCount = stockout.products.filter((p) => p.status === "critical").length;
    const warningCount = stockout.products.filter((p) => p.status === "warning").length;

    if (criticalCount > 0) return "bg-destructive/20 hover:bg-destructive/30";
    if (warningCount > 0) return "bg-orange-500/20 hover:bg-orange-500/30";
    return "bg-green-500/20 hover:bg-green-500/30";
  };

  const renderMonth = (month: Date) => {
    const monthStart = startOfMonth(month);
    const monthEnd = endOfMonth(month);
    const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

    // Get the day of week for the first day (0 = Sunday, 1 = Monday, etc.)
    const firstDayOfWeek = monthStart.getDay();
    const emptyDays = Array(firstDayOfWeek).fill(null);

    return (
      <div className="flex-1">
        <h3 className="text-lg font-semibold mb-4 text-center">
          {format(month, "MMMM yyyy")}
        </h3>
        <div className="grid grid-cols-7 gap-1">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
            <div
              key={day}
              className="text-center text-xs font-medium text-muted-foreground py-2"
            >
              {day}
            </div>
          ))}
          {emptyDays.map((_, index) => (
            <div key={`empty-${index}`} className="aspect-square" />
          ))}
          {days.map((day) => {
            const stockout = getStockoutForDate(day);
            const isSelected = selectedDate && isSameDay(day, selectedDate);
            const dayColor = getDayColor(day);

            return (
              <button
                key={day.toISOString()}
                onClick={() => onDateSelect?.(day)}
                className={cn(
                  "aspect-square p-2 text-sm rounded-lg transition-all relative",
                  "hover:ring-2 hover:ring-ring hover:ring-offset-1",
                  dayColor || "hover:bg-accent",
                  isSelected && "ring-2 ring-primary",
                  isToday(day) && "font-bold"
                )}
              >
                <div className="flex flex-col items-center justify-center h-full">
                  <span className={cn(isToday(day) && "text-primary")}>
                    {format(day, "d")}
                  </span>
                  {stockout && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1 py-0 mt-1"
                    >
                      {stockout.products.length} SKUs
                    </Badge>
                  )}
                </div>
                {isToday(day) && (
                  <div className="absolute bottom-1 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full bg-primary" />
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <Card className={cn(isFullscreen && "fixed inset-4 z-50 overflow-auto")}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle>Stock Runway Calendar</CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleToday}>
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            <Maximize2 className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between mb-4">
            <Button variant="outline" size="icon" onClick={handlePrevMonth}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="icon" onClick={handleNextMonth}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex gap-4 flex-col lg:flex-row">
            {renderMonth(currentMonth)}
            {renderMonth(nextMonth)}
          </div>

          <div className="flex items-center justify-center gap-6 pt-4 border-t">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-destructive/20 border border-destructive" />
              <span className="text-sm">Critical</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-orange-500/20 border border-orange-500" />
              <span className="text-sm">Warning</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-500/20 border border-green-500" />
              <span className="text-sm">Healthy</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
