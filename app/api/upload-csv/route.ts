import { NextRequest, NextResponse } from "next/server";
import { Parser } from "csv-parse";
import { db } from "@/lib/db";
import { datasets, datasetColumns, datasetRows } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { Readable } from "stream";
import type { ReadableStream as NodeReadableStream } from "stream/web";

// Allow longer execution time for large file uploads
export const maxDuration = 300; // 5 minutes

interface ColumnInfo {
  name: string;
  position: number;
  dataType: string;
  nullCount: number;
  totalCount: number;
  uniqueValues: Set<string>;
  sampleValues: string[];
}

/**
 * Infer the data type of a value
 */
export function inferDataType(value: string): string {
  if (
    value === "" ||
    value === null ||
    value === undefined ||
    value.trim() === ""
  ) {
    return "unknown";
  }

  // Check if it's a number
  if (!isNaN(Number(value)) && value.trim() !== "") {
    return Number.isInteger(Number(value)) ? "integer" : "number";
  }

  // Check if it's a boolean
  const lowerValue = value.toLowerCase().trim();
  if (["true", "false", "yes", "no", "1", "0"].includes(lowerValue)) {
    return "boolean";
  }

  // Check if it's a date
  const dateValue = new Date(value);
  if (
    !isNaN(dateValue.getTime()) &&
    value.match(/\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}/)
  ) {
    return "date";
  }

  // Default to string
  return "string";
}

/**
 * Consolidate data types from multiple samples
 */
export function consolidateDataTypes(types: string[]): string {
  const uniqueTypes = [...new Set(types.filter((t) => t !== "unknown"))];

  if (uniqueTypes.length === 0) return "string";
  if (uniqueTypes.length === 1) return uniqueTypes[0];

  // If mixed types, default to string
  return "string";
}

/**
 * Process CSV file in streaming fashion
 */
