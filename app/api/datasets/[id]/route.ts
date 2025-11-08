import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { datasets, datasetColumns } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

/**
 * GET /api/datasets/[id]
 *
 * Fetch a single dataset with its column metadata
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    // Fetch dataset
    const [dataset] = await db
      .select()
      .from(datasets)
      .where(eq(datasets.id, id))
      .limit(1);

    if (!dataset) {
      return NextResponse.json(
        { success: false, error: "Dataset not found" },
        { status: 404 },
      );
    }

    // Fetch columns for this dataset
    const columns = await db
      .select()
      .from(datasetColumns)
      .where(eq(datasetColumns.datasetId, id))
      .orderBy(datasetColumns.position);

    return NextResponse.json({
      success: true,
      data: {
        ...dataset,
        columns,
      },
    });
  } catch (error) {
    console.error("Error fetching dataset:", error);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to fetch dataset",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
