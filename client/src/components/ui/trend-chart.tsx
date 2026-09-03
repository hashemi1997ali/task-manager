"use client";

import { useEffect, useRef, useState } from "react";

export interface TrendChartPoint {
  key: string;
  value: number;
  shortLabel?: string;
  accessibleLabel: string;
}

export function TrendChart({
  data,
  label,
  className = "h-52",
  showLabels = true,
}: {
  data: TrendChartPoint[];
  label: string;
  className?: string;
  showLabels?: boolean;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [{ width, height }, setChartSize] = useState({ width: 520, height: 220 });

  useEffect(() => {
    const element = svgRef.current;

    if (!element || typeof ResizeObserver === "undefined") {
      return;
    }

    const observer = new ResizeObserver(([entry]) => {
      if (!entry) {
        return;
      }

      const nextWidth = Math.round(entry.contentRect.width);
      const nextHeight = Math.round(entry.contentRect.height);

      if (nextWidth <= 0 || nextHeight <= 0) {
        return;
      }

      setChartSize((current) =>
        current.width === nextWidth && current.height === nextHeight
          ? current
          : { width: nextWidth, height: nextHeight },
      );
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const leftPadding = 38;
  const rightPadding = 24;
  const topPadding = 18;
  const bottomPadding = showLabels ? 36 : 18;
  const maxValue = Math.max(0, ...data.map((item) => item.value));
  const axisMax = Math.max(2, Math.ceil(maxValue / 2) * 2);
  const baseline = height - bottomPadding;
  const chartHeight = baseline - topPadding;
  const ticks = [axisMax, axisMax / 2, 0];
  const points = data.map((item, index) => ({
    ...item,
    x:
      leftPadding +
      (index * (width - leftPadding - rightPadding)) / Math.max(data.length - 1, 1),
    y: baseline - (item.value / axisMax) * chartHeight,
  }));
  const path = points.map((point) => `${point.x},${point.y}`).join(" ");
  const areaPath = points.length
    ? `${points[0]?.x},${baseline} ${path} ${points.at(-1)?.x},${baseline}`
    : "";

  return (
    <div className="w-full min-w-0">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${width} ${height}`}
        className={`${className} w-full`}
        role="img"
        aria-label={label}
      >
        {ticks.map((tick) => {
          const y = baseline - (tick / axisMax) * chartHeight;
          return (
            <g key={tick} aria-hidden="true">
              <line
                x1={leftPadding}
                x2={width - rightPadding}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeDasharray={tick === 0 ? undefined : "4 6"}
              />
              <text
                x={leftPadding - 10}
                y={y + 4}
                textAnchor="end"
                fontSize="10"
                fontWeight="600"
                fill="var(--muted)"
              >
                {tick}
              </text>
            </g>
          );
        })}
        {areaPath ? (
          <polygon
            points={areaPath}
            fill="var(--primary)"
            fillOpacity="0.09"
            aria-hidden="true"
          />
        ) : null}
        <polyline
          points={path}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {points.map((point) => (
          <g key={point.key}>
            <circle
              cx={point.x}
              cy={point.y}
              r="5"
              fill="var(--surface)"
              stroke="var(--primary)"
              strokeWidth="3"
            >
              <title>{point.accessibleLabel}</title>
            </circle>
            {showLabels && (
              <text
                x={point.x}
                y={height - 8}
                textAnchor="middle"
                fontSize="11"
                fontWeight="600"
                fill="var(--muted)"
              >
                {point.shortLabel}
              </text>
            )}
          </g>
        ))}
      </svg>
      <ul className="sr-only">
        {data.map((item) => (
          <li key={item.key}>{item.accessibleLabel}</li>
        ))}
      </ul>
    </div>
  );
}
