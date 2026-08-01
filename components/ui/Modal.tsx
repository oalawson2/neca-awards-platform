"use client";

import type { ReactNode } from "react";

export function Modal({
  open,
  onClose,
  title,
  children,
  width = 340,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  width?: number;
}) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[rgba(26,20,66,0.35)] p-4"
      onClick={onClose}
    >
      <div
        className="w-full bg-white rounded-[20px] shadow-[0_24px_60px_rgba(37,28,91,0.2)] p-7"
        style={{ maxWidth: width }}
        onClick={(e) => e.stopPropagation()}
      >
        {title && <div className="font-heading font-extrabold text-[17px] text-navy mb-4">{title}</div>}
        {children}
      </div>
    </div>
  );
}
