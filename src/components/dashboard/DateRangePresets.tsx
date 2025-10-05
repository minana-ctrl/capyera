import { Button } from "@/components/ui/button";
import { subDays } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

interface DateRangePresetsProps {
  onRangeSelect: (from: Date, to: Date) => void;
  currentFrom: Date;
  currentTo: Date;
}

export const DateRangePresets = ({ onRangeSelect, currentFrom, currentTo }: DateRangePresetsProps) => {
  const UTC = 'UTC';
  
  const getUTCStartOfDay = (date: Date) => {
    const zonedDate = toZonedTime(date, UTC);
    zonedDate.setUTCHours(0, 0, 0, 0);
    return fromZonedTime(zonedDate, UTC);
  };

  const getUTCEndOfDay = (date: Date) => {
    const zonedDate = toZonedTime(date, UTC);
    zonedDate.setUTCHours(23, 59, 59, 999);
    return fromZonedTime(zonedDate, UTC);
  };

  const presets = [
    {
      label: "Today",
      getValue: () => ({
        from: getUTCStartOfDay(new Date()),
        to: getUTCEndOfDay(new Date()),
      }),
    },
    {
      label: "Yesterday",
      getValue: () => ({
        from: getUTCStartOfDay(subDays(new Date(), 1)),
        to: getUTCEndOfDay(subDays(new Date(), 1)),
      }),
    },
    {
      label: "Last 7 Days",
      getValue: () => ({
        from: getUTCStartOfDay(subDays(new Date(), 6)),
        to: getUTCEndOfDay(new Date()),
      }),
    },
    {
      label: "Last 14 Days",
      getValue: () => ({
        from: getUTCStartOfDay(subDays(new Date(), 13)),
        to: getUTCEndOfDay(new Date()),
      }),
    },
    {
      label: "Last 30 Days",
      getValue: () => ({
        from: getUTCStartOfDay(subDays(new Date(), 29)),
        to: getUTCEndOfDay(new Date()),
      }),
    },
  ];

  const isActive = (from: Date, to: Date) => {
    return (
      getUTCStartOfDay(from).getTime() === getUTCStartOfDay(currentFrom).getTime() &&
      getUTCStartOfDay(to).getTime() === getUTCStartOfDay(currentTo).getTime()
    );
  };

  return (
    <div className="flex flex-wrap gap-2">
      {presets.map((preset) => {
        const { from, to } = preset.getValue();
        const active = isActive(from, to);
        
        return (
          <Button
            key={preset.label}
            variant={active ? "default" : "outline"}
            size="sm"
            onClick={() => onRangeSelect(from, to)}
          >
            {preset.label}
          </Button>
        );
      })}
    </div>
  );
};
