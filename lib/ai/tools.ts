import { tool } from "ai";
import { loadPyodide } from "pyodide";
import z from "zod";
import { db } from "@/lib/db";
import { sql } from "drizzle-orm";

export const TOOL_DESCRIPTIONS = {
  runCode: "Execute Python code.",
  queryDataset: "Query datasets using SQL SELECT queries.",
};

const OUTPUT_HANDLERS = {
  matplotlib: `
      import io
      import base64
      from matplotlib import pyplot as plt
  
      # Clear any existing plots
      plt.clf()
      plt.close('all')
  
      # Switch to agg backend
      plt.switch_backend('agg')
  
      def setup_matplotlib_output():
          def custom_show():
              if plt.gcf().get_size_inches().prod() * plt.gcf().dpi ** 2 > 25_000_000:
                  print("Warning: Plot size too large, reducing quality")
                  plt.gcf().set_dpi(100)
  
              png_buf = io.BytesIO()
              plt.savefig(png_buf, format='png')
              png_buf.seek(0)
              png_base64 = base64.b64encode(png_buf.read()).decode('utf-8')
              print(f'data:image/png;base64,{png_base64}')
              png_buf.close()
  
              plt.clf()
              plt.close('all')
  
          plt.show = custom_show
    `,
  basic: `
      # Basic output capture setup
    `,
};

function detectRequiredHandlers(code: string): string[] {
  const handlers: string[] = ["basic"];

  if (code.includes("matplotlib") || code.includes("plt.")) {
    handlers.push("matplotlib");
  }

  return handlers;
}

export const runCode = tool({
  description: "Execute Python code. SQL queries are not supported.",
  inputSchema: z.object({
    python_code: z.string(),
  }),
  execute: async ({ python_code }) => {
    const outputContent: string[] = [];

    try {
      const pyodide = await loadPyodide();

      pyodide.setStdout({
        batched: (output: string) => {
          outputContent.push(output);
        },
      });

      await pyodide.loadPackagesFromImports(python_code, {
        messageCallback: (message: string) => {
          outputContent.push(message);
        },
      });

      const requiredHandlers = detectRequiredHandlers(python_code);
      for (const handler of requiredHandlers) {
        if (OUTPUT_HANDLERS[handler as keyof typeof OUTPUT_HANDLERS]) {
          await pyodide.runPythonAsync(
            OUTPUT_HANDLERS[handler as keyof typeof OUTPUT_HANDLERS],
          );

          if (handler === "matplotlib") {
            await pyodide.runPythonAsync("setup_matplotlib_output()");
          }
        }
      }

      const result = await pyodide.runPythonAsync(python_code);
      outputContent.push("result: " + result);
    } catch (error) {
      outputContent.push("error: " + error);
    }

    return { outputContent };
  },
});

/**
 * Validates SQL query for security
 * - Only allows SELECT queries
 * - Checks that query only references allowed dataset IDs
 * - Prevents common SQL injection patterns
 */
