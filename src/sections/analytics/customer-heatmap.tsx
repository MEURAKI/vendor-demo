"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import {
  Flame,
  MapPin,
  Clock,
  Calendar,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Sun,
  Moon,
  Sunrise,
  Map,
  Table2,
} from "lucide-react";
import clsx from "clsx";
import type { HeatmapCell, GeoRegion } from "./types";

/* Lazy-load the Leaflet map (no SSR) */
const SingaporeMap = dynamic(() => import("./singapore-map"), { ssr: false });

type CustomerHeatmapProps = {
  cells: HeatmapCell[];
  regions: GeoRegion[];
};

type TabKey = "activity" | "geography";
type GeoView = "map" | "table";

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const HOURS = Array.from({ length: 24 }, (_, i) => i);

/* Intensity color scale */
function intensityClass(value: number, max: number): string {
  if (max === 0) return "bg-gray-50";
  const ratio = value / max;
  if (ratio === 0) return "bg-gray-50";
  if (ratio < 0.15) return "bg-purple-50";
  if (ratio < 0.3) return "bg-purple-100";
  if (ratio < 0.45) return "bg-purple-200";
  if (ratio < 0.6) return "bg-purple-300";
  if (ratio < 0.75) return "bg-purple-400";
  if (ratio < 0.9) return "bg-purple-500";
  return "bg-purple-600";
}

