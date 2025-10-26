import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { datasetRows } from "@/lib/db/schema";
import { eq, asc } from "drizzle-orm";

/**
 * GET /api/datasets/[id]/rows
 *
 * Fetch rows for a dataset with pagination
 *
 * Query params:
 * - offset: number (default: 0)
 * - limit: number (default: 100, max: 1000)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;
    const { searchParams } = new URL(request.url);

    // Parse pagination params
    const offset = Math.max(0, parseInt(searchParams.get("offset") || "0", 10));
    const limit = Math.min(
      1000,
      Math.max(1, parseInt(searchParams.get("limit") || "100", 10)),
    );

    // Fetch rows with pagination
    const rows = await db
      .select()
      .from(datasetRows)
      .where(eq(datasetRows.datasetId, id))
      .orderBy(asc(datasetRows.rowNumber))
      .limit(limit)
      .offset(offset);

    return NextResponse.json({
      success: true,
      data: rows,
      pagination: {
        offset,
        limit,
        count: rows.length,
      },
    });
  } catch (error) {
    console.error("Error fetching dataset rows:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch dataset rows",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
