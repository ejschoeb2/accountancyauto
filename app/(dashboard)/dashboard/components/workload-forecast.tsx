'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { ToggleGroup } from '@/components/ui/toggle-group';
import { TrendingUp } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import {
  getWorkloadForecast,
  type ForecastTimeframe,
  type ForecastBucket,
} from '@/lib/dashboard/forecast';

// ---------------------------------------------------------------------------
// Status colours & config
// ---------------------------------------------------------------------------

const STATUS_KEYS = ['green', 'violet', 'blue', 'amber', 'orange', 'red'] as const;
type StatusKey = (typeof STATUS_KEYS)[number];

const STATUS_CONFIG: Record<StatusKey, { label: string; color: string }> = {
  red:    { label: 'Overdue',     color: '#f87171' },
  orange: { label: 'Critical',    color: '#fb923c' },
  amber:  { label: 'Approaching', color: '#facc15' },
  blue:   { label: 'On Track',    color: '#60a5fa' },
  violet: { label: 'Records In',  color: '#a78bfa' },
  green:  { label: 'Completed',   color: '#34d399' },
};

// Stacking order bottom→top: green, violet, blue, amber, orange, red
// STATUS_KEYS is already in this order.

const TIMEFRAME_OPTIONS: { value: ForecastTimeframe; label: string }[] = [
  { value: 'this-week', label: 'This week' },
  { value: '4-weeks', label: '4 weeks' },
  { value: '6-months', label: '6 months' },
  { value: '12-months', label: '12 months' },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function WorkloadForecast() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [timeframe, setTimeframe] = useState<ForecastTimeframe>('6-months');
  const [data, setData] = useState<ForecastBucket[]>([]);
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [loading, setLoading] = useState(true);

  // Fetch data
  const fetchData = useCallback(async (tf: ForecastTimeframe) => {
    setLoading(true);
    setMounted(false);
    try {
      const supabase = createClient();
      const result = await getWorkloadForecast(supabase, tf);
      setData(result);
    } catch (e) {
      console.error('Forecast fetch error:', e);
    } finally {
      setLoading(false);
      setTimeout(() => setMounted(true), 50);
    }
  }, []);

  useEffect(() => { fetchData(timeframe); }, [timeframe, fetchData]);

  // Observe container width — re-attach when data changes so ref is always tracked
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) setContainerWidth(entry.contentRect.width);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [data]);

  // Chart dimensions
  const chartHeight = 280;
  const paddingTop = 24;
  const paddingBottom = 8;
  const paddingX = 32;
  const barGap = data.length > 7 ? 6 : 10;

  const usableWidth = containerWidth - paddingX * 2;
  const usableHeight = chartHeight - paddingTop - paddingBottom;
  const barCount = data.length || 1;
  const barWidth = Math.max(12, (usableWidth - (barCount - 1) * barGap) / barCount);

  const maxTotal = Math.max(...data.map(d => d.total), 1);

  // Grid lines (3)
  const gridCount = 3;
  const gridLines = Array.from({ length: gridCount }, (_, i) => {
    const value = Math.round((maxTotal / (gridCount + 1)) * (i + 1));
    const y = paddingTop + usableHeight - (value / maxTotal) * usableHeight;
    return { value, y };
  });

  // Build stacked bar segments
  const bars = data.map((bucket, i) => {
    const x = paddingX + i * (barWidth + barGap);
    let yOffset = paddingTop + usableHeight; // start from baseline
    const segments: { key: StatusKey; x: number; y: number; width: number; height: number; color: string }[] = [];

    for (const key of STATUS_KEYS) {
      const count = bucket.breakdown[key];
      if (count === 0) continue;
      const segHeight = (count / maxTotal) * usableHeight;
      yOffset -= segHeight;
      segments.push({
        key,
        x,
        y: yOffset,
        width: barWidth,
        height: segHeight,
        color: STATUS_CONFIG[key].color,
      });
    }

    return { bucket, x, segments, index: i };
  });

  // Tooltip content
  const hoveredBar = hoveredIndex !== null ? bars[hoveredIndex] : null;

  // Legend order: urgency first
  const legendOrder: StatusKey[] = ['red', 'orange', 'amber', 'blue', 'violet', 'green'];

  return (
    <Card className="group py-5 hover:shadow-md transition-shadow duration-200">
      <CardContent className="px-8 py-0">
        <div className="flex items-start justify-between mb-6 gap-4">
          <p className="text-sm font-semibold text-muted-foreground uppercase tracking-wide pt-2">
            Workload Forecast
          </p>
          <div className="flex items-center gap-3">
            <ToggleGroup
              options={TIMEFRAME_OPTIONS}
              value={timeframe}
              onChange={setTimeframe}
            />
            <div className="size-10 rounded-lg bg-violet-500/10 flex items-center justify-center transition-all duration-200 group-hover:bg-violet-500/20">
              <TrendingUp className="size-6 text-violet-500" />
            </div>
          </div>
        </div>

        <div ref={containerRef} className="relative w-full" style={{ minHeight: chartHeight + 40 }}>
          {loading && data.length === 0 ? (
            <div className="flex items-center justify-center" style={{ height: chartHeight + 40 }}>
              <p className="text-sm text-muted-foreground">Loading forecast…</p>
            </div>
          ) : data.length === 0 || data.every(d => d.total === 0) ? (
            <div className="flex items-center justify-center" style={{ height: chartHeight + 40 }}>
              <p className="text-sm text-muted-foreground">No deadlines in this period</p>
            </div>
          ) : containerWidth > 0 ? (
            <svg
                  width={containerWidth}
                  height={chartHeight + 40}
                  className="overflow-visible"
                >
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
                    className="text-border"
                    strokeWidth={1.5}
                  />

                  {/* Bars */}
                  {bars.map(({ bucket, x, segments, index }) => {
                    const isHovered = hoveredIndex === index;
                    const barCenterX = x + barWidth / 2;

                    return (
                      <g key={bucket.isoKey}>
                        {/* Current period highlight */}
                        {bucket.isCurrent && (
                          <rect
                            x={x - 4}
                            y={paddingTop}
                            width={barWidth + 8}
                            height={usableHeight}
                            rx={6}
                            fill="currentColor"
                            className="text-violet-500"
                            opacity={0.06}
                          />
                        )}

                        {/* Stacked segments — clipped to a rounded bar shape */}
                        {segments.length > 0 && (() => {
                          const clipId = `bar-clip-${index}`;
                          const totalBarHeight = mounted
                            ? segments.reduce((sum, s) => sum + s.height, 0)
                            : 0;
                          const barTopY = mounted
                            ? paddingTop + usableHeight - totalBarHeight
                            : paddingTop + usableHeight;
                          const r = Math.min(10, barWidth / 2.5);
                          // Path with rounded top corners only, flat bottom
                          const clipPathD = `M ${x},${barTopY + totalBarHeight} L ${x},${barTopY + r} Q ${x},${barTopY} ${x + r},${barTopY} L ${x + barWidth - r},${barTopY} Q ${x + barWidth},${barTopY} ${x + barWidth},${barTopY + r} L ${x + barWidth},${barTopY + totalBarHeight} Z`;
                          return (
                            <>
                              <defs>
                                <clipPath id={clipId}>
                                  <path
                                    d={clipPathD}
                                    className="transition-all duration-500 ease-out"
                                  />
                                </clipPath>
                              </defs>
                              <g
                                clipPath={`url(#${clipId})`}
                                opacity={isHovered ? 1 : 0.95}
                                className="transition-opacity duration-200"
                              >
                                {segments.map((seg) => (
                                  <rect
                                    key={seg.key}
                                    x={seg.x}
                                    y={mounted ? seg.y : paddingTop + usableHeight}
                                    width={seg.width}
                                    height={mounted ? seg.height : 0}
                                    fill={seg.color}
                                    className="transition-all duration-500 ease-out"
                                    style={{ transitionDelay: `${index * 40}ms` }}
                                  />
                                ))}
                              </g>
                            </>
                          );
                        })()}

                        {/* Invisible hover target */}
                        <rect
                          x={x - barGap / 2}
                          y={0}
                          width={barWidth + barGap}
                          height={chartHeight + 40}
                          fill="transparent"
                          onMouseEnter={() => setHoveredIndex(index)}
                          onMouseLeave={() => setHoveredIndex(null)}
                          className="cursor-pointer"
                        />

                        {/* X-axis label */}
                        <text
                          x={barCenterX}
                          y={chartHeight + 20}
                          textAnchor="middle"
                          fontSize="11"
                          className={
                            bucket.isCurrent
                              ? 'fill-violet-600 dark:fill-violet-400 font-semibold'
                              : 'fill-muted-foreground'
                          }
                        >
                          {bucket.label}
                        </text>
                      </g>
                    );
                  })}

                  {/* Hover tooltip */}
                  {hoveredBar && hoveredBar.bucket.total > 0 && (() => {
                    const tooltipWidth = 170;
                    const tooltipLineHeight = 20;
                    const tooltipPadY = 14;
                    const activeLines = legendOrder.filter(k => hoveredBar.bucket.breakdown[k] > 0);
                    const lineCount = activeLines.length;
                    const tooltipHeight = tooltipPadY + lineCount * tooltipLineHeight + 12 + tooltipLineHeight + tooltipPadY;
                    const barCenterX = hoveredBar.x + barWidth / 2;
                    // Keep tooltip within bounds
                    let tooltipX = barCenterX - tooltipWidth / 2;
                    if (tooltipX < 4) tooltipX = 4;
                    if (tooltipX + tooltipWidth > containerWidth - 4) tooltipX = containerWidth - tooltipWidth - 4;
                    const tooltipY = Math.max(0, (hoveredBar.segments[hoveredBar.segments.length - 1]?.y ?? paddingTop) - tooltipHeight - 8);

                    return (
                      <g className="pointer-events-none">
                        <rect
                          x={tooltipX}
                          y={tooltipY}
                          width={tooltipWidth}
                          height={tooltipHeight}
                          rx={10}
                          className="fill-foreground"
                          opacity={0.95}
                        />
                        {activeLines.map((key, li) => (
                          <g key={key}>
                            <circle
                              cx={tooltipX + 18}
                              cy={tooltipY + tooltipPadY + li * tooltipLineHeight + 8}
                              r={4.5}
                              fill={STATUS_CONFIG[key].color}
                            />
                            <text
                              x={tooltipX + 30}
                              y={tooltipY + tooltipPadY + li * tooltipLineHeight + 12}
                              fontSize="11"
                              className="fill-background"
                            >
                              {STATUS_CONFIG[key].label}
                            </text>
                            <text
                              x={tooltipX + tooltipWidth - 14}
                              y={tooltipY + tooltipPadY + li * tooltipLineHeight + 12}
                              fontSize="11"
                              fontWeight="600"
                              textAnchor="end"
                              className="fill-background"
                            >
                              {hoveredBar.bucket.breakdown[key]}
                            </text>
                          </g>
                        ))}
                        <line
                          x1={tooltipX + 12}
                          y1={tooltipY + tooltipPadY + lineCount * tooltipLineHeight + 4}
                          x2={tooltipX + tooltipWidth - 12}
                          y2={tooltipY + tooltipPadY + lineCount * tooltipLineHeight + 4}
                          stroke="currentColor"
                          className="text-background"
                          opacity={0.2}
                        />
                        <text
                          x={tooltipX + tooltipWidth - 14}
                          y={tooltipY + tooltipPadY + lineCount * tooltipLineHeight + 22}
                          fontSize="11"
                          fontWeight="600"
                          textAnchor="end"
                          className="fill-background"
                        >
                          Total: {hoveredBar.bucket.total}
                        </text>
                      </g>
                    );
                  })()}
            </svg>
          ) : null}
        </div>

        {/* Legend — always show all statuses */}
        <div className="flex flex-wrap gap-x-5 gap-y-2 mt-2">
          {legendOrder.map((key) => (
            <div key={key} className="flex items-center gap-1.5">
              <div
                className="size-3 rounded-sm flex-shrink-0"
                style={{ backgroundColor: STATUS_CONFIG[key].color }}
              />
              <span className="text-sm text-muted-foreground">
                {STATUS_CONFIG[key].label}
              </span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
