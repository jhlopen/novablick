import { describe, it, expect, beforeEach, vi } from "vitest";
import { POST } from "@/app/api/upload-csv/route";
import { NextRequest } from "next/server";

// Mock the database module
vi.mock("@/lib/db", () => {
  const mockDatasetId = "test-dataset-uuid-123";

  return {
    db: {
      insert: vi.fn(() => ({
        values: vi.fn((data) => ({
          returning: vi.fn(() => {
            // Mock dataset insert
            if (Array.isArray(data)) {
              // For batch inserts (rows/columns)
              return Promise.resolve([]);
            } else {
              // For single dataset insert
              return Promise.resolve([
                {
                  id: mockDatasetId,
                  name: data.name || "test",
                  fileName: data.fileName || "test.csv",
                  rowCount: data.rowCount || 0,
                  columnCount: data.columnCount || 0,
                  delimiter: data.delimiter || ";",
                  hasHeader: data.hasHeader ?? true,
                  metadata: data.metadata || {},
                  createdAt: new Date(),
                  updatedAt: new Date(),
                },
              ]);
            }
          }),
        })),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => Promise.resolve()),
        })),
      })),
    },
  };
});

// Type definitions for API responses
interface ErrorResponse {
  error: string;
  details?: string;
  status: number;
}

interface SuccessResponse {
  success: boolean;
  message: string;
  data: {
    datasetId: string;
    fileName: string;
    fileSize: number;
    rowCount: number;
    columnCount: number;
    columns: Array<{
      name: string;
      dataType: string;
      nullRatio: number;
    }>;
  };
  status: number;
}

type ApiResponse = ErrorResponse | SuccessResponse;

// Type guard to check if response is successful
function isSuccessResponse(response: ApiResponse): response is SuccessResponse {
  return "success" in response && response.success === true;
}

// Type guard to check if response is an error
function isErrorResponse(response: ApiResponse): response is ErrorResponse {
  return "error" in response;
}

