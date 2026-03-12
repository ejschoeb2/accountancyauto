'use client';

import { useRef, useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp } from 'lucide-react';
import type { MonthlyWorkload } from '@/lib/dashboard/forecast';

interface WorkloadForecastProps {
  data: MonthlyWorkload[];
}

/**
 * Attempt to produce a smooth cubic-bezier path through points.
 * Falls back to a polyline if fewer than 3 points.
 */
function smoothPath(points: { x: number; y: number }[]): string {
  if (points.length < 2) return '';
  if (points.length === 2) {
    return `M ${points[0].x},${points[0].y} L ${points[1].x},${points[1].y}`;
  }

  let d = `M ${points[0].x},${points[0].y}`;

  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];

    // Catmull–Rom → cubic bezier control points (tension = 0.5 for smoother curves)
    const t = 0.2;
    const cp1x = p1.x + (p2.x - p0.x) * t;
    const cp1y = p1.y + (p2.y - p0.y) * t;
    const cp2x = p2.x - (p3.x - p1.x) * t;
    const cp2y = p2.y - (p3.y - p1.y) * t;

    d += ` C ${cp1x},${cp1y} ${cp2x},${cp2y} ${p2.x},${p2.y}`;
  }

  return d;
}

export function WorkloadForecast({ data }: WorkloadForecastProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);

  const maxCount = Math.max(...data.map((d) => d.count), 1);
  const totalFilings = data.reduce((sum, d) => sum + d.count, 0);

  // Current month for highlight
  const now = new Date();
  const currentIso = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  // Chart dimensions
  const chartHeight = 180;
  const paddingTop = 20;
  const paddingBottom = 4;
  const paddingX = 24;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        setContainerWidth(entry.contentRect.width);
      }
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [data.length]);

  // Animate in after mount
  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  // Compute data points
  const usableWidth = containerWidth - paddingX * 2;
  const usableHeight = chartHeight - paddingTop - paddingBottom;

  const points = data.map((item, i) => ({
    x: paddingX + (data.length > 1 ? (i / (data.length - 1)) * usableWidth : usableWidth / 2),
    y: paddingTop + usableHeight - (item.count / maxCount) * usableHeight,
  }));

  const linePath = smoothPath(points);

  // Closed area path (line path + close to bottom)
  const areaPath = linePath
    ? `${linePath} L ${points[points.length - 1].x},${chartHeight} L ${points[0].x},${chartHeight} Z`
    : '';

  // Grid lines (3 lines)
  const gridCount = 3;
  const gridLines = Array.from({ length: gridCount }, (_, i) => {
    const value = Math.round((maxCount / (gridCount + 1)) * (i + 1));
    const y = paddingTop + usableHeight - (value / maxCount) * usableHeight;
    return { value, y };
  });

  // Peak month
  const peakMonth = data.reduce(
    (best, item) => (item.count > best.count ? item : best),
    data[0] || { month: '', count: 0 }
  );

  return (
    <Card className="group py-5 hover:shadow-md transition-shadow duration-200">
      <CardContent className="px-8 py-0">
        <div className="flex items-start justify-between mb-4">
          <div>
            <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
              Monthly Workload Forecast
            </p>
            <div className="flex items-baseline gap-4 mt-1">
              <p className="text-2xl font-bold">{totalFilings} filings</p>
              {peakMonth && peakMonth.count > 0 && (
                <p className="text-sm text-muted-foreground">
                  Peak: <span className="font-medium text-foreground">{peakMonth.month}</span>{' '}
                  <span className="text-muted-foreground">({peakMonth.count})</span>
                </p>
              )}
            </div>
          </div>
          <div className="size-10 rounded-lg bg-blue-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-blue-500/20">
            <TrendingUp className="size-6 text-blue-500" />
          </div>
        </div>

        {data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No forecast data available
          </p>
        ) : (
          <div ref={containerRef} className="relative w-full" style={{ minHeight: chartHeight + 32 }}>
            {containerWidth > 0 && (
              <svg
                width={containerWidth}
                height={chartHeight + 32}
                className="overflow-visible"
              >
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="rgb(59 130 246)" stopOpacity="0.25" />
                    <stop offset="100%" stopColor="rgb(59 130 246)" stopOpacity="0.02" />
                  </linearGradient>
                </defs>

                {/* Grid lines */}
                {gridLines.map((gl, idx) => (
                  <g key={idx}>
                    <line
                      x1={paddingX}
                      y1={gl.y}
                      x2={containerWidth - paddingX}
                      y2={gl.y}
                      stroke="currentColor"
                      className="text-border/40"
                      strokeDasharray="4 4"
                    />
                    <text
                      x={paddingX - 8}
                      y={gl.y + 3}
                      textAnchor="end"
                      className="fill-muted-foreground"
                      fontSize="10"
                    >
                      {gl.value}
                    </text>
                  </g>
                ))}

                {/* Baseline */}
                <line
                  x1={paddingX}
                  y1={paddingTop + usableHeight}
                  x2={containerWidth - paddingX}
                  y2={paddingTop + usableHeight}
                  stroke="currentColor"
                  className="text-border/40"
                />

                {/* Area fill */}
                <path
                  d={areaPath}
                  fill="url(#areaGradient)"
                  className="transition-opacity duration-700"
                  style={{ opacity: mounted ? 1 : 0 }}
                />

                {/* Line */}
                <path
                  d={linePath}
                  fill="none"
                  stroke="rgb(59 130 246)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="transition-all duration-700"
                  style={{
                    strokeDasharray: mounted ? 'none' : '2000',
                    strokeDashoffset: mounted ? 0 : 2000,
                  }}
                />

                {/* Data points & labels */}
                {points.map((pt, i) => {
                  const item = data[i];
                  const isCurrent = item.isoMonth === currentIso;
                  const isHovered = hoveredIndex === i;
                  const shortMonth = item.month.split(' ')[0];

                  return (
                    <g key={item.isoMonth}>
                      {/* Hover column (invisible target) */}
                      <rect
                        x={pt.x - (usableWidth / data.length) / 2}
                        y={0}
                        width={usableWidth / data.length}
                        height={chartHeight + 32}
                        fill="transparent"
                        onMouseEnter={() => setHoveredIndex(i)}
                        onMouseLeave={() => setHoveredIndex(null)}
                        className="cursor-pointer"
                      />

                      {/* Vertical hover line */}
                      {isHovered && (
                        <line
                          x1={pt.x}
                          y1={paddingTop}
                          x2={pt.x}
                          y2={paddingTop + usableHeight}
                          stroke="rgb(59 130 246)"
                          strokeOpacity="0.2"
                          strokeWidth="1"
                          strokeDasharray="4 4"
                        />
                      )}

                      {/* Dot */}
                      <circle
                        cx={pt.x}
                        cy={pt.y}
                        r={isCurrent || isHovered ? 5 : 3.5}
                        fill={isCurrent ? 'rgb(59 130 246)' : 'white'}
                        stroke="rgb(59 130 246)"
                        strokeWidth="2"
                        className="transition-all duration-200"
                      />

                      {/* Current month pulse ring */}
                      {isCurrent && (
                        <circle
                          cx={pt.x}
                          cy={pt.y}
                          r="10"
                          fill="none"
                          stroke="rgb(59 130 246)"
                          strokeWidth="1.5"
                          opacity="0.3"
                          className="animate-ping"
                          style={{ transformOrigin: `${pt.x}px ${pt.y}px` }}
                        />
                      )}

                      {/* Count tooltip on hover */}
                      {isHovered && (
                        <g>
                          <rect
                            x={pt.x - 20}
                            y={pt.y - 30}
                            width="40"
                            height="22"
                            rx="6"
                            fill="rgb(59 130 246)"
                          />
                          <text
                            x={pt.x}
                            y={pt.y - 15}
                            textAnchor="middle"
                            fill="white"
                            fontSize="12"
                            fontWeight="600"
                          >
                            {item.count}
                          </text>
                        </g>
                      )}

                      {/* X-axis month label */}
                      <text
                        x={pt.x}
                        y={chartHeight + 18}
                        textAnchor="middle"
                        fontSize="11"
                        className={
                          isCurrent
                            ? 'fill-blue-600 dark:fill-blue-400 font-semibold'
                            : 'fill-muted-foreground'
                        }
                      >
                        {shortMonth}
                      </text>
                    </g>
                  );
                })}
              </svg>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