function validateSQLQuery(
  query: string,
  allowedDatasetIds: string[],
): { valid: boolean; error?: string } {
  const normalizedQuery = query.trim().toLowerCase();

  // Only allow SELECT queries
  if (!normalizedQuery.startsWith("select")) {
    return {
      valid: false,
      error:
        "Only SELECT queries are allowed. UPDATE, DELETE, DROP, INSERT, and other operations are forbidden.",
    };
  }

  // Block dangerous SQL keywords
  const dangerousKeywords = [
    "insert",
    "update",
    "delete",
    "drop",
    "truncate",
    "alter",
    "create",
    "exec",
    "execute",
    "grant",
    "revoke",
  ];

  for (const keyword of dangerousKeywords) {
    // Use word boundaries to match whole words only
    const regex = new RegExp(`\\b${keyword}\\b`, "i");
    if (regex.test(query)) {
      return {
        valid: false,
        error: `Forbidden SQL keyword detected: ${keyword.toUpperCase()}. Only SELECT queries are allowed.`,
      };
    }
  }

  // Check if query references dataset_rows table
  if (!normalizedQuery.includes("dataset_rows")) {
    return {
      valid: false,
      error: 'Query must reference the "dataset_rows" table.',
    };
  }

  // Extract potential dataset IDs from WHERE clauses
  // Look for patterns like: dataset_id = 'uuid' or dataset_id IN ('uuid1', 'uuid2')
  const datasetIdPattern =
    /dataset_id\s*(?:=|in)\s*\(?['"]([a-f0-9-]+)['"]\)?/gi;
  const matches = [...query.matchAll(datasetIdPattern)];

  if (matches.length === 0) {
    return {
      valid: false,
      error: `Query must filter by dataset_id in the WHERE clause. You can only query these datasets: ${allowedDatasetIds.join(", ")}`,
    };
  }

  // Validate all referenced dataset IDs are in the allowed list
  for (const match of matches) {
    const referencedId = match[1];
    if (!allowedDatasetIds.includes(referencedId)) {
      return {
        valid: false,
        error: `Access denied: Dataset ID "${referencedId}" is not in the allowed list. Allowed IDs: ${allowedDatasetIds.join(", ")}`,
      };
    }
  }

  return { valid: true };
}

export const createQueryDatasetTool = (allowedDatasetIds: string[]) =>
  tool({
    description: `Query a dataset using SQL SELECT queries.

**Allowed Dataset IDs:** ${allowedDatasetIds.join(", ")}

**Database Schema:**
- Table: "dataset_rows" with columns:
  - id (uuid): Row identifier
  - dataset_id (uuid): Dataset this row belongs to
  - row_number (integer): Original row number from CSV
  - data (jsonb): Row data stored as JSON object

**JSONB Operators:**
- Get text value: data->>'column_name'
- Get JSON value: data->'column_name'
- Cast to numeric: (data->>'age')::int or (data->>'price')::numeric
- Cast to boolean: (data->>'active')::boolean

**Query Requirements:**
- Must be a SELECT query (read-only)
- Must include WHERE clause with dataset_id filter
- Automatically limited to 1000 rows if no LIMIT specified

**Example Queries:**

Simple fetch all:
SELECT data FROM dataset_rows WHERE dataset_id = '${allowedDatasetIds[0] || "dataset-uuid"}' LIMIT 100

Select specific columns:
SELECT data->>'name', data->>'age', data->>'city' FROM dataset_rows WHERE dataset_id = '${allowedDatasetIds[0] || "dataset-uuid"}'

Filter rows:
SELECT * FROM dataset_rows WHERE dataset_id = '${allowedDatasetIds[0] || "dataset-uuid"}' AND data->>'status' = 'active'

Aggregate data:
SELECT data->>'category', COUNT(*), AVG((data->>'price')::numeric) FROM dataset_rows WHERE dataset_id = '${allowedDatasetIds[0] || "dataset-uuid"}' GROUP BY data->>'category'

Sort results:
SELECT data->>'name', (data->>'score')::int FROM dataset_rows WHERE dataset_id = '${allowedDatasetIds[0] || "dataset-uuid"}' ORDER BY (data->>'score')::int DESC LIMIT 10`,
    inputSchema: z.object({
      sqlQuery: z
        .string()
        .describe(
          "SQL SELECT query to execute. Must query dataset_rows table and filter by dataset_id. Only SELECT queries allowed.",
        ),
    }),
    execute: async ({ sqlQuery }) => {
      try {
        // Validate the SQL query
        const validation = validateSQLQuery(sqlQuery, allowedDatasetIds);
        if (!validation.valid) {
          return {
            success: false,
            error: validation.error,
            rows: null,
          };
        }

        // Execute the SQL query with a safety limit
        const query = sqlQuery.toLowerCase().includes("limit")
          ? sqlQuery
          : `${sqlQuery} LIMIT 1000`;

        const result = await db.execute(sql.raw(query));

        return {
          success: true,
          rowCount: result.rows.length,
          rows: result.rows,
          message: `Successfully executed SQL query and returned ${result.rows.length} rows.`,
        };
      } catch (error) {
        return {
          success: false,
          error: error instanceof Error ? error.message : "Unknown error",
          rows: null,
        };
      }
    },
  });