export async function processCSVStream(
  fileStream: ReadableStream<Uint8Array>,
  fileName: string,
  options: {
    delimiter?: string;
    hasHeader?: boolean;
    batchSize?: number;
  } = {},
) {
  const { delimiter = ";", hasHeader = true, batchSize = 1000 } = options;
  const name = fileName.replace(/\.csv$/i, "");

  // Convert web stream to Node.js stream
  const nodeStream = Readable.fromWeb(
    fileStream as unknown as NodeReadableStream,
  );

  // Create CSV parser
  const parser = nodeStream.pipe(
    new Parser({
      delimiter,
      relax_quotes: true,
      skip_empty_lines: true,
      trim: true,
      bom: true, // Handle BOM (Byte Order Mark)
    }),
  );

  let headers: string[] = [];
  let rowCount = 0;
  let isFirstRow = true;
  let datasetId: string | null = null;
  const columnInfoMap = new Map<string, ColumnInfo>();
  const rowBatch: Array<{ rowNumber: number; data: Record<string, string> }> =
    [];

  // Process each row
  for await (const record of parser) {
    const values = record as string[];

    // Handle headers
    if (isFirstRow && hasHeader) {
      headers = values.map((h, i) => h || `column_${i + 1}`);

      // Initialize column info
      headers.forEach((header, index) => {
        columnInfoMap.set(header, {
          name: header,
          position: index,
          dataType: "unknown",
          nullCount: 0,
          totalCount: 0,
          uniqueValues: new Set(),
          sampleValues: [],
        });
      });

      isFirstRow = false;
      continue;
    }

    // If no headers, generate them
    if (isFirstRow && !hasHeader) {
      headers = values.map((_, i) => `column_${i + 1}`);

      headers.forEach((header, index) => {
        columnInfoMap.set(header, {
          name: header,
          position: index,
          dataType: "unknown",
          nullCount: 0,
          totalCount: 0,
          uniqueValues: new Set(),
          sampleValues: [],
        });
      });

      isFirstRow = false;
    }

    // Process data row
    rowCount++;
    const rowData: Record<string, string> = {};

    values.forEach((value, index) => {
      const header = headers[index] || `column_${index + 1}`;
      rowData[header] = value;

      // Update column info
      const colInfo = columnInfoMap.get(header);
      if (colInfo) {
        // Track total count for null ratio calculation
        colInfo.totalCount++;

        // Track unique values (limit to 1000 for memory)
        if (colInfo.uniqueValues.size < 1000) {
          colInfo.uniqueValues.add(value);
        }

        // Store sample values (first 10)
        if (colInfo.sampleValues.length < 10) {
          colInfo.sampleValues.push(value);
        }

        // Count null values
        if (!value || value.trim() === "") {
          colInfo.nullCount++;
        }
      }
    });

    rowBatch.push({ rowNumber: rowCount, data: rowData });

    // Insert batch to database
    if (rowBatch.length >= batchSize) {
      // Create dataset on first batch
      if (!datasetId) {
        const [dataset] = await db
          .insert(datasets)
          .values({
            name,
            fileName,
            rowCount: 0, // Will update at the end
            columnCount: headers.length,
            delimiter,
            hasHeader,
            metadata: {},
          })
          .returning();

        datasetId = dataset.id;
      }

      // Insert rows
      await db.insert(datasetRows).values(
        rowBatch.map((row) => ({
          datasetId: datasetId!,
          rowNumber: row.rowNumber,
          data: row.data,
        })),
      );

      rowBatch.length = 0; // Clear batch
    }
  }

  // Insert remaining rows
  if (rowBatch.length > 0) {
    if (!datasetId) {
      const [dataset] = await db
        .insert(datasets)
        .values({
          name,
          fileName,
          rowCount: 0,
          columnCount: headers.length,
          delimiter,
          hasHeader,
          metadata: {},
        })
        .returning();

      datasetId = dataset.id;
    }

    await db.insert(datasetRows).values(
      rowBatch.map((row) => ({
        datasetId: datasetId!,
        rowNumber: row.rowNumber,
        data: row.data,
      })),
    );
  }

  // Handle empty file
  if (!datasetId) {
    const [dataset] = await db
      .insert(datasets)
      .values({
        name,
        fileName,
        rowCount: 0,
        columnCount: headers.length,
        delimiter,
        hasHeader,
        metadata: {},
      })
      .returning();

    datasetId = dataset.id;
  }

  // Infer and insert column metadata
  const columnsToInsert = Array.from(columnInfoMap.values()).map((colInfo) => {
    const inferredType = consolidateDataTypes(
      colInfo.sampleValues.map(inferDataType),
    );

    return {
      datasetId: datasetId!,
      name: colInfo.name,
      position: colInfo.position,
      dataType: inferredType,
      nullRatio:
        colInfo.totalCount > 0 ? colInfo.nullCount / colInfo.totalCount : 0,
      uniqueValues:
        colInfo.uniqueValues.size >= 1000 ? null : colInfo.uniqueValues.size,
      metadata: {
        sampleValues: colInfo.sampleValues.slice(0, 5),
      },
    };
  });

  if (columnsToInsert.length > 0) {
    await db.insert(datasetColumns).values(columnsToInsert);
  }

  // Update dataset with final row count
  await db
    .update(datasets)
    .set({
      rowCount,
      updatedAt: new Date(),
    })
    .where(eq(datasets.id, datasetId));

  return {
    name,
    datasetId,
    rowCount,
    columnCount: headers.length,
    columns: columnsToInsert.map((col) => ({
      name: col.name,
      dataType: col.dataType,
      nullRatio: col.nullRatio,
    })),
  };
}

/**
 * POST /api/upload-csv
 *
 * Upload a CSV file using multipart/form-data
 *
 * Form fields:
 * - file: The CSV file
 * - delimiter: Optional delimiter (default: ";")
 * - hasHeader: Optional boolean (default: true)
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const delimiter = (formData.get("delimiter") as string) || ";";
    const hasHeader = formData.get("hasHeader") !== "false"; // Default to true

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Validate file type
    if (!file.name.endsWith(".csv")) {
      return NextResponse.json(
        { error: "File must be a CSV file" },
        { status: 400 },
      );
    }

    // Process the CSV file
    const result = await processCSVStream(file.stream(), file.name, {
      delimiter,
      hasHeader,
      batchSize: 1000,
    });

    return NextResponse.json({
      success: true,
      message: "CSV file uploaded successfully",
      data: {
        id: result.datasetId,
        name: result.name,
        fileName: file.name,
        fileSize: file.size,
        rowCount: result.rowCount,
        columnCount: result.columnCount,
        columns: result.columns,
      },
    });
  } catch (error) {
    console.error("Error uploading CSV:", error);
    return NextResponse.json(
      {
        error: "Failed to upload CSV file",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
