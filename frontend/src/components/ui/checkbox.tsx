"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import { forwardRef, type InputHTMLAttributes } from "react";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "checked"> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

/**
 * Lightweight checkbox (no Radix dependency). `onCheckedChange` mirrors the
 * Radix-style API so it can be swapped later if the project adds
 * `@radix-ui/react-checkbox`.
 */
const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, checked, onCheckedChange, onChange, ...props }, ref) => {
    return (
      <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
        <input
          ref={ref}
          type="checkbox"
          checked={checked}
          onChange={(e) => {
            onChange?.(e);
            onCheckedChange?.(e.target.checked);
          }}
          className={cn(
            "peer h-4 w-4 shrink-0 cursor-pointer appearance-none rounded-sm border border-input shadow-sm transition-colors",
            "checked:border-primary checked:bg-primary",
            "focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
            "disabled:cursor-not-allowed disabled:opacity-50",
            className,
          )}
          {...props}
        />
        {checked && (
          <Check className="pointer-events-none absolute h-3.5 w-3.5 text-primary-foreground" strokeWidth={3} />
        )}
      </span>
    );
  },
);
Checkbox.displayName = "Checkbox";

export { Checkbox };
