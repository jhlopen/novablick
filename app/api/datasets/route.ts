import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { datasets } from "@/lib/db/schema";
import { desc } from "drizzle-orm";

/**
 * GET /api/datasets
 *
 * List all datasets in the database
 */
export async function GET() {
  try {
    const allDatasets = await db
      .select({
        id: datasets.id,
        name: datasets.name,
        fileName: datasets.fileName,
        rowCount: datasets.rowCount,
        columnCount: datasets.columnCount,
        createdAt: datasets.createdAt,
      })
      .from(datasets)
      .orderBy(desc(datasets.createdAt));

    return NextResponse.json({
      success: true,
      data: allDatasets,
    });
  } catch (error) {
    console.error("Error fetching datasets:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch datasets",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