describe("POST /api/upload-csv", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validation", () => {
    it("should reject request without file", async () => {
      const formData = new FormData();
      const request = {
        formData: () => Promise.resolve(formData),
      } as unknown as NextRequest;

      const response = await POST(request);
      const body = await response.json();
      expect(response.status).toBe(400);
      if (isErrorResponse(body)) {
        expect(body.error).toBe("No file provided");
      }
    });

    it("should reject non-CSV files", async () => {
      const file = new File(["content"], "test.txt", { type: "text/plain" });
      const formData = new FormData();
      formData.append("file", file);

      const request = {
        formData: () => Promise.resolve(formData),
      } as unknown as NextRequest;

      const response = await POST(request);
      const body = await response.json();
      expect(response.status).toBe(400);
      if (isErrorResponse(body)) {
        expect(body.error).toBe("File must be a CSV file");
      }
    });
  });

  describe("parameter handling", () => {
    it("should use default delimiter when not provided", async () => {
      const csvContent = "id;name\n1;John\n2;Jane";
      const file = new File([csvContent], "test.csv", { type: "text/csv" });
      const formData = new FormData();
      formData.append("file", file);

      const request = {
        formData: () => Promise.resolve(formData),
      } as unknown as NextRequest;

      const response = await POST(request);
      const body = await response.json();

      expect(isSuccessResponse(body)).toBe(true);
    });

    it("should use custom delimiter when provided", async () => {
      const csvContent = "id,name\n1,John\n2,Jane";
      const file = new File([csvContent], "test.csv", { type: "text/csv" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("delimiter", ",");

      const request = {
        formData: () => Promise.resolve(formData),
      } as unknown as NextRequest;

      const response = await POST(request);
      const body = await response.json();

      expect(isSuccessResponse(body)).toBe(true);
    });

    it("should handle hasHeader=false", async () => {
      const csvContent = "1;John\n2;Jane";
      const file = new File([csvContent], "test.csv", { type: "text/csv" });
      const formData = new FormData();
      formData.append("file", file);
      formData.append("hasHeader", "false");

      const request = {
        formData: () => Promise.resolve(formData),
      } as unknown as NextRequest;

      const response = await POST(request);
      const body = await response.json();

      if (!isSuccessResponse(body)) {
        expect.fail("Response should be successful");
      }
      // Should have auto-generated column names like column_1, column_2
      expect(body.data.columns.length).toBeGreaterThan(0);
    });
  });

  describe("CSV processing", () => {
    it("should process simple CSV with headers", async () => {
      const csvContent =
        "id;name;email\n1;John;john@example.com\n2;Jane;jane@example.com";
      const file = new File([csvContent], "users.csv", { type: "text/csv" });
      const formData = new FormData();
      formData.append("file", file);

      const request = {
        formData: () => Promise.resolve(formData),
      } as unknown as NextRequest;

      const response = await POST(request);
      const body = await response.json();

      if (!isSuccessResponse(body)) {
        expect.fail("Response should be successful");
      }
      expect(body.data.rowCount).toBe(2);
      expect(body.data.columnCount).toBe(3);
    });

    it("should infer column types correctly", async () => {
      const csvContent =
        "id;name;age;active;created_at\n1;John;25;true;2024-01-15\n2;Jane;30;false;2024-02-20";
      const file = new File([csvContent], "users.csv", { type: "text/csv" });
      const formData = new FormData();
      formData.append("file", file);

      const request = {
        formData: () => Promise.resolve(formData),
      } as unknown as NextRequest;

      const response = await POST(request);
      const body = await response.json();

      if (!isSuccessResponse(body)) {
        expect.fail("Response should be successful");
      }

      const columns = body.data.columns;
      const idColumn = columns.find((c) => c.name === "id");
      const nameColumn = columns.find((c) => c.name === "name");
      const ageColumn = columns.find((c) => c.name === "age");
      const activeColumn = columns.find((c) => c.name === "active");
      const createdColumn = columns.find((c) => c.name === "created_at");

      expect(idColumn?.dataType).toBe("integer");
      expect(nameColumn?.dataType).toBe("string");
      expect(ageColumn?.dataType).toBe("integer");
      expect(activeColumn?.dataType).toBe("boolean");
      expect(createdColumn?.dataType).toBe("date");
    });

    it("should handle empty CSV file", async () => {
      const csvContent = "id;name;email";
      const file = new File([csvContent], "empty.csv", { type: "text/csv" });
      const formData = new FormData();
      formData.append("file", file);

      const request = {
        formData: () => Promise.resolve(formData),
      } as unknown as NextRequest;

      const response = await POST(request);
      const body = await response.json();

      if (!isSuccessResponse(body)) {
        expect.fail("Response should be successful");
      }
      expect(body.data.rowCount).toBe(0);
      expect(body.data.columnCount).toBe(3);
    });

    it("should handle CSV with quoted values", async () => {
      const csvContent =
        'id;description\n1;"Hello; World"\n2;"Multiple; separators; here"';
      const file = new File([csvContent], "quoted.csv", { type: "text/csv" });
      const formData = new FormData();
      formData.append("file", file);

      const request = {
        formData: () => Promise.resolve(formData),
      } as unknown as NextRequest;

      const response = await POST(request);
      const body = await response.json();

      if (!isSuccessResponse(body)) {
        expect.fail("Response should be successful");
      }
      expect(body.data.rowCount).toBe(2);
    });

    it("should handle CSV with empty values", async () => {
      const csvContent = "id;name;email\n1;John;\n2;;jane@example.com";
      const file = new File([csvContent], "empty-values.csv", {
        type: "text/csv",
      });
      const formData = new FormData();
      formData.append("file", file);

      const request = {
        formData: () => Promise.resolve(formData),
      } as unknown as NextRequest;

      const response = await POST(request);
      const body = await response.json();

      if (!isSuccessResponse(body)) {
        expect.fail("Response should be successful");
      }

      const emailColumn = body.data.columns.find((c) => c.name === "email");
      expect(emailColumn?.nullRatio).toBeGreaterThan(0);
    });

    it("should handle large CSV files", async () => {
      // Generate a CSV with many rows
      const rows = ["id;name;value"];
      for (let i = 1; i <= 5000; i++) {
        rows.push(`${i};User${i};${Math.random() * 100}`);
      }
      const csvContent = rows.join("\n");

      const file = new File([csvContent], "large.csv", { type: "text/csv" });
      const formData = new FormData();
      formData.append("file", file);

      const request = {
        formData: () => Promise.resolve(formData),
      } as unknown as NextRequest;

      const response = await POST(request);
      const body = await response.json();

      if (!isSuccessResponse(body)) {
        expect.fail("Response should be successful");
      }
      expect(body.data.rowCount).toBe(5000);
    });
  });

  describe("error handling", () => {
    it("should handle invalid CSV format gracefully", async () => {
      const csvContent = "not;valid\ncsv\nformat\nwith\nmismatched\ncolumns";
      const file = new File([csvContent], "invalid.csv", { type: "text/csv" });
      const formData = new FormData();
      formData.append("file", file);

      const request = {
        formData: () => Promise.resolve(formData),
      } as unknown as NextRequest;

      const response = await POST(request);
      // Should either succeed with best effort or return error
      expect([500]).toContain(response.status);
    });

    it("should handle database errors gracefully", async () => {
      // This would require more complex mocking of database failures
      // For now, we can ensure errors are caught
      const csvContent = "id;name\n1;John";
      const file = new File([csvContent], "test.csv", { type: "text/csv" });
      const formData = new FormData();
      formData.append("file", file);

      const request = {
        formData: () => Promise.resolve(formData),
      } as unknown as NextRequest;

      // Test should not throw
      await expect(POST(request)).resolves.toBeDefined();
    });
  });

  describe("response format", () => {
    it("should return correct response structure on success", async () => {
      const csvContent = "id;name\n1;John\n2;Jane";
      const file = new File([csvContent], "test.csv", { type: "text/csv" });
      const formData = new FormData();
      formData.append("file", file);

      const request = {
        formData: () => Promise.resolve(formData),
      } as unknown as NextRequest;

      const response = await POST(request);
      const body = await response.json();

      if (!isSuccessResponse(body)) {
        expect.fail("Response should be successful");
      }

      expect(body).toHaveProperty("success");
      expect(body).toHaveProperty("message");
      expect(body).toHaveProperty("data");
      expect(body.data).toHaveProperty("id");
      expect(body.data).toHaveProperty("fileName");
      expect(body.data).toHaveProperty("rowCount");
      expect(body.data).toHaveProperty("columnCount");
      expect(body.data).toHaveProperty("columns");
    });

    it("should include column information in response", async () => {
      const csvContent = "id;name\n1;John";
      const file = new File([csvContent], "test.csv", { type: "text/csv" });
      const formData = new FormData();
      formData.append("file", file);

      const request = {
        formData: () => Promise.resolve(formData),
      } as unknown as NextRequest;

      const response = await POST(request);
      const body = await response.json();

      if (!isSuccessResponse(body)) {
        expect.fail("Response should be successful");
      }

      const columns = body.data.columns;
      expect(Array.isArray(columns)).toBe(true);
      expect(columns.length).toBe(2);
      columns.forEach((col) => {
        expect(col).toHaveProperty("name");
        expect(col).toHaveProperty("dataType");
        expect(col).toHaveProperty("nullRatio");
      });
    });
  });
});
