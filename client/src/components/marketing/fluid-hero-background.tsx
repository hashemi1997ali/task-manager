"use client";

import { useEffect, useState } from "react";

import LiquidEther from "@/components/LiquidEther";
import { usePreferences } from "@/providers/preferences-provider";

const lightColors = ["#2B2479", "#5146B8", "#7165E3", "#AAA1FF", "#FFFFFF"];
const darkColors = ["#4E43C3", "#7165E3", "#9C92FF", "#C8C2FF", "#FFFFFF"];

export function FluidHeroBackground() {
  const { resolvedTheme } = usePreferences();
  const [reduceMotion, setReduceMotion] = useState(false);
  const isDark = resolvedTheme === "dark";

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    update();
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return (
    <div
      className="pointer-events-none absolute inset-0 overflow-hidden"
      aria-hidden="true"
    >
      <div
        className="absolute inset-0"
        style={{
          background: isDark
            ? "linear-gradient(180deg, #0a0a0a 0%, #151329 30%, #2c285d 56%, #16152a 79%, var(--background) 100%)"
            : "linear-gradient(180deg, #ffffff 0%, #f7f7ff 24%, #dfe2fa 45%, #8793d0 66%, #eef0fb 86%, var(--background) 100%)",
        }}
      />
      <div className={isDark ? "absolute inset-0 opacity-95 mix-blend-screen blur-[0.5px]" : "absolute inset-0 opacity-90 mix-blend-multiply blur-[0.5px]"}>
        <LiquidEther
          colors={isDark ? darkColors : lightColors}
          mouseForce={20}
          cursorSize={108}
          resolution={0.42}
          iterationsPoisson={24}
          iterationsViscous={24}
          autoDemo={!reduceMotion}
          autoSpeed={0.45}
          autoIntensity={2.2}
          takeoverDuration={0.28}
          autoResumeDelay={1400}
          autoRampDuration={0.8}
          className="h-full w-full"
        />
      </div>
      <div
        className="absolute inset-x-0 bottom-0 h-[32%]"
        style={{
          background:
            "linear-gradient(180deg, transparent 0%, color-mix(in srgb, var(--background) 22%, transparent) 35%, var(--background) 100%)",
        }}
      />
      <div className="soft-noise absolute inset-0 opacity-[0.02]" />
    </div>
  );
}
