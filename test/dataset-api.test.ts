import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET as getDataset } from "@/app/api/datasets/[id]/route";
import { GET as getRows } from "@/app/api/datasets/[id]/rows/route";
import { NextRequest } from "next/server";

// Mock the database module
vi.mock("@/lib/db", () => {
  const mockDatasetId = "test-dataset-uuid-123";
  const mockColumnId = "test-column-uuid-456";

  const mockDataset = {
    id: mockDatasetId,
    name: "test_dataset",
    fileName: "test.csv",
    rowCount: 100,
    columnCount: 3,
    delimiter: ";",
    hasHeader: true,
    metadata: {},
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
  };

  const mockColumns = [
    {
      id: mockColumnId,
      datasetId: mockDatasetId,
      name: "id",
      position: 0,
      dataType: "integer",
      nullRatio: 0,
      uniqueValues: ["1", "2", "3"],
      uniqueValueCount: 100,
      metadata: { sampleValues: ["1", "2", "3"] },
    },
    {
      id: mockColumnId + "-2",
      datasetId: mockDatasetId,
      name: "name",
      position: 1,
      dataType: "string",
      nullRatio: 0.02,
      uniqueValues: ["John", "Jane", "Bob"],
      uniqueValueCount: 98,
      metadata: { sampleValues: ["John", "Jane", "Bob"] },
    },
    {
      id: mockColumnId + "-3",
      datasetId: mockDatasetId,
      name: "email",
      position: 2,
      dataType: "string",
      nullRatio: 0.05,
      uniqueValues: ["john@example.com", "jane@example.com"],
      uniqueValueCount: 95,
      metadata: {
        sampleValues: ["john@example.com", "jane@example.com"],
      },
    },
  ];

  const mockRows = [
    {
      id: "row-1",
      datasetId: mockDatasetId,
      rowNumber: 1,
      data: {
        id: "1",
        name: "John",
        email: "john@example.com",
      },
    },
    {
      id: "row-2",
      datasetId: mockDatasetId,
      rowNumber: 2,
      data: {
        id: "2",
        name: "Jane",
        email: "jane@example.com",
      },
    },
  ];

  return {
    db: {
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn(() => {
            // Return an object that can handle both query patterns:
            // 1. .limit() -> returns dataset (for dataset query)
            // 2. .orderBy() -> can return columns OR chain further for rows

            let orderByCalled = false;

            const whereResult: any = {
              // For dataset query: .limit() returns the dataset
              limit: vi.fn((limitValue) => {
                if (orderByCalled) {
                  // This is part of a rows query chain: .orderBy().limit().offset()
                  return {
                    offset: vi.fn(() => Promise.resolve(mockRows)),
                  };
                }
                // This is a dataset query: .limit() returns dataset
                return Promise.resolve([mockDataset]);
              }),

              // For columns query: .orderBy() returns columns
              // For rows query: .orderBy() returns an object with .limit().offset()
              orderBy: vi.fn(() => {
                orderByCalled = true;

                // Return an object that can be both:
                // - A promise (for columns query)
                // - An object with .limit() method (for rows query)
                const orderByResult: any = {
                  limit: vi.fn(() => ({
                    offset: vi.fn(() => Promise.resolve(mockRows)),
                  })),
                  // Make it thenable so it can be awaited directly (for columns query)
                  then: (resolve: any) => {
                    return Promise.resolve(mockColumns).then(resolve);
                  },
                  catch: (reject: any) => {
                    return Promise.resolve(mockColumns).catch(reject);
                  },
                  finally: (onFinally: any) => {
                    return Promise.resolve(mockColumns).finally(onFinally);
                  },
                };

                return orderByResult;
              }),
            };

            return whereResult;
          }),
        })),
      })),
    },
  };
});

describe("GET /api/datasets/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch dataset with columns", async () => {
    const params = Promise.resolve({ id: "test-dataset-uuid-123" });
    const request = {} as NextRequest;

    const response = await getDataset(request, { params });
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data).toHaveProperty("id");
    expect(body.data).toHaveProperty("name");
    expect(body.data).toHaveProperty("columns");
    expect(Array.isArray(body.data.columns)).toBe(true);
  });

  it("should include column metadata", async () => {
    const params = Promise.resolve({ id: "test-dataset-uuid-123" });
    const request = {} as NextRequest;

    const response = await getDataset(request, { params });
    const body = await response.json();

    expect(body.success).toBe(true);
    const columns = body.data.columns;
    expect(columns.length).toBeGreaterThan(0);

    columns.forEach((col: any) => {
      expect(col).toHaveProperty("name");
      expect(col).toHaveProperty("dataType");
      expect(col).toHaveProperty("position");
      expect(col).toHaveProperty("nullRatio");
    });
  });
});

describe("GET /api/datasets/[id]/rows", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch rows with default pagination", async () => {
    const params = Promise.resolve({ id: "test-dataset-uuid-123" });
    const url = "http://localhost:3000/api/datasets/test-dataset-uuid-123/rows";
    const request = { url } as NextRequest;

    const response = await getRows(request, { params });
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.data).toBeDefined();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body.pagination).toHaveProperty("offset");
    expect(body.pagination).toHaveProperty("limit");
    expect(body.pagination).toHaveProperty("count");
  });

  it("should respect offset parameter", async () => {
    const params = Promise.resolve({ id: "test-dataset-uuid-123" });
    const url =
      "http://localhost:3000/api/datasets/test-dataset-uuid-123/rows?offset=50";
    const request = { url } as NextRequest;

    const response = await getRows(request, { params });
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.pagination.offset).toBe(50);
  });

  it("should respect limit parameter", async () => {
    const params = Promise.resolve({ id: "test-dataset-uuid-123" });
    const url =
      "http://localhost:3000/api/datasets/test-dataset-uuid-123/rows?limit=50";
    const request = { url } as NextRequest;

    const response = await getRows(request, { params });
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.pagination.limit).toBe(50);
  });

  it("should enforce maximum limit of 1000", async () => {
    const params = Promise.resolve({ id: "test-dataset-uuid-123" });
    const url =
      "http://localhost:3000/api/datasets/test-dataset-uuid-123/rows?limit=5000";
    const request = { url } as NextRequest;

    const response = await getRows(request, { params });
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.pagination.limit).toBe(1000);
  });

  it("should handle negative offset", async () => {
    const params = Promise.resolve({ id: "test-dataset-uuid-123" });
    const url =
      "http://localhost:3000/api/datasets/test-dataset-uuid-123/rows?offset=-10";
    const request = { url } as NextRequest;

    const response = await getRows(request, { params });
    const body = await response.json();

    expect(body.success).toBe(true);
    expect(body.pagination.offset).toBe(0);
  });

  it("should return row data with correct structure", async () => {
    const params = Promise.resolve({ id: "test-dataset-uuid-123" });
    const url = "http://localhost:3000/api/datasets/test-dataset-uuid-123/rows";
    const request = { url } as NextRequest;

    const response = await getRows(request, { params });
    const body = await response.json();

    expect(body.success).toBe(true);
    const rows = body.data;
    expect(rows.length).toBeGreaterThan(0);

    rows.forEach((row: any) => {
      expect(row).toHaveProperty("id");
      expect(row).toHaveProperty("rowNumber");
      expect(row).toHaveProperty("data");
      expect(typeof row.data).toBe("object");
    });
  });
});
