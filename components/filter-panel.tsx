"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { CalendarIcon, FilterIcon, XIcon } from "lucide-react";
import { Button } from "@/components/ui/button";

interface DatasetColumn {
  id: string;
  name: string;
  dataType: string;
  uniqueValueCount: number | null;
  uniqueValues: string[] | null;
  metadata?: {
    sampleValues?: string[];
  } | null;
}

interface FilterPanelProps {
  datasetIds: string[];
  onClose?: () => void;
  onFiltersChange?: (filters: FilterState) => void;
}

export interface FilterState {
  [columnName: string]: {
    type: "date" | "categorical";
    values: string[];
    dateRange?: {
      from?: string;
      to?: string;
    };
  };
}

export const FilterPanel = ({
  datasetIds,
  onClose,
  onFiltersChange,
}: FilterPanelProps) => {
  const [loading, setLoading] = useState(true);
  const [columns, setColumns] = useState<DatasetColumn[]>([]);
  const [filters, setFilters] = useState<FilterState>({});

  // Notify parent whenever filters change
  useEffect(() => {
    onFiltersChange?.(filters);
  }, [filters, onFiltersChange]);

  // Fetch column metadata for all selected datasets
  useEffect(() => {
    const fetchColumns = async () => {
      try {
        setLoading(true);

        // Fetch columns for all datasets
        const responses = await Promise.all(
          datasetIds.map((id) => fetch(`/api/datasets/${id}`)),
        );

        const results = await Promise.all(responses.map((r) => r.json()));

        // Collect all columns from all datasets
        const allColumns: DatasetColumn[] = [];
        results.forEach((result) => {
          if (result.success && result.data.columns) {
            allColumns.push(...result.data.columns);
          }
        });

        // Filter to only include filterable columns
        const filterableColumns = allColumns.filter((col) => {
          // Include all date fields
          if (col.dataType === "date") return true;

          // Include columns with unique values <= 10
          if (
            col.uniqueValueCount !== null &&
            col.uniqueValueCount <= 10 &&
            col.uniqueValueCount > 0
          ) {
            return true;
          }

          return false;
        });

        setColumns(filterableColumns);
      } catch (error) {
        console.error("Error fetching columns:", error);
      } finally {
        setLoading(false);
      }
    };

    if (datasetIds.length > 0) {
      fetchColumns();
    } else {
      setColumns([]);
      setLoading(false);
    }
  }, [datasetIds]);

  const handleCategoricalFilter = (
    columnName: string,
    value: string,
    checked: boolean,
  ) => {
    setFilters((prev) => {
      const existing = prev[columnName] || {
        type: "categorical" as const,
        values: [],
      };

      const newValues = checked
        ? [...existing.values, value]
        : existing.values.filter((v) => v !== value);

      if (newValues.length === 0) {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        const { [columnName]: _, ...rest } = prev;
        return rest;
      }

      return {
        ...prev,
        [columnName]: {
          ...existing,
          values: newValues,
        },
      };
    });
  };

  const handleDateRangeFilter = (
    columnName: string,
    field: "from" | "to",
    value: string,
  ) => {
    setFilters((prev) => {
      const existing = prev[columnName] || {
        type: "date" as const,
        values: [],
        dateRange: {},
      };

      return {
        ...prev,
        [columnName]: {
          ...existing,
          dateRange: {
            ...existing.dateRange,
            [field]: value,
          },
        },
      };
    });
  };

  const clearFilter = (columnName: string) => {
    setFilters((prev) => {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { [columnName]: _, ...rest } = prev;
      return rest;
    });
  };

  const clearAllFilters = () => {
    setFilters({});
  };

  const activeFilterCount = Object.keys(filters).length;

  // Group columns by type
  const dateColumns = columns.filter((col) => col.dataType === "date");
  const categoricalColumns = columns.filter((col) => col.dataType !== "date");

  if (datasetIds.length === 0) {
    return null;
  }

  return (
    <div className="flex h-full min-h-0 w-80 flex-col border-l bg-background">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <FilterIcon className="h-4 w-4" />
          <h2 className="font-semibold text-sm">Filters</h2>
          {activeFilterCount > 0 && (
            <Badge variant="secondary" className="ml-1">
              {activeFilterCount}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-1">
          {activeFilterCount > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="h-7 px-2 text-xs"
            >
              Clear all
            </Button>
          )}
          {onClose && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7"
            >
              <XIcon className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 p-4">
          {loading ? (
            <>
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
              <Skeleton className="h-20 w-full" />
            </>
          ) : columns.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground text-sm">
              No filterable fields found
            </div>
          ) : (
            <>
              {/* Date Filters */}
              {dateColumns.length > 0 && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                    <h3 className="font-medium text-sm">Date Ranges</h3>
                  </div>
                  {dateColumns.map((column) => (
                    <Card key={column.id} className="border-muted">
                      <CardHeader className="p-3 pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">
                            {column.name}
                          </CardTitle>
                          {filters[column.name] && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => clearFilter(column.name)}
                              className="h-6 px-2 text-xs"
                            >
                              Clear
                            </Button>
                          )}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 p-3 pt-0">
                        <div className="space-y-1">
                          <Label
                            htmlFor={`${column.id}-from`}
                            className="text-xs"
                          >
                            From
                          </Label>
                          <input
                            id={`${column.id}-from`}
                            type="date"
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            value={filters[column.name]?.dateRange?.from || ""}
                            onChange={(e) =>
                              handleDateRangeFilter(
                                column.name,
                                "from",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                        <div className="space-y-1">
                          <Label
                            htmlFor={`${column.id}-to`}
                            className="text-xs"
                          >
                            To
                          </Label>
                          <input
                            id={`${column.id}-to`}
                            type="date"
                            className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:font-medium file:text-sm placeholder:text-muted-foreground focus-visible:outline-hidden focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                            value={filters[column.name]?.dateRange?.to || ""}
                            onChange={(e) =>
                              handleDateRangeFilter(
                                column.name,
                                "to",
                                e.target.value,
                              )
                            }
                          />
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}

              {/* Separator if we have both types */}
              {dateColumns.length > 0 && categoricalColumns.length > 0 && (
                <Separator />
              )}

              {/* Categorical Filters */}
              {categoricalColumns.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-medium text-sm">Categorical Fields</h3>
                  {categoricalColumns.map((column) => (
                    <Card key={column.id} className="border-muted">
                      <CardHeader className="p-3 pb-2">
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-sm font-medium">
                            {column.name}
                          </CardTitle>
                          {filters[column.name]?.values?.length > 0 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => clearFilter(column.name)}
                              className="h-6 px-2 text-xs"
                            >
                              Clear
                            </Button>
                          )}
                        </div>
                        <div className="text-muted-foreground text-xs">
                          {column.uniqueValueCount} unique value
                          {column.uniqueValueCount !== 1 ? "s" : ""}
                        </div>
                      </CardHeader>
                      <CardContent className="space-y-2 p-3 pt-0">
                        {column.uniqueValues?.map((value) => (
                          <div
                            key={value}
                            className="flex items-center space-x-2"
                          >
                            <Checkbox
                              id={`${column.id}-${value}`}
                              checked={
                                filters[column.name]?.values?.includes(value) ||
                                false
                              }
                              onCheckedChange={(checked) =>
                                handleCategoricalFilter(
                                  column.name,
                                  value,
                                  checked === true,
                                )
                              }
                            />
                            <Label
                              htmlFor={`${column.id}-${value}`}
                              className="flex-1 cursor-pointer truncate text-sm font-normal"
                              title={value}
                            >
                              {value || "(empty)"}
                            </Label>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </ScrollArea>

      {/* Footer with action buttons (optional) */}
      {activeFilterCount > 0 && (
        <div className="shrink-0 border-t p-4">
          <div className="text-muted-foreground text-xs">
            {activeFilterCount} filter{activeFilterCount !== 1 ? "s" : ""}{" "}
            active
          </div>
        </div>
      )}
    </div>
  );
};
