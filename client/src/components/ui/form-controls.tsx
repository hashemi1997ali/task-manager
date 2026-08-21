import {
  createContext,
  forwardRef,
  useContext,
  useId,
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from "react";
import { CircleAlert } from "lucide-react";

import { cn } from "@/lib/utils";

const fieldClass =
  "focus-ring block w-full rounded-xl border border-[color-mix(in_srgb,var(--foreground)_6%,transparent)] bg-[var(--surface)] px-3.5 text-base text-[var(--foreground)] shadow-sm placeholder:text-[var(--muted)] focus:border-[var(--primary)] disabled:cursor-not-allowed disabled:bg-[var(--surface-muted)] sm:text-sm";
const invalidFieldClass =
  "border-rose-400 focus:border-rose-500 focus:shadow-[0_0_0_3px_rgba(244,63,94,.12)] dark:border-rose-400/80";

interface FieldContextValue {
  controlId: string;
  descriptionId?: string;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    const field = useContext(FieldContext);
    return (
      <input
        ref={ref}
        className={cn(fieldClass, "h-11", field?.invalid && invalidFieldClass, className)}
        {...props}
        id={props.id ?? field?.controlId}
        aria-describedby={props["aria-describedby"] ?? field?.descriptionId}
        aria-invalid={props["aria-invalid"] ?? (field?.invalid || undefined)}
      />
    );
  },
);

export const Textarea = forwardRef<
  HTMLTextAreaElement,
  TextareaHTMLAttributes<HTMLTextAreaElement>
>(function Textarea({ className, ...props }, ref) {
  const field = useContext(FieldContext);
  return (
    <textarea
      ref={ref}
      className={cn(
        fieldClass,
        "min-h-28 resize-y py-3",
        field?.invalid && invalidFieldClass,
        className,
      )}
      {...props}
      id={props.id ?? field?.controlId}
      aria-describedby={props["aria-describedby"] ?? field?.descriptionId}
      aria-invalid={props["aria-invalid"] ?? (field?.invalid || undefined)}
    />
  );
});

export const Select = forwardRef<
  HTMLSelectElement,
  SelectHTMLAttributes<HTMLSelectElement>
>(function Select({ className, ...props }, ref) {
  const field = useContext(FieldContext);
  return (
    <select
      ref={ref}
      className={cn(fieldClass, "h-11", field?.invalid && invalidFieldClass, className)}
      {...props}
      id={props.id ?? field?.controlId}
      aria-describedby={props["aria-describedby"] ?? field?.descriptionId}
      aria-invalid={props["aria-invalid"] ?? (field?.invalid || undefined)}
    />
  );
});

export function Field({
  label,
  error,
  hint,
  controlId,
  compact = false,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  controlId?: string;
  compact?: boolean;
  children: React.ReactNode;
}) {
  const generatedId = useId();
  const resolvedControlId = controlId ?? generatedId;
  const descriptionId = error || hint ? `${resolvedControlId}-description` : undefined;

  return (
    <div
      className={cn(
        "grid gap-1 text-sm font-medium text-[var(--foreground)]",
        compact ? null : "pb-1",
      )}
    >
      <label
        htmlFor={resolvedControlId}
        className={cn("transition-colors", error && "text-rose-600 dark:text-rose-300")}
      >
        {label}
      </label>
      <FieldContext.Provider
        value={{
          controlId: resolvedControlId,
          descriptionId,
          invalid: Boolean(error),
        }}
      >
        <div className="relative">{children}</div>
      </FieldContext.Provider>
      <div className={cn("px-1", compact ? "min-h-0" : "min-h-5")}>
        {error ? (
          <span
            id={descriptionId}
            className="flex items-start gap-1 text-xs leading-5 font-medium text-rose-700 dark:text-rose-300"
            role="alert"
            title={error}
          >
            <CircleAlert className="size-3 shrink-0" aria-hidden="true" />
            <span>{error}</span>
          </span>
        ) : hint ? (
          <span
            id={descriptionId}
            className="block text-xs leading-5 font-normal text-[var(--muted)]"
          >
            {hint}
          </span>
        ) : null}
      </div>
    </div>
  );
}
