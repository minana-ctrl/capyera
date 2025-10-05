import { Button } from "@/components/ui/button";
import { subDays } from "date-fns";
import { getPacificStartOfDay, getPacificEndOfDay } from "@/lib/timezones";

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
