"use client";

import { cn } from "@/lib/utils";
import {
  HTMLAttributes,
  ReactNode,
  forwardRef,
  useCallback,
  useEffect,
} from "react";
import { createPortal } from "react-dom";

/* ------------------------------------------------------------------ */
/*  Modal                                                              */
/* ------------------------------------------------------------------ */

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
}

const Modal = ({ open, onClose, children, className }: ModalProps) => {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in-0 duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Content */}
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 w-full max-w-lg mx-4 rounded-xl border border-border bg-surface shadow-xl",
          "animate-in fade-in-0 zoom-in-95 duration-200",
          className
        )}
      >
        {children}
      </div>
    </div>,
    document.body
  );
};
Modal.displayName = "Modal";

/* ------------------------------------------------------------------ */
/*  ModalHeader                                                        */
/* ------------------------------------------------------------------ */

const ModalHeader = forwardRef<
  HTMLDivElement,
  HTMLAttributes<HTMLDivElement> & { onClose?: () => void }
>(({ className, children, onClose, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center justify-between px-6 pt-6 pb-4",
      className
    )}
    {...props}
  >
    <h2 className="text-lg font-semibold text-text-primary">{children}</h2>
    {onClose && (
      <button
        onClick={onClose}
        className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-hover transition-colors"
        aria-label="Close"
      >
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
        >
          <line x1="18" y1="6" x2="6" y2="18" />
          <line x1="6" y1="6" x2="18" y2="18" />
        </svg>
      </button>
    )}
  </div>
));
ModalHeader.displayName = "ModalHeader";

/* ------------------------------------------------------------------ */
/*  ModalBody                                                          */
/* ------------------------------------------------------------------ */

const ModalBody = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("px-6 py-2 text-text-secondary text-sm", className)}
      {...props}
    />
  )
);
ModalBody.displayName = "ModalBody";

/* ------------------------------------------------------------------ */
/*  ModalFooter                                                        */
/* ------------------------------------------------------------------ */

const ModalFooter = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        "flex items-center justify-end gap-3 px-6 pt-4 pb-6",
        className
      )}
      {...props}
    />
  )
);
ModalFooter.displayName = "ModalFooter";

export { Modal, ModalHeader, ModalBody, ModalFooter };
