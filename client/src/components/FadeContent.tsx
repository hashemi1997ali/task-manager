"use client";

import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useLayoutEffect, useRef, type HTMLAttributes, type ReactNode } from "react";

interface FadeContentProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  container?: Element | string | null;
  blur?: boolean;
  duration?: number;
  ease?: string;
  delay?: number;
  threshold?: number;
  initialOpacity?: number;
  translateY?: number;
  disappearAfter?: number;
  disappearDuration?: number;
  disappearEase?: string;
  onComplete?: () => void;
  onDisappearanceComplete?: () => void;
}

export default function FadeContent({
  children,
  container,
  blur = false,
  duration = 1000,
  ease = "power2.out",
  delay = 0,
  threshold = 0.1,
  initialOpacity = 0,
  translateY = 12,
  disappearAfter = 0,
  disappearDuration = 0.5,
  disappearEase = "power2.in",
  onComplete,
  onDisappearanceComplete,
  className = "",
  ...props
}: FadeContentProps) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      gsap.set(element, {
        autoAlpha: 1,
        filter: "none",
        y: 0,
        clearProps: "willChange,transform",
      });
      onComplete?.();
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

    let scrollerTarget: Element | string | null =
      container ?? document.getElementById("snap-main-container");

    if (typeof scrollerTarget === "string") {
      scrollerTarget = document.querySelector(scrollerTarget);
    }

    const startPercentage = (1 - threshold) * 100;
    const getSeconds = (value: number) => (value > 10 ? value / 1000 : value);

    gsap.set(element, {
      autoAlpha: initialOpacity,
      filter: blur ? "blur(10px)" : "blur(0px)",
      y: translateY,
      willChange: "opacity, filter, transform",
    });

    const timeline = gsap.timeline({
      paused: true,
      delay: getSeconds(delay),
      onComplete: () => {
        gsap.set(element, { clearProps: "willChange" });
        onComplete?.();

        if (disappearAfter > 0) {
          gsap.to(element, {
          autoAlpha: initialOpacity,
          filter: blur ? "blur(10px)" : "blur(0px)",
          y: translateY,
            delay: getSeconds(disappearAfter),
            duration: getSeconds(disappearDuration),
            ease: disappearEase,
            onComplete: onDisappearanceComplete,
          });
        }
      },
    });

    timeline.to(element, {
      autoAlpha: 1,
      filter: "blur(0px)",
      y: 0,
      duration: getSeconds(duration),
      ease,
    });

    const trigger = ScrollTrigger.create({
      trigger: element,
      scroller: scrollerTarget ?? window,
      start: `top ${startPercentage}%`,
      once: true,
      onEnter: () => timeline.play(),
    });

    return () => {
      trigger.kill();
      timeline.kill();
      gsap.killTweensOf(element);
    };
  }, [
    blur,
    container,
    delay,
    disappearAfter,
    disappearDuration,
    disappearEase,
    duration,
    ease,
    initialOpacity,
    onComplete,
    onDisappearanceComplete,
    threshold,
    translateY,
  ]);

  return (
    <div ref={ref} className={className} {...props}>
      {children}
    </div>
  );
}
