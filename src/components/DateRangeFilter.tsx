import { useState } from "react";
import { Button } from "./ui/button";
import { Calendar } from "./ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "./ui/popover";
import { CalendarIcon } from "lucide-react";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { getPacificStartOfDay, getPacificEndOfDay } from "@/lib/timezones";

interface DateRangeFilterProps {
  onDateChange: (from: Date, to: Date) => void;
}

export function DateRangeFilter({ onDateChange }: DateRangeFilterProps) {

  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: getPacificStartOfDay(subDays(new Date(), 30)),
    to: getPacificEndOfDay(new Date()),
  });

  const presets = [
    { label: "Today", days: 0 },
    { label: "Yesterday", days: 1 },
    { label: "Last 7 Days", days: 7 },
    { label: "Last 14 Days", days: 14 },
    { label: "Last 30 Days", days: 30 },
  ];

  const handlePresetClick = (days: number) => {
    const now = new Date();
    if (days === 0) {
      // Today (Pacific)
      const from = getPacificStartOfDay(now);
      const to = getPacificEndOfDay(now);
      setDateRange({ from, to });
      onDateChange(from, to);
      return;
    }
    if (days === 1) {
      // Yesterday (single day, Pacific)
      const yesterday = subDays(now, 1);
      const from = getPacificStartOfDay(yesterday);
      const to = getPacificEndOfDay(yesterday);
      setDateRange({ from, to });
      onDateChange(from, to);
      return;
    }
    // Last N days = today and previous (N-1) days (Pacific)
    const to = getPacificEndOfDay(now);
    const from = getPacificStartOfDay(subDays(now, days - 1));
    setDateRange({ from, to });
    onDateChange(from, to);
  };
  return (
    <div className="flex gap-2 flex-wrap items-center">
      <div className="flex gap-2">
        {presets.map((preset) => (
          <Button
            key={preset.label}
            variant="outline"
            size="sm"
            onClick={() => handlePresetClick(preset.days)}
          >
            {preset.label}
          </Button>
        ))}
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            className={cn(
              "justify-start text-left font-normal",
              !dateRange && "text-muted-foreground"
            )}
          >
            <CalendarIcon className="mr-2 h-4 w-4" />
            {dateRange?.from ? (
              dateRange.to ? (
                <>
                  {format(dateRange.from, "LLL dd")} - {format(dateRange.to, "LLL dd, y")}
                </>
              ) : (
                format(dateRange.from, "LLL dd, y")
              )
            ) : (
              <span>Custom Range</span>
            )}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="range"
            selected={dateRange}
            onSelect={(range: any) => {
              if (!range) return;
              const from = range.from ? getPacificStartOfDay(range.from) : null;
              const to = range.to ? getPacificEndOfDay(range.to) : (from ? getPacificEndOfDay(range.from) : null);
              if (from && to) {
                const updated = { from, to };
                setDateRange(updated);
                onDateChange(from, to);
              }
            }}
            numberOfMonths={2}
            initialFocus
            className={cn("p-3 pointer-events-auto")}
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
