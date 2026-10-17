"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AdminBookingRow } from "@/types/database";
import { cn } from "@/lib/utils";

interface AvailabilityCalendarProps {
  bookings: AdminBookingRow[];
  vehicles: { id: string; name: string; brand: string }[];
}

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];

type DayStatus = "available" | "confirmed" | "pending" | "overlap";

const CELL_STYLES: Record<DayStatus, string> = {
  available: "bg-muted/30 text-muted-foreground",
  confirmed: "bg-primary text-primary-foreground",
  pending: "bg-amber-400 text-amber-950",
  overlap: "bg-rose-500 text-white",
};

const LEGEND: { label: string; className: string }[] = [
  { label: "Available", className: "bg-muted/30" },
  { label: "Confirmed", className: "bg-primary" },
  { label: "Pending", className: "bg-amber-400" },
  { label: "Overlap", className: "bg-rose-500" },
];

// Date helpers that work purely on local calendar days — avoids timezone
// drift when the booking date strings ("yyyy-MM-dd") cross midnight UTC.
function toLocalDate(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function addDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);
}

interface DayCounts {
  confirmed: number;
  pending: number;
}

function resolveStatus(counts: DayCounts | undefined): DayStatus {
  if (!counts) return "available";
  if (counts.confirmed + counts.pending > 1) return "overlap";
  if (counts.confirmed > 0 && counts.pending > 0) return "overlap";
  if (counts.confirmed > 0) return "confirmed";
  if (counts.pending > 0) return "pending";
  return "available";
}

export function AvailabilityCalendar({
  bookings,
  vehicles,
}: AvailabilityCalendarProps) {
  const now = new Date();
  const [month, setMonth] = useState(
    () => new Date(now.getFullYear(), now.getMonth(), 1)
  );

  // vehicle_id → dateKey → booking counts (active bookings only).
  const byVehicle = useMemo(() => {
    const map: Record<string, Map<string, DayCounts>> = {};
    for (const b of bookings) {
      if (b.status !== "pending" && b.status !== "confirmed") continue;
      const start = toLocalDate(b.start_date);
      const end = toLocalDate(b.end_date);
      const bucket = (map[b.vehicle_id] ??= new Map<string, DayCounts>());
      for (let d = new Date(start); d <= end; d = addDay(d)) {
        const k = dateKey(d);
        const cur = bucket.get(k) ?? { confirmed: 0, pending: 0 };
        if (b.status === "confirmed") cur.confirmed++;
        else cur.pending++;
        bucket.set(k, cur);
      }
    }
    return map;
  }, [bookings]);

  const daysInMonth = new Date(
    month.getFullYear(),
    month.getMonth() + 1,
    0
  ).getDate();
  const lead = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const totalCols = lead + daysInMonth;
  const gridStyle = {
    gridTemplateColumns: `150px repeat(${totalCols}, minmax(0, 1fr))`,
  };

  // Overlap detection for the visible month.
  const conflicts = useMemo(() => {
    let count = 0;
    const vehicleNames = new Set<string>();
    for (const v of vehicles) {
      const bucket = byVehicle[v.id];
      if (!bucket) continue;
      for (const [k, counts] of bucket) {
        const [y, m] = k.split("-").map(Number);
        if (
          y === month.getFullYear() &&
          m === month.getMonth() + 1 &&
          resolveStatus(counts) === "overlap"
        ) {
          count++;
          vehicleNames.add(v.name);
        }
      }
    }
    return { count, vehicles: [...vehicleNames] };
  }, [byVehicle, vehicles, month]);

  const todayKey = dateKey(now);
  const navigate = (delta: number) =>
    setMonth((m) => new Date(m.getFullYear(), m.getMonth() + delta, 1));
  const goToday = () =>
    setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary/25 to-primary/5">
            <CalendarDays className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-xl font-semibold">Availability Calendar</h2>
        </div>
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate(-1)}
            aria-label="Previous month"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button
            variant="outline"
            size="sm"
            className="h-8 min-w-32"
            onClick={goToday}
          >
            <RotateCcw className="h-3.5 w-3.5" />
            {format(month, "MMMM yyyy")}
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            onClick={() => navigate(1)}
            aria-label="Next month"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted-foreground">
        {LEGEND.map((l) => (
          <span key={l.label} className="flex items-center gap-1.5">
            <span className={cn("h-3 w-3 rounded", l.className)} />
            {l.label}
          </span>
        ))}
      </div>

      {conflicts.count > 0 && (
        <div className="mt-4 flex items-start gap-2 rounded-xl border border-rose-500/30 bg-rose-500/5 p-3 text-sm text-rose-600 dark:text-rose-400">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>
            <strong>
              {conflicts.count} overlapping day
              {conflicts.count !== 1 ? "s" : ""}
            </strong>{" "}
            for {conflicts.vehicles.join(", ")} — these bookings block each
            other and need review.
          </p>
        </div>
      )}

      <div className="mt-4 overflow-x-auto rounded-2xl border bg-card">
        <div className="min-w-[920px] p-3" role="grid" aria-label="Fleet availability">
          {/* Weekday header */}
          <div className="grid" style={gridStyle} role="row">
            <div role="presentation" />
            {Array.from({ length: lead }).map((_, i) => (
              <div key={`lead-wd-${i}`} role="presentation" />
            ))}
            {Array.from({ length: daysInMonth }).map((_, i) => (
              <div
                key={`wd-${i}`}
                className="pb-1 text-center text-[10px] font-semibold uppercase text-muted-foreground"
              >
                {WEEKDAYS[(i + lead) % 7]}
              </div>
            ))}
          </div>

          {/* Vehicle rows */}
          {vehicles.map((v) => {
            const bucket = byVehicle[v.id];
            return (
              <div key={v.id} className="grid" style={gridStyle} role="row">
                <div
                  role="rowheader"
                  className="flex min-w-0 items-center truncate pr-2 text-xs font-medium"
                >
                  <span className="truncate">
                    {v.brand} {v.name}
                  </span>
                </div>
                {Array.from({ length: lead }).map((_, i) => (
                  <div
                    key={`lead-${v.id}-${i}`}
                    className="p-0.5"
                    role="presentation"
                  />
                ))}
                {Array.from({ length: daysInMonth }).map((_, i) => {
                  const date = new Date(
                    month.getFullYear(),
                    month.getMonth(),
                    i + 1
                  );
                  const k = dateKey(date);
                  const counts = bucket?.get(k);
                  const status = resolveStatus(counts);
                  const isToday = k === todayKey;
                  const activeCount = counts
                    ? counts.confirmed + counts.pending
                    : 0;
                  const tooltip =
                    status === "available"
                      ? `${v.name} — available`
                      : `${v.name} — ${status} (${activeCount} booking${activeCount !== 1 ? "s" : ""})`;
                  return (
                    <div key={k} className="p-0.5" role="gridcell">
                      <div
                        title={tooltip}
                        aria-label={`${v.brand} ${v.name}, ${format(date, "MMM d")} — ${status}`}
                        className={cn(
                          "flex h-7 items-center justify-center rounded-md text-[10px] font-medium tabular-nums",
                          CELL_STYLES[status],
                          isToday && "ring-2 ring-inset ring-primary",
                          status === "available" && "opacity-70"
                        )}
                      >
                        {i + 1}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