export default function CustomerHeatmap({
  cells,
  regions,
}: CustomerHeatmapProps) {
  const [tab, setTab] = useState<TabKey>("activity");
  const [geoView, setGeoView] = useState<GeoView>("map");
  const [hoveredCell, setHoveredCell] = useState<{
    day: number;
    hour: number;
    value: number;
  } | null>(null);

  /* Build lookup grid */
  const grid: Record<string, number> = {};
  let maxVal = 0;
  cells.forEach((c) => {
    const key = `${c.day}-${c.hour}`;
    grid[key] = c.value;
    if (c.value > maxVal) maxVal = c.value;
  });

  /* Derived stats */
  const totalBookings = cells.reduce((sum, c) => sum + c.value, 0);

  const hourTotals = HOURS.map((h) =>
    DAYS.reduce((sum, _, d) => sum + (grid[`${d}-${h}`] ?? 0), 0)
  );
  const peakHour = hourTotals.indexOf(Math.max(...hourTotals));

  const dayTotals = DAYS.map((_, d) =>
    HOURS.reduce((sum, h) => sum + (grid[`${d}-${h}`] ?? 0), 0)
  );
  const peakDay = dayTotals.indexOf(Math.max(...dayTotals));

  const morningBookings = cells
    .filter((c) => c.hour >= 6 && c.hour < 12)
    .reduce((s, c) => s + c.value, 0);
  const afternoonBookings = cells
    .filter((c) => c.hour >= 12 && c.hour < 18)
    .reduce((s, c) => s + c.value, 0);

  const fmtHour = (h: number) => {
    if (h === 0) return "12am";
    if (h < 12) return `${h}am`;
    if (h === 12) return "12pm";
    return `${h - 12}pm`;
  };

  const maxRegionBookings = Math.max(...regions.map((r) => r.bookings), 1);
  const totalRegionBookings = regions.reduce((s, r) => s + r.bookings, 0);

  return (
    <div className="mb-8 rounded-2xl bg-white shadow-sm border border-gray-100 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-orange-50">
            <Flame className="h-5 w-5 text-orange-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-gray-900">
              Customer Heat Maps
            </h2>
            <p className="text-xs text-gray-400">
              When and where your customers book
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 rounded-full bg-purple-50 px-3 py-1.5">
          <Zap className="h-3 w-3 text-purple-600" />
          <span className="text-xs font-bold text-purple-700">
            {totalBookings.toLocaleString()}
          </span>
          <span className="text-[10px] text-purple-500">total bookings</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 rounded-xl bg-gray-100 p-1">
        {(
          [
            { key: "activity" as TabKey, label: "Activity", icon: Clock },
            { key: "geography" as TabKey, label: "Geography", icon: MapPin },
          ] as const
        ).map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={clsx(
                "flex flex-1 items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-xs font-medium transition-all",
                tab === t.key
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-500 hover:text-gray-700"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              {t.label}
            </button>
          );
        })}
      </div>

      {/* ====== ACTIVITY TAB ====== */}
      {tab === "activity" && (
        <div>
          {/* Quick stats row */}
          <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl bg-gray-50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Calendar className="h-3 w-3 text-gray-400" />
                <span className="text-[10px] font-medium text-gray-400 uppercase">
                  Peak Day
                </span>
              </div>
              <p className="text-sm font-bold text-gray-900">{DAYS[peakDay]}</p>
              <p className="text-[10px] text-gray-400">
                {dayTotals[peakDay]} bookings
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="h-3 w-3 text-gray-400" />
                <span className="text-[10px] font-medium text-gray-400 uppercase">
                  Peak Hour
                </span>
              </div>
              <p className="text-sm font-bold text-gray-900">
                {fmtHour(peakHour)}
              </p>
              <p className="text-[10px] text-gray-400">
                {hourTotals[peakHour]} bookings
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Sunrise className="h-3 w-3 text-amber-500" />
                <span className="text-[10px] font-medium text-gray-400 uppercase">
                  Morning
                </span>
              </div>
              <p className="text-sm font-bold text-gray-900">
                {Math.round((morningBookings / totalBookings) * 100)}%
              </p>
              <p className="text-[10px] text-gray-400">
                {morningBookings} bookings
              </p>
            </div>
            <div className="rounded-xl bg-gray-50 p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Sun className="h-3 w-3 text-orange-500" />
                <span className="text-[10px] font-medium text-gray-400 uppercase">
                  Afternoon
                </span>
              </div>
              <p className="text-sm font-bold text-gray-900">
                {Math.round((afternoonBookings / totalBookings) * 100)}%
              </p>
              <p className="text-[10px] text-gray-400">
                {afternoonBookings} bookings
              </p>
            </div>
          </div>

          {/* Heat map grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[700px]">
              {/* Hour labels row */}
              <div className="flex items-end mb-1">
                <div className="w-10 shrink-0" />
                {HOURS.filter((h) => h >= 6 && h <= 22).map((h) => (
                  <div
                    key={h}
                    className="flex-1 text-center text-[9px] text-gray-400 font-medium"
                  >
                    {h % 3 === 0 ? fmtHour(h) : ""}
                  </div>
                ))}
              </div>

              {/* Rows: one per day */}
              {DAYS.map((dayLabel, dayIdx) => (
                <div key={dayLabel} className="flex items-center mb-0.5">
                  <div className="w-10 shrink-0 text-[10px] font-medium text-gray-500 text-right pr-2">
                    {dayLabel}
                  </div>
                  {HOURS.filter((h) => h >= 6 && h <= 22).map((h) => {
                    const val = grid[`${dayIdx}-${h}`] ?? 0;
                    const isHovered =
                      hoveredCell?.day === dayIdx && hoveredCell?.hour === h;

                    return (
                      <div
                        key={h}
                        className="flex-1 px-[1px]"
                        onMouseEnter={() =>
                          setHoveredCell({ day: dayIdx, hour: h, value: val })
                        }
                        onMouseLeave={() => setHoveredCell(null)}
                      >
                        <div
                          className={clsx(
                            "relative aspect-square rounded-[3px] transition-all",
                            intensityClass(val, maxVal),
                            isHovered &&
                              "ring-2 ring-purple-500 ring-offset-1 scale-110 z-10"
                          )}
                        >
                          {isHovered && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50 whitespace-nowrap rounded-lg bg-gray-900 px-2.5 py-1.5 text-[10px] text-white shadow-lg">
                              <span className="font-semibold">
                                {dayLabel} {fmtHour(h)}
                              </span>
                              <span className="mx-1.5 text-gray-400">|</span>
                              <span>
                                {val} booking{val !== 1 ? "s" : ""}
                              </span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ))}

              {/* Color legend */}
              <div className="flex items-center justify-end gap-2 mt-3">
                <span className="text-[9px] text-gray-400">Less</span>
                <div className="flex gap-0.5">
                  {[
                    "bg-gray-50",
                    "bg-purple-50",
                    "bg-purple-100",
                    "bg-purple-200",
                    "bg-purple-300",
                    "bg-purple-400",
                    "bg-purple-500",
                    "bg-purple-600",
                  ].map((c) => (
                    <div
                      key={c}
                      className={clsx("h-3 w-3 rounded-[2px]", c)}
                    />
                  ))}
                </div>
                <span className="text-[9px] text-gray-400">More</span>
              </div>
            </div>
          </div>

          {/* Hourly distribution bar chart */}
          <div className="mt-6 pt-5 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-700 mb-3">
              Hourly Distribution
            </p>
            <div className="flex items-end gap-[2px] h-20">
              {HOURS.filter((h) => h >= 6 && h <= 22).map((h) => {
                const total = hourTotals[h];
                const maxHour = Math.max(
                  ...HOURS.filter((hh) => hh >= 6 && hh <= 22).map(
                    (hh) => hourTotals[hh]
                  )
                );
                const pct = maxHour > 0 ? (total / maxHour) * 100 : 0;

                return (
                  <div key={h} className="flex-1 flex flex-col items-center">
                    <div
                      className="w-full relative"
                      style={{ height: "80px" }}
                    >
                      <div
                        className={clsx(
                          "absolute bottom-0 left-0 right-0 rounded-t transition-all",
                          h === peakHour
                            ? "bg-gradient-to-t from-purple-600 to-purple-400"
                            : "bg-gradient-to-t from-purple-200 to-purple-100"
                        )}
                        style={{ height: `${pct}%` }}
                      />
                    </div>
                    <span className="mt-1 text-[8px] text-gray-400">
                      {h % 2 === 0 ? fmtHour(h) : ""}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ====== GEOGRAPHY TAB ====== */}
      {tab === "geography" && (
        <div>
          {/* Map / Table toggle */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-purple-500" />
              <span className="text-sm font-semibold text-gray-900">
                Singapore
              </span>
              <span className="text-xs text-gray-400">
                {regions.length} regions &middot; {totalRegionBookings} bookings
              </span>
            </div>
            <div className="flex gap-1 rounded-lg bg-gray-100 p-0.5">
              <button
                onClick={() => setGeoView("map")}
                className={clsx(
                  "flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all",
                  geoView === "map"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Map className="h-3 w-3" />
                Map
              </button>
              <button
                onClick={() => setGeoView("table")}
                className={clsx(
                  "flex items-center gap-1 rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-all",
                  geoView === "table"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-500 hover:text-gray-700"
                )}
              >
                <Table2 className="h-3 w-3" />
                Table
              </button>
            </div>
          </div>

          {/* Map view */}
          {geoView === "map" && (
            <div>
              <SingaporeMap regions={regions} />

              {/* Summary cards below map */}
              <div className="mt-4 grid grid-cols-3 gap-3">
                <div className="rounded-xl bg-purple-50 p-3 text-center">
                  <p className="text-[10px] font-medium text-purple-500 uppercase">
                    Top Region
                  </p>
                  <p className="text-sm font-bold text-purple-700">
                    {regions[0]?.region}
                  </p>
                  <p className="text-[10px] text-purple-400">
                    {regions[0]?.bookings} bookings
                  </p>
                </div>
                <div className="rounded-xl bg-green-50 p-3 text-center">
                  <p className="text-[10px] font-medium text-green-500 uppercase">
                    Fastest Growing
                  </p>
                  <p className="text-sm font-bold text-green-700">
                    {
                      [...regions].sort((a, b) => {
                        const aVal = parseFloat(a.trend);
                        const bVal = parseFloat(b.trend);
                        return bVal - aVal;
                      })[0]?.region
                    }
                  </p>
                </div>
                <div className="rounded-xl bg-blue-50 p-3 text-center">
                  <p className="text-[10px] font-medium text-blue-500 uppercase">
                    Avg Spend
                  </p>
                  <p className="text-sm font-bold text-blue-700">
                    {regions[0]?.avgSpend}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Table view */}
          {geoView === "table" && (
            <div className="overflow-hidden rounded-xl border border-gray-100">
              <table className="min-w-full text-xs">
                <thead>
                  <tr className="bg-gray-50/80 text-[10px] font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="px-4 py-3 text-left">#</th>
                    <th className="px-4 py-3 text-left">Region</th>
                    <th className="px-4 py-3 text-right">Bookings</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                    <th className="px-4 py-3 text-right">Customers</th>
                    <th className="px-4 py-3 text-right">Avg Spend</th>
                    <th className="px-4 py-3 text-right">% Total</th>
                    <th className="px-4 py-3 text-center">Trend</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {regions.map((region, idx) => (
                    <tr
                      key={region.region}
                      className="transition-colors hover:bg-gray-50/50"
                    >
                      <td className="px-4 py-3">
                        <span className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-purple-50 text-[10px] font-bold text-purple-600">
                          {idx + 1}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {region.region}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {region.bookings}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {region.revenue}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {region.customers}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-gray-900">
                        {region.avgSpend}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="h-1.5 w-16 rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-purple-400"
                              style={{ width: `${region.pctOfTotal}%` }}
                            />
                          </div>
                          <span className="text-gray-500 w-8 text-right">
                            {region.pctOfTotal}%
                          </span>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={clsx(
                            "inline-flex items-center gap-0.5 text-[11px] font-semibold",
                            region.trendDirection === "up"
                              ? "text-green-600"
                              : region.trendDirection === "down"
                              ? "text-red-500"
                              : "text-gray-400"
                          )}
                        >
                          {region.trendDirection === "up" ? (
                            <TrendingUp className="h-3 w-3" />
                          ) : region.trendDirection === "down" ? (
                            <TrendingDown className="h-3 w-3" />
                          ) : (
                            <Minus className="h-3 w-3" />
                          )}
                          {region.trend}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
                {/* Totals row */}
                <tfoot>
                  <tr className="bg-gray-50 font-semibold text-gray-900">
                    <td className="px-4 py-3" colSpan={2}>
                      Total
                    </td>
                    <td className="px-4 py-3 text-right">
                      {totalRegionBookings}
                    </td>
                    <td className="px-4 py-3 text-right">
                      $
                      {regions
                        .reduce(
                          (s, r) =>
                            s +
                            parseFloat(r.revenue.replace(/[$,]/g, "")),
                          0
                        )
                        .toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {regions.reduce((s, r) => s + r.customers, 0)}
                    </td>
                    <td className="px-4 py-3 text-right" colSpan={3} />
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
