"use client";

import { useRef, useState, type HTMLAttributes } from "react";

import { cn } from "@/lib/utils";

export interface SpotlightCardProps extends HTMLAttributes<HTMLDivElement> {
  spotlightColor?: string;
}

export default function SpotlightCard({
  children,
  className,
  spotlightColor = "color-mix(in srgb, var(--primary) 18%, transparent)",
  style,
  ...props
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [visible, setVisible] = useState(false);

  return (
    <div
      ref={ref}
      className={cn("relative isolate overflow-hidden", className)}
      style={{
        ...style,
        backgroundImage: visible
          ? `radial-gradient(320px circle at ${position.x}px ${position.y}px, ${spotlightColor}, transparent 72%)`
          : undefined,
      }}
      onPointerMove={(event) => {
        const element = ref.current;
        if (!element || event.pointerType === "touch") return;
        const rect = element.getBoundingClientRect();
        setPosition({ x: event.clientX - rect.left, y: event.clientY - rect.top });
      }}
      onPointerEnter={(event) => {
        if (
          event.pointerType !== "touch" &&
          !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ) {
          setVisible(true);
        }
      }}
      onPointerLeave={() => setVisible(false)}
      onFocusCapture={() => {
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
        const element = ref.current;
        if (element) {
          setPosition({ x: element.clientWidth / 2, y: element.clientHeight / 2 });
        }
        setVisible(true);
      }}
      onBlurCapture={() => setVisible(false)}
      {...props}
    >
      {children}
    </div>
  );
}
