"use client";

import { useCallback, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { DateRange } from "react-day-picker";
import { format, parseISO } from "date-fns";
import { Search, X } from "lucide-react";
import { DateRangePicker } from "@/components/booking/date-range-picker";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { formatCurrency } from "@/lib/utils";

interface VehicleFiltersProps {
  categories: string[];
  maxPrice: number;
}

export function VehicleFilters({ categories, maxPrice }: VehicleFiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();

  const currentCategory = searchParams.get("category") ?? "all";
  const currentMinPrice = Number(searchParams.get("minPrice") ?? 0);
  const currentMaxPrice = Number(searchParams.get("maxPrice") ?? maxPrice);
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const dateRange: DateRange | undefined =
    startDate && endDate
      ? { from: parseISO(startDate), to: parseISO(endDate) }
      : undefined;

  const updateParams = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());

      Object.entries(updates).forEach(([key, value]) => {
        if (value === null || value === "" || value === "all") {
          params.delete(key);
        } else {
          params.set(key, value);
        }
      });

      startTransition(() => {
        router.push(`/cars?${params.toString()}`, { scroll: false });
      });
    },
    [router, searchParams, startTransition]
  );

  const handleDateChange = (range: DateRange | undefined) => {
    updateParams({
      startDate: range?.from ? format(range.from, "yyyy-MM-dd") : null,
      endDate: range?.to ? format(range.to, "yyyy-MM-dd") : null,
    });
  };

  const clearFilters = () => {
    startTransition(() => {
      router.push("/cars", { scroll: false });
    });
  };

  const hasActiveFilters =
    currentCategory !== "all" ||
    currentMinPrice > 0 ||
    currentMaxPrice < maxPrice ||
    startDate ||
    endDate;

  return (
    <div className="space-y-6 rounded-2xl border bg-card p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Filter Fleet</h2>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            disabled={isPending}
          >
            <X className="mr-1 h-4 w-4" />
            Clear
          </Button>
        )}
      </div>

      <div className="space-y-2">
        <Label>Category</Label>
        <Select
          value={currentCategory}
          onValueChange={(value) => updateParams({ category: value })}
        >
          <SelectTrigger>
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <Label>Price Range</Label>
          <span className="text-sm text-muted-foreground">
            {formatCurrency(currentMinPrice)} – {formatCurrency(currentMaxPrice)}
            /day
          </span>
        </div>
        <Slider
          min={0}
          max={maxPrice}
          step={10}
          value={[currentMinPrice, currentMaxPrice]}
          onValueCommit={([min, max]) =>
            updateParams({
              minPrice: min > 0 ? String(min) : null,
              maxPrice: max < maxPrice ? String(max) : null,
            })
          }
        />
      </div>

      <div className="space-y-2">
        <Label>Availability Dates</Label>
        <DateRangePicker
          dateRange={dateRange}
          onDateRangeChange={handleDateChange}
        />
        <p className="text-xs text-muted-foreground">
          Only show vehicles available for your dates
        </p>
      </div>

      {isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Search className="h-4 w-4 animate-pulse" />
          Updating results…
        </div>
      )}
    </div>
  );
}
