"use client";

import { cn } from "@/lib/utils";
import {
  ReactNode,
  forwardRef,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface SelectOption {
  value: string;
  label: string;
  icon?: ReactNode;
  disabled?: boolean;
}

interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange?: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

/* ------------------------------------------------------------------ */
/*  Select                                                             */
/* ------------------------------------------------------------------ */

const Select = forwardRef<HTMLDivElement, SelectProps>(
  (
    {
      options,
      value,
      onChange,
      placeholder = "Select...",
      disabled = false,
      className,
    },
    ref
  ) => {
    const [open, setOpen] = useState(false);
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<HTMLUListElement>(null);

    const selectedOption = options.find((o) => o.value === value);

    /* Close on outside click */
    useEffect(() => {
      const handler = (e: MouseEvent) => {
        if (
          containerRef.current &&
          !containerRef.current.contains(e.target as Node)
        ) {
          setOpen(false);
        }
      };
      document.addEventListener("mousedown", handler);
      return () => document.removeEventListener("mousedown", handler);
    }, []);

    /* Scroll focused item into view */
    useEffect(() => {
      if (open && focusedIndex >= 0 && listRef.current) {
        const items = listRef.current.querySelectorAll("[data-option]");
        items[focusedIndex]?.scrollIntoView({ block: "nearest" });
      }
    }, [focusedIndex, open]);

    const selectOption = useCallback(
      (opt: SelectOption) => {
        if (opt.disabled) return;
        onChange?.(opt.value);
        setOpen(false);
      },
      [onChange]
    );

    const handleKeyDown = useCallback(
      (e: React.KeyboardEvent) => {
        if (disabled) return;

        switch (e.key) {
          case "Enter":
          case " ": {
            e.preventDefault();
            if (!open) {
              setOpen(true);
              setFocusedIndex(
                options.findIndex((o) => o.value === value)
              );
            } else if (focusedIndex >= 0) {
              selectOption(options[focusedIndex]);
            }
            break;
          }
          case "ArrowDown": {
            e.preventDefault();
            if (!open) {
              setOpen(true);
              setFocusedIndex(0);
            } else {
              setFocusedIndex((prev) =>
                prev < options.length - 1 ? prev + 1 : 0
              );
            }
            break;
          }
          case "ArrowUp": {
            e.preventDefault();
            if (open) {
              setFocusedIndex((prev) =>
                prev > 0 ? prev - 1 : options.length - 1
              );
            }
            break;
          }
          case "Escape": {
            setOpen(false);
            break;
          }
          case "Tab": {
            setOpen(false);
            break;
          }
        }
      },
      [disabled, open, focusedIndex, options, value, selectOption]
    );

    return (
      <div
        ref={(node) => {
          (containerRef as React.MutableRefObject<HTMLDivElement | null>).current =
            node;
          if (typeof ref === "function") ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        className={cn("relative w-full", className)}
        onKeyDown={handleKeyDown}
      >
        {/* Trigger */}
        <button
          type="button"
          role="combobox"
          aria-expanded={open}
          aria-haspopup="listbox"
          disabled={disabled}
          onClick={() => !disabled && setOpen((prev) => !prev)}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-lg border border-border bg-surface px-3 py-2 text-sm transition-colors",
            "focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent",
            "disabled:opacity-50 disabled:pointer-events-none",
            open && "border-accent ring-1 ring-accent",
            selectedOption ? "text-text-primary" : "text-text-muted"
          )}
        >
          <span className="flex items-center gap-2 truncate">
            {selectedOption?.icon}
            {selectedOption?.label ?? placeholder}
          </span>

          {/* Chevron */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className={cn(
              "shrink-0 text-text-muted transition-transform duration-200",
              open && "rotate-180"
            )}
          >
            <polyline points="6 9 12 15 18 9" />
          </svg>
        </button>

        {/* Dropdown */}
        {open && (
          <ul
            ref={listRef}
            role="listbox"
            className={cn(
              "absolute z-50 mt-1 w-full max-h-60 overflow-auto rounded-lg border border-border bg-surface py-1 shadow-lg",
              "animate-in fade-in-0 zoom-in-95 duration-150"
            )}
          >
            {options.map((option, idx) => (
              <li
                key={option.value}
                role="option"
                data-option
                aria-selected={option.value === value}
                aria-disabled={option.disabled}
                onClick={() => selectOption(option)}
                onMouseEnter={() => setFocusedIndex(idx)}
                className={cn(
                  "flex items-center gap-2 px-3 py-2 text-sm cursor-pointer transition-colors",
                  option.value === value
                    ? "text-accent bg-accent/10"
                    : "text-text-primary",
                  focusedIndex === idx && "bg-surface-hover",
                  option.disabled &&
                    "opacity-50 pointer-events-none text-text-muted"
                )}
              >
                {option.icon}
                {option.label}
                {option.value === value && (
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="ml-auto shrink-0"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
);
Select.displayName = "Select";

export { Select };
