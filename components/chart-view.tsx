"use client";

import { useRef, useState } from "react";
import { toPng } from "html-to-image";
import {
  DownloadIcon,
  TableIcon,
  ChartColumnIcon,
  ChartSplineIcon,
  ChartPieIcon,
} from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  Pie,
  PieChart,
  XAxis,
} from "recharts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ChartConfig,
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  ChartTooltipContent,
} from "@/components/ui/chart";
import { Button } from "@/components/ui/button";
import { TableView } from "@/components/table-view";

export type ExtendedChartConfig = ChartConfig & {
  metadata?: {
    type?: "bar" | "line" | "pie";
    title?: string;
    description?: string;
  };
};

export function ChartView({
  data,
  config,
}: {
  data: Record<string, string | number>[];
  config: ExtendedChartConfig;
}) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [viewMode, setViewMode] = useState<"chart" | "table">("chart");
  const dataKeys = data.length > 0 ? Object.keys(data[0]) : [];
  const { metadata, ...chartConfig } = config;

  const exportToPng = async () => {
    if (!chartRef.current) return;

    try {
      const dataUrl = await toPng(chartRef.current, {
        cacheBust: true,
      });

      const link = document.createElement("a");
      link.download = `${metadata?.title || "chart"}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error("Error exporting chart as PNG:", error);
    }
  };

  const exportToCsv = () => {
    if (!data || data.length === 0) return;

    try {
      const headers = Object.keys(data[0]);

      const csvContent = [
        headers.join(","),
        ...data.map((row) =>
          headers
            .map((header) => {
              const value = row[header];
              // Escape quotes and wrap in quotes if contains comma, quote, or newline
              const stringValue = String(value);
              if (
                stringValue.includes(",") ||
                stringValue.includes('"') ||
                stringValue.includes("\n")
              ) {
                return `"${stringValue.replace(/"/g, '""')}"`;
              }
              return stringValue;
            })
            .join(","),
        ),
      ].join("\n");

      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);

      link.href = url;
      link.download = `${metadata?.title || "table"}.csv`;
      link.click();

      // Clean up
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error("Error exporting table as CSV:", error);
    }
  };

  return (
    <div className="relative">
      <div className="absolute right-4 top-4 z-10 flex gap-2">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setViewMode(viewMode === "chart" ? "table" : "chart")}
          title={
            viewMode === "chart"
              ? "Switch to Table View"
              : "Switch to Chart View"
          }
        >
          {viewMode === "chart" ? (
            <TableIcon className="h-4 w-4" />
          ) : metadata?.type === "pie" ? (
            <ChartPieIcon className="h-4 w-4" />
          ) : metadata?.type === "line" ? (
            <ChartSplineIcon className="h-4 w-4" />
          ) : (
            <ChartColumnIcon className="h-4 w-4" />
          )}
        </Button>
        <Button
          variant="outline"
          size="icon"
          onClick={viewMode === "chart" ? exportToPng : exportToCsv}
          title={viewMode === "chart" ? "Export as PNG" : "Export as CSV"}
        >
          <DownloadIcon className="h-4 w-4" />
        </Button>
      </div>
      <Card ref={chartRef}>
        <CardHeader>
          <CardTitle>{metadata?.title}</CardTitle>
          <CardDescription>{metadata?.description}</CardDescription>
        </CardHeader>
        <CardContent>
          {viewMode === "table" ? (
            <TableView data={data} />
          ) : (
            <ChartContainer config={chartConfig}>
              {metadata?.type === "pie" ? (
                <PieChart>
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent hideLabel />}
                  />
                  <Pie
                    data={data.map((item, i) => ({
                      ...item,
                      fill: `var(--chart-${i + 1})`,
                    }))}
                    dataKey={dataKeys[1]}
                    nameKey={dataKeys[0]}
                  />
                  <ChartLegend
                    content={<ChartLegendContent nameKey={dataKeys[0]} />}
                    className="-translate-y-2 flex-wrap gap-2 *:basis-1/4 *:justify-center"
                  />
                </PieChart>
              ) : metadata?.type === "line" ? (
                <LineChart
                  accessibilityLayer
                  data={data}
                  margin={{
                    left: 12,
                    right: 12,
                  }}
                >
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey={dataKeys[0]}
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent />}
                  />
                  {dataKeys.slice(1).map((key, i) => (
                    <Line
                      key={key}
                      dataKey={key}
                      type="monotone"
                      stroke={`var(--chart-${i + 1})`}
                      strokeWidth={2}
                      dot={false}
                    />
                  ))}
                </LineChart>
              ) : (
                <BarChart accessibilityLayer data={data}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey={dataKeys[0]}
                    tickLine={false}
                    tickMargin={10}
                    axisLine={false}
                  />
                  <ChartTooltip
                    cursor={false}
                    content={<ChartTooltipContent indicator="dashed" />}
                  />
                  <ChartLegend content={<ChartLegendContent />} />
                  {dataKeys.slice(1).map((key, i) => (
                    <Bar
                      key={key}
                      dataKey={key}
                      fill={`var(--chart-${i + 1})`}
                      radius={4}
                    />
                  ))}
                </BarChart>
              )}
            </ChartContainer>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
