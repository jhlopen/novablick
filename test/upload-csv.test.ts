import { describe, it, expect } from "vitest";
import {
  inferDataType,
  consolidateDataTypes,
} from "@/app/api/upload-csv/route";

describe("CSV Upload Utilities", () => {
  describe("inferDataType", () => {
    describe("integer detection", () => {
      it("should detect positive integers", () => {
        expect(inferDataType("42")).toBe("integer");
        expect(inferDataType("0")).toBe("integer");
        expect(inferDataType("1000")).toBe("integer");
      });

      it("should detect negative integers", () => {
        expect(inferDataType("-5")).toBe("integer");
        expect(inferDataType("-100")).toBe("integer");
      });
    });

    describe("number detection", () => {
      it("should detect positive decimals", () => {
        expect(inferDataType("3.14")).toBe("number");
        expect(inferDataType("0.5")).toBe("number");
        expect(inferDataType("123.456")).toBe("number");
      });

      it("should detect negative decimals", () => {
        expect(inferDataType("-3.14")).toBe("number");
        expect(inferDataType("-0.5")).toBe("number");
      });

      it("should detect scientific notation", () => {
        expect(inferDataType("1e10")).toBe("integer");
        expect(inferDataType("1.5e-5")).toBe("number");
      });
    });

    describe("boolean detection", () => {
      it("should detect true/false", () => {
        expect(inferDataType("true")).toBe("boolean");
        expect(inferDataType("false")).toBe("boolean");
        expect(inferDataType("TRUE")).toBe("boolean");
        expect(inferDataType("FALSE")).toBe("boolean");
      });

      it("should detect yes/no", () => {
        expect(inferDataType("yes")).toBe("boolean");
        expect(inferDataType("no")).toBe("boolean");
        expect(inferDataType("YES")).toBe("boolean");
        expect(inferDataType("NO")).toBe("boolean");
      });

      it("should detect 1/0 as boolean", () => {
        expect(inferDataType("1")).toBe("integer");
        expect(inferDataType("0")).toBe("integer");
      });
    });

    describe("date detection", () => {
      it("should detect ISO date format (YYYY-MM-DD)", () => {
        expect(inferDataType("2024-01-15")).toBe("date");
        expect(inferDataType("2023-12-31")).toBe("date");
        expect(inferDataType("2000-01-01")).toBe("date");
      });

      it("should detect US date format (MM/DD/YYYY)", () => {
        expect(inferDataType("01/15/2024")).toBe("date");
        expect(inferDataType("12/31/2023")).toBe("date");
      });

      it("should not detect invalid dates", () => {
        expect(inferDataType("not-a-date")).toBe("string");
        expect(inferDataType("2024-13-01")).toBe("string"); // Invalid month
      });
    });

    describe("string detection", () => {
      it("should detect regular strings", () => {
        expect(inferDataType("hello")).toBe("string");
        expect(inferDataType("Hello World")).toBe("string");
        expect(inferDataType("test@example.com")).toBe("string");
      });

      it("should detect strings with special characters", () => {
        expect(inferDataType("hello@world")).toBe("string");
        expect(inferDataType("test-value")).toBe("string");
        expect(inferDataType("value_123")).toBe("string");
      });
    });

    describe("edge cases", () => {
      it("should handle empty strings", () => {
        expect(inferDataType("")).toBe("unknown");
      });

      it("should handle whitespace-only strings", () => {
        expect(inferDataType("   ")).toBe("unknown");
      });

      it("should handle null and undefined", () => {
        expect(inferDataType(null as unknown as string)).toBe("unknown");
        expect(inferDataType(undefined as unknown as string)).toBe("unknown");
      });

      it("should handle strings with leading/trailing whitespace", () => {
        expect(inferDataType(" 42 ")).toBe("integer");
        expect(inferDataType(" true ")).toBe("boolean");
        expect(inferDataType(" hello ")).toBe("string");
      });

      it("should handle mixed alphanumeric", () => {
        expect(inferDataType("abc123")).toBe("string");
        expect(inferDataType("123abc")).toBe("string");
      });
    });
  });

  describe("consolidateDataTypes", () => {
    it("should return single type when all samples are the same", () => {
      expect(consolidateDataTypes(["integer", "integer", "integer"])).toBe(
        "integer",
      );
      expect(consolidateDataTypes(["string", "string"])).toBe("string");
      expect(consolidateDataTypes(["boolean"])).toBe("boolean");
    });

    it("should filter out unknown types", () => {
      expect(
        consolidateDataTypes(["integer", "unknown", "integer", "unknown"]),
      ).toBe("integer");
      expect(consolidateDataTypes(["unknown", "string", "unknown"])).toBe(
        "string",
      );
    });

    it("should default to string when all types are unknown", () => {
      expect(consolidateDataTypes(["unknown", "unknown"])).toBe("string");
      expect(consolidateDataTypes(["unknown"])).toBe("string");
    });

    it("should default to string when types are mixed", () => {
      expect(consolidateDataTypes(["integer", "string"])).toBe("string");
      expect(consolidateDataTypes(["number", "boolean", "date"])).toBe(
        "string",
      );
      expect(consolidateDataTypes(["integer", "number", "string"])).toBe(
        "string",
      );
    });

    it("should handle empty array", () => {
      expect(consolidateDataTypes([])).toBe("string");
    });

    it("should handle array with single unknown", () => {
      expect(consolidateDataTypes(["unknown"])).toBe("string");
    });

    it("should deduplicate types before consolidating", () => {
      expect(
        consolidateDataTypes([
          "integer",
          "integer",
          "integer",
          "integer",
          "integer",
        ]),
      ).toBe("integer");
    });
  });
});
