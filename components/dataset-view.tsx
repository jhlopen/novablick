"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { Dataset, DatasetColumn } from "@/lib/db/schema";

interface DatasetViewProps {
  datasetId: string;
}

interface ColumnMetadata extends Omit<DatasetColumn, "metadata"> {
  metadata?: {
    sampleValues?: string[];
  } | null;
}

interface DatasetWithColumns extends Dataset {
  columns: ColumnMetadata[];
}

interface RowData {
  id: string;
  rowNumber: number;
  data: Record<string, string>;
}

const DATA_TYPE_COLORS: Record<string, string> = {
  string: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  number: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  integer: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  boolean:
    "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200",
  date: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
  unknown: "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200",
};

const ROWS_PER_PAGE = 100;
const ROW_HEIGHT = 41; // Height of each row in pixels
const OVERSCAN = 10; // Number of extra rows to render above/below visible area

export const DatasetView = ({ datasetId }: DatasetViewProps) => {
  const [dataset, setDataset] = useState<DatasetWithColumns | null>(null);
  const [rows, setRows] = useState<RowData[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingRows, setLoadingRows] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);

  // Virtual scrolling state
  const [scrollTop, setScrollTop] = useState(0);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // Fetch dataset metadata (including columns)
  useEffect(() => {
    const fetchDataset = async () => {
      try {
        setLoading(true);
        const response = await fetch(`/api/datasets/${datasetId}`);
        const result = await response.json();

        if (result.success) {
          setDataset(result.data);
        } else {
          setError(result.error || "Failed to load dataset");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchDataset();
  }, [datasetId]);

  // Fetch rows data
  const fetchRows = useCallback(
    async (newOffset: number = 0, append: boolean = false) => {
      if (!hasMore && append) return;

      try {
        setLoadingRows(true);
        const response = await fetch(
          `/api/datasets/${datasetId}/rows?offset=${newOffset}&limit=${ROWS_PER_PAGE}`,
        );
        const result = await response.json();

        if (result.success) {
          const newRows = result.data;
          setRows((prev) => (append ? [...prev, ...newRows] : newRows));
          setOffset(newOffset);
          setHasMore(newRows.length === ROWS_PER_PAGE);
        } else {
          setError(result.error || "Failed to load rows");
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoadingRows(false);
      }
    },
    [datasetId, hasMore],
  );

  // Initial row fetch
  useEffect(() => {
    if (dataset) {
      fetchRows(0, false);
    }
  }, [dataset, fetchRows]);

  // Handle scroll for infinite loading
  const handleScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.currentTarget;
      setScrollTop(target.scrollTop);

      // Load more when near bottom
      const scrollPercentage =
        (target.scrollTop + target.clientHeight) / target.scrollHeight;
      if (scrollPercentage > 0.8 && !loadingRows && hasMore) {
        fetchRows(offset + ROWS_PER_PAGE, true);
      }
    },
    [loadingRows, hasMore, offset, fetchRows],
  );

  // Calculate visible rows based on scroll position
  const getVisibleRange = () => {
    if (!dataset) return { start: 0, end: 0 };

    const visibleStart = Math.floor(scrollTop / ROW_HEIGHT);
    const visibleEnd = Math.ceil(
      (scrollTop + (scrollContainerRef.current?.clientHeight || 600)) /
        ROW_HEIGHT,
    );

    return {
      start: Math.max(0, visibleStart - OVERSCAN),
      end: Math.min(rows.length, visibleEnd + OVERSCAN),
    };
  };

  const { start, end } = getVisibleRange();
  const visibleRows = rows.slice(start, end);
  const totalHeight = rows.length * ROW_HEIGHT;
  const offsetY = start * ROW_HEIGHT;

  if (loading) {
    return (
      <div className="mx-auto max-w-7xl space-y-6 p-6">
        {/* Dataset Header Skeleton */}
        <div>
          <Skeleton className="h-9 w-64 mb-2" />
          <Skeleton className="h-5 w-48" />
        </div>

        {/* Column Metadata Skeleton */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-6 w-40" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="rounded-lg border p-4">
                  <div className="mb-3 flex items-start justify-between">
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-5 w-16" />
                  </div>
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Data Preview Skeleton */}
        <Card>
          <CardHeader>
            <CardTitle>
              <Skeleton className="h-6 w-32" />
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-hidden rounded-md border">
              <div className="h-[600px]">
                {/* Table Header Skeleton */}
                <div className="sticky top-0 z-10 flex border-b bg-muted/50">
                  <div className="w-20 shrink-0 border-r px-4 py-3">
                    <Skeleton className="h-4 w-4" />
                  </div>
                  {[...Array(5)].map((_, i) => (
                    <div
                      key={i}
                      className="min-w-[150px] flex-1 border-r px-4 py-3 last:border-r-0"
                      style={{ maxWidth: "300px" }}
                    >
                      <Skeleton className="h-4 w-24" />
                    </div>
                  ))}
                </div>
                {/* Table Rows Skeleton */}
                {[...Array(12)].map((_, i) => (
                  <div
                    key={i}
                    className="flex border-b"
                    style={{ height: ROW_HEIGHT }}
                  >
                    <div className="w-20 shrink-0 border-r px-4 py-2">
                      <Skeleton className="h-4 w-8" />
                    </div>
                    {[...Array(5)].map((_, j) => (
                      <div
                        key={j}
                        className="min-w-[150px] flex-1 border-r px-4 py-2 last:border-r-0"
                        style={{ maxWidth: "300px" }}
                      >
                        <Skeleton className="h-4 w-full" />
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error || !dataset) {
    return (
      <div className="mx-auto max-w-7xl p-6">
        <Card>
          <CardContent className="py-8">
            <p className="text-center text-destructive">
              {error || "Dataset not found"}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl space-y-6 p-6">
      {/* Dataset Header */}
      <div>
        <h1 className="text-3xl font-bold break-words">{dataset.name}</h1>
        <p className="mt-2 text-muted-foreground">
          {dataset.rowCount.toLocaleString()} rows ×{" "}
          {dataset.columnCount.toLocaleString()} columns
        </p>
      </div>

      {/* Column Metadata Section */}
      <Card>
        <CardHeader>
          <CardTitle>Column Metadata</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
            {dataset.columns.map((column) => (
              <div
                key={column.id}
                className="rounded-lg border p-4 transition-colors hover:bg-accent"
              >
                <div className="mb-3 flex items-start justify-between w-full gap-2">
                  <h3
                    className="font-semibold text-sm truncate"
                    style={{ maxWidth: "calc(100% - 56px)" }} // adjust if Badge is wider
                    title={column.name.length > 20 ? column.name : undefined}
                  >
                    {column.name}
                  </h3>
                  <Badge
                    variant="outline"
                    className={cn(
                      "ml-2",
                      DATA_TYPE_COLORS[column.dataType] ||
                        DATA_TYPE_COLORS.unknown,
                    )}
                  >
                    {column.dataType}
                  </Badge>
                </div>

                <div className="space-y-2 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <span>Null:</span>
                    <span className="font-medium">
                      {((column.nullRatio || 0) * 100).toFixed(1)}%
                    </span>
                  </div>

                  {column.uniqueValueCount !== null &&
                    column.uniqueValueCount !== undefined && (
                      <div className="flex justify-between">
                        <span>Unique:</span>
                        <span className="font-medium">
                          {column.uniqueValueCount.toLocaleString()}
                        </span>
                      </div>
                    )}

                  {column.metadata?.sampleValues &&
                    column.metadata.sampleValues.length > 0 && (
                      <div className="mt-2 pt-2 border-t">
                        <p className="mb-1 font-medium">Sample values:</p>
                        <div className="space-y-1">
                          {column.metadata.sampleValues
                            .slice(0, 3)
                            .map((value, i) => (
                              <div
                                key={i}
                                className="truncate rounded bg-muted px-2 py-1 font-mono text-xs"
                              >
                                {value || "(empty)"}
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Virtual Scrolling Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Data Preview</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="overflow-hidden rounded-md border">
            <div
              ref={scrollContainerRef}
              onScroll={handleScroll}
              className="relative h-[600px] overflow-auto"
            >
              {/* Spacer for virtual scrolling */}
              <div style={{ height: totalHeight }}>
                {/* Table Header */}
                <div className="sticky top-0 z-10 flex border-b bg-muted/50 backdrop-blur">
                  <div className="flex w-20 shrink-0 items-center border-r px-4 py-3 font-medium text-xs">
                    #
                  </div>
                  {dataset.columns.map((column) => (
                    <div
                      key={column.id}
                      className="flex min-w-[150px] flex-1 items-center border-r px-4 py-3 font-medium text-xs last:border-r-0"
                      style={{ maxWidth: "300px" }}
                    >
                      <span className="truncate">{column.name}</span>
                    </div>
                  ))}
                </div>

                {/* Virtual Rows */}
                <div
                  style={{
                    transform: `translateY(${offsetY}px)`,
                  }}
                >
                  {visibleRows.map((row) => (
                    <div
                      key={row.id}
                      className="flex border-b transition-colors hover:bg-muted/50"
                      style={{ height: ROW_HEIGHT }}
                    >
                      <div className="flex w-20 shrink-0 items-center border-r px-4 py-2 text-muted-foreground text-xs">
                        {row.rowNumber}
                      </div>
                      {dataset.columns.map((column) => (
                        <div
                          key={column.id}
                          className="flex min-w-[150px] flex-1 items-center border-r px-4 py-2 text-xs last:border-r-0"
                          style={{ maxWidth: "300px" }}
                        >
                          <span className="truncate">
                            {row.data[column.name] || "—"}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>

                {/* Loading indicator */}
                {loadingRows && (
                  <div className="flex items-center justify-center border-b py-8">
                    <div className="text-muted-foreground text-sm">
                      Loading more rows...
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
