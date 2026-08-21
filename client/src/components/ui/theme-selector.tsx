import { MonitorCog, Moon, Sun } from "lucide-react";

import { SegmentedControl } from "@/components/ui/segmented-control";
import type { ThemePreference } from "@/lib/preferences";

export function ThemeSelector({
  value,
  onValueChange,
  labels,
  ariaLabel,
  className,
  compact = false,
  iconOnly = false,
}: {
  value: ThemePreference;
  onValueChange: (value: ThemePreference) => void;
  labels: Record<ThemePreference, string>;
  ariaLabel: string;
  className?: string;
  compact?: boolean;
  iconOnly?: boolean;
}) {
  const options = [
    { value: "system" as const, label: labels.system, icon: MonitorCog },
    { value: "light" as const, label: labels.light, icon: Sun },
    { value: "dark" as const, label: labels.dark, icon: Moon },
  ];

  return (
    <SegmentedControl
      value={value}
      onValueChange={onValueChange}
      options={options}
      ariaLabel={ariaLabel}
      className={className}
      compact={compact}
      iconOnly={iconOnly}
    />
  );
}
