"use client";

import { useId, type InputHTMLAttributes, type ReactNode } from "react";

import { Spinner } from "@/components/ui/spinner";
import { cn, FOCUS, INPUT } from "@/lib/ui";

interface InputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "id"> {
  label: string;
  hideLabel?: boolean;
  hint?: ReactNode;
  error?: string | null;
  /** Something beside the field, like a Copy or Create button. */
  action?: ReactNode;
}

/** A labelled text field with its hint and error wired to aria-describedby. */
export function Input({ label, hideLabel, hint, error, action, className, ...rest }: InputProps) {
  const id = useId();
  const described = [hint && `${id}-hint`, error && `${id}-error`].filter(Boolean).join(" ") || undefined;
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={cn("text-sm text-silver-dim", hideLabel && "sr-only")}>
        {label}
      </label>
      <div className="flex gap-2">
        <input
          id={id}
          aria-describedby={described}
          aria-invalid={error ? true : undefined}
          className={cn(INPUT, className)}
          {...rest}
        />
        {action}
      </div>
      {hint && (
        <p id={`${id}-hint`} className="text-xs text-silver-dim">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-sm text-red-300">
          {error}
        </p>
      )}
    </div>
  );
}

interface SearchInputProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  busy?: boolean;
}

/** A search field with a magnifier, a spinner while busy, and a clear button once there's text. */
export function SearchInput({ label, value, onChange, placeholder, maxLength, busy }: SearchInputProps) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-sm text-silver-dim">
        {label}
      </label>
      <div className="relative">
        <svg
          viewBox="0 0 20 20"
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3 size-4.5 -translate-y-1/2 text-silver-dim"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
        >
          <circle cx="9" cy="9" r="5.5" />
          <path d="m13.2 13.2 3.8 3.8" />
        </svg>
        <input
          id={id}
          type="search"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete="off"
          className={cn(INPUT, "pr-11 pl-10 [&::-webkit-search-cancel-button]:hidden")}
        />
        {busy ? (
          <Spinner className="absolute top-1/2 right-3.5 -translate-y-1/2" />
        ) : (
          value && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => onChange("")}
              className={cn(
                "absolute top-1/2 right-0.5 flex size-10 -translate-y-1/2 items-center justify-center rounded-md text-silver-dim hover:text-pearl active:text-silver",
                FOCUS,
              )}
            >
              <svg viewBox="0 0 16 16" aria-hidden="true" className="size-4" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
                <path d="m4.5 4.5 7 7m0-7-7 7" />
              </svg>
            </button>
          )
        )}
      </div>
    </div>
  );
}

interface ToggleProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
  hint?: string;
}

/** An on/off switch, for settings that apply as soon as they flip. */
export function Toggle({ label, checked, onChange, disabled, hint }: ToggleProps) {
  const id = useId();
  return (
    <div className="flex min-h-11 items-center justify-between gap-4">
      <span className="flex flex-col">
        <span id={`${id}-label`} className="text-sm text-pearl">
          {label}
        </span>
        {hint && (
          <span id={`${id}-hint`} className="text-xs text-silver-dim">
            {hint}
          </span>
        )}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-labelledby={`${id}-label`}
        aria-describedby={hint ? `${id}-hint` : undefined}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={cn(
          "group relative flex h-11 w-14 shrink-0 items-center disabled:cursor-not-allowed disabled:opacity-50",
          FOCUS,
          "rounded-full",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "h-7 w-full rounded-full border transition-colors duration-200",
            checked ? "border-gold-deep bg-gold/85" : "border-silver/25 bg-ink group-hover:border-silver/45",
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            "absolute left-1 size-5 rounded-full shadow transition-transform duration-200 ease-[cubic-bezier(0.2,0.8,0.3,1)]",
            checked ? "translate-x-7 bg-pearl" : "translate-x-0 bg-silver-dim",
          )}
        />
      </button>
    </div>
  );
}
