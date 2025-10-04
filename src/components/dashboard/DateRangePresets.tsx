import { Button } from "@/components/ui/button";
import { subDays, startOfDay, endOfDay } from "date-fns";

interface DateRangePresetsProps {
  onRangeSelect: (from: Date, to: Date) => void;
  currentFrom: Date;
  currentTo: Date;
}

export const DateRangePresets = ({ onRangeSelect, currentFrom, currentTo }: DateRangePresetsProps) => {
  const presets = [
    {
      label: "Today",
      getValue: () => ({
        from: startOfDay(new Date()),
        to: endOfDay(new Date()),
      }),
    },
    {
      label: "Yesterday",
      getValue: () => ({
        from: startOfDay(subDays(new Date(), 1)),
        to: endOfDay(subDays(new Date(), 1)),
      }),
    },
    {
      label: "Last 7 Days",
      getValue: () => ({
        from: startOfDay(subDays(new Date(), 6)),
        to: endOfDay(new Date()),
      }),
    },
    {
      label: "Last 14 Days",
      getValue: () => ({
        from: startOfDay(subDays(new Date(), 13)),
        to: endOfDay(new Date()),
      }),
    },
    {
      label: "Last 30 Days",
      getValue: () => ({
        from: startOfDay(subDays(new Date(), 29)),
        to: endOfDay(new Date()),
      }),
    },
  ];

  const isActive = (from: Date, to: Date) => {
    return (
      startOfDay(from).getTime() === startOfDay(currentFrom).getTime() &&
      startOfDay(to).getTime() === startOfDay(currentTo).getTime()
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
