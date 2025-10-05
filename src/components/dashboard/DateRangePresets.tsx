import { Button } from "@/components/ui/button";
import { subDays } from "date-fns";
import { toZonedTime, fromZonedTime } from "date-fns-tz";

interface DateRangePresetsProps {
  onRangeSelect: (from: Date, to: Date) => void;
  currentFrom: Date;
  currentTo: Date;
}

export const DateRangePresets = ({ onRangeSelect, currentFrom, currentTo }: DateRangePresetsProps) => {
  const PACIFIC_TZ = 'America/Los_Angeles';
  
  const getPacificStartOfDay = (date: Date) => {
    const pacificDate = toZonedTime(date, PACIFIC_TZ);
    const year = pacificDate.getFullYear();
    const month = String(pacificDate.getMonth() + 1).padStart(2, '0');
    const day = String(pacificDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}T00:00:00`;
    return fromZonedTime(dateStr, PACIFIC_TZ);
  };

  const getPacificEndOfDay = (date: Date) => {
    const pacificDate = toZonedTime(date, PACIFIC_TZ);
    const year = pacificDate.getFullYear();
    const month = String(pacificDate.getMonth() + 1).padStart(2, '0');
    const day = String(pacificDate.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}T23:59:59.999`;
    return fromZonedTime(dateStr, PACIFIC_TZ);
  };

  const presets = [
    {
      label: "Today",
      getValue: () => ({
        from: getPacificStartOfDay(new Date()),
        to: getPacificEndOfDay(new Date()),
      }),
    },
    {
      label: "Yesterday",
      getValue: () => ({
        from: getPacificStartOfDay(subDays(new Date(), 1)),
        to: getPacificEndOfDay(subDays(new Date(), 1)),
      }),
    },
    {
      label: "Last 7 Days",
      getValue: () => ({
        from: getPacificStartOfDay(subDays(new Date(), 6)),
        to: getPacificEndOfDay(new Date()),
      }),
    },
    {
      label: "Last 14 Days",
      getValue: () => ({
        from: getPacificStartOfDay(subDays(new Date(), 13)),
        to: getPacificEndOfDay(new Date()),
      }),
    },
    {
      label: "Last 30 Days",
      getValue: () => ({
        from: getPacificStartOfDay(subDays(new Date(), 29)),
        to: getPacificEndOfDay(new Date()),
      }),
    },
  ];

  const isActive = (from: Date, to: Date) => {
    return (
      getPacificStartOfDay(from).getTime() === getPacificStartOfDay(currentFrom).getTime() &&
      getPacificStartOfDay(to).getTime() === getPacificStartOfDay(currentTo).getTime()
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
