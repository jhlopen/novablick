import { openai } from "@ai-sdk/openai";
import {
  UIMessage,
  convertToModelMessages,
  Experimental_Agent as Agent,
  tool,
  stepCountIs,
} from "ai";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { z } from "zod";
import { db } from "@/lib/db";
import { datasetColumns } from "@/lib/db/schema";
import { inArray, sql } from "drizzle-orm";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

// Type definitions for dataset metadata
interface DatasetColumnMetadata {
  datasetId: string;
  datasetName: string;
  columnName: string;
  dataType: string;
  position: number;
  nullRatio: number;
  uniqueValueCount: number | null;
  uniqueValues: unknown[] | null;
  metadata: Record<string, unknown> | null;
}

/**
 * Load datasets with their column metadata and flatten into an array
 * @param datasetInputs Array of dataset IDs and names
 * @returns Array of column metadata for all datasets
 */
async function loadDatasetsWithColumnMetadata(
  datasetInputs: { id: string; name: string }[],
): Promise<DatasetColumnMetadata[]> {
  if (datasetInputs.length === 0) {
    return [];
  }

  const datasetIds = datasetInputs.map((d) => d.id);

  // Fetch all columns for the specified datasets in one query
  const columns = await db
    .select({
      id: datasetColumns.id,
      datasetId: datasetColumns.datasetId,
      name: datasetColumns.name,
      position: datasetColumns.position,
      dataType: datasetColumns.dataType,
      nullRatio: datasetColumns.nullRatio,
      uniqueValues: datasetColumns.uniqueValues,
      uniqueValueCount: datasetColumns.uniqueValueCount,
      metadata: datasetColumns.metadata,
    })
    .from(datasetColumns)
    .where(inArray(datasetColumns.datasetId, datasetIds))
    .orderBy(datasetColumns.datasetId, datasetColumns.position);

  // Create a map of dataset IDs to names for quick lookup
  const datasetNameMap = new Map(datasetInputs.map((d) => [d.id, d.name]));

  // Transform columns into the desired format
  const columnMetadata: DatasetColumnMetadata[] = columns.map((col) => ({
    datasetId: col.datasetId,
    datasetName: datasetNameMap.get(col.datasetId) || "Unknown",
    columnName: col.name,
    dataType: col.dataType,
    position: col.position,
    nullRatio: col.nullRatio || 0,
    uniqueValueCount: col.uniqueValueCount,
    uniqueValues: col.uniqueValues as unknown[] | null,
    metadata: col.metadata as Record<string, unknown> | null,
  }));

  return columnMetadata;
}

/**
 * Build a system prompt that includes dataset and column information
 * @param columnMetadata Array of column metadata for all datasets
 * @param filters Current filter state
 * @returns System prompt string
 */
function buildSystemPrompt(
  columnMetadata: DatasetColumnMetadata[],
  filters: {
    [columnName: string]: {
      type: "date" | "categorical";
      values: string[];
      dateRange?: { from: string; to: string };
    };
  },
): string {
  let prompt = `You are a helpful data analyst with access to the following datasets and columns:\n\n`;

  if (columnMetadata.length === 0) {
    prompt += "No datasets are currently selected.\n";
    return prompt;
  }

  // Group columns by dataset
  const datasetGroups = new Map<string, DatasetColumnMetadata[]>();
  for (const col of columnMetadata) {
    if (!datasetGroups.has(col.datasetId)) {
      datasetGroups.set(col.datasetId, []);
    }
    datasetGroups.get(col.datasetId)!.push(col);
  }

  // Format each dataset
  let datasetIndex = 1;
  for (const [datasetId, columns] of datasetGroups.entries()) {
    const datasetName = columns[0].datasetName;
    prompt += `Dataset ${datasetIndex}: "${datasetName}" (ID: ${datasetId})\n`;
    prompt += `Columns (${columns.length}):\n`;

    for (const col of columns) {
      prompt += `  - ${col.columnName} (${col.dataType})`;

      // Add null ratio if significant
      if (col.nullRatio > 0.01) {
        prompt += ` [${(col.nullRatio * 100).toFixed(1)}% null]`;
      }

      // Add unique value count if available
      if (col.uniqueValueCount !== null) {
        prompt += ` [${col.uniqueValueCount} unique values]`;
      }

      // Add sample unique values if available and not too many
      if (
        col.uniqueValues &&
        Array.isArray(col.uniqueValues) &&
        col.uniqueValues.length > 0 &&
        col.uniqueValues.length <= 20
      ) {
        const sampleValues = col.uniqueValues
          .slice(0, 10)
          .map((v: unknown) => JSON.stringify(v))
          .join(", ");
        prompt += ` [e.g., ${sampleValues}${col.uniqueValues.length > 10 ? ", ..." : ""}]`;
      }

      // Add numeric metadata if available
      if (col.metadata && col.dataType === "number") {
        const meta = col.metadata as Record<string, unknown>;
        if (typeof meta.min === "number" && typeof meta.max === "number") {
          prompt += ` [range: ${meta.min} to ${meta.max}]`;
        }
        if (typeof meta.mean === "number") {
          prompt += ` [mean: ${meta.mean.toFixed(2)}]`;
        }
      }

      prompt += `\n`;
    }

    prompt += `\n`;
    datasetIndex++;
  }

  // Add filter information if any filters are active
  const activeFilters = Object.entries(filters);
  if (activeFilters.length > 0) {
    prompt += `\nActive Filters:\n`;
    for (const [columnName, filter] of activeFilters) {
      if (filter.type === "categorical" && filter.values.length > 0) {
        prompt += `  - ${columnName}: ${filter.values.join(", ")}\n`;
      } else if (filter.type === "date" && filter.dateRange) {
        prompt += `  - ${columnName}: from ${filter.dateRange.from} to ${filter.dateRange.to}\n`;
      }
    }
    prompt += `\n`;
  }

  prompt += `\nIMPORTANT: When writing SQL queries:\n`;
  prompt += `- Query the 'dataset_rows' table which has these columns: id (uuid), dataset_id (uuid), row_number (integer), data (jsonb)\n`;
  prompt += `- All the actual dataset column values are stored in the 'data' JSONB column\n`;
  prompt += `- Access column values using the ->> operator: data->>'column_name'\n`;
  prompt += `- Example: SELECT data->>'brand_name' as brand, data->>'price' as price FROM dataset_rows WHERE data->>'category' = 'electronics'\n`;
  prompt += `- For numeric operations, use SAFE casting with regex validation:\n`;
  prompt += `  CASE WHEN data->>'field' ~ '^[0-9]*\\.?[0-9]+$' THEN (data->>'field')::numeric ELSE NULL END\n`;
  prompt += `- CRITICAL: When filtering or ordering by numeric fields, always filter out NULL, empty strings, and non-numeric values:\n`;
  prompt += `  WHERE data->>'field' IS NOT NULL AND data->>'field' != '' AND data->>'field' ~ '^[0-9]*\\.?[0-9]+$'\n`;
  prompt += `- The regex pattern '^[0-9]*\\.?[0-9]+$' matches valid numeric strings (integers and decimals)\n`;
  prompt += `- The dataset_id filter will be automatically applied to limit results to selected datasets\n`;
  prompt += `\nFocus on providing clear, accurate analysis based on the available columns and their data types.\n`;

  return prompt;
}

export async function POST(req: Request) {
  const {
    messages,
    datasets,
    filters,
  }: {
    messages: UIMessage[];
    datasets: { id: string; name: string }[];
    filters: {
      [columnName: string]: {
        type: "date" | "categorical";
        values: string[];
        dateRange?: { from: string; to: string };
      };
    };
  } = await req.json();

  // load datasets with column metadata
  const datasetsWithColumnMetadata =
    await loadDatasetsWithColumnMetadata(datasets);

  // Build system prompt with dataset information
  const systemPrompt = buildSystemPrompt(datasetsWithColumnMetadata, filters);

  const agent = new Agent({
    model: openai("gpt-4o"),
    system: systemPrompt,
    tools: {
      queryDatabase: tool({
        description:
          "Execute a SQL query against the PostgreSQL database. Limited to the selected datasets. The query should be written against the 'dataset_rows' table which has columns: id (uuid), dataset_id (uuid), row_number (integer), and data (jsonb). The 'data' column contains the actual row data as JSON. Use -> or ->> operators to access JSON fields.",
        inputSchema: z.object({
          sql_query: z.string(),
        }),
        execute: async ({ sql_query }) => {
          try {
            const datasetIds = datasets.map((d) => d.id);

            if (datasetIds.length === 0) {
              return {
                error:
                  "No datasets selected. Please select at least one dataset to query.",
                rows: [],
              };
            }

            // Validate that the query is a SELECT statement (basic security)
            const trimmedQuery = sql_query.trim().toLowerCase();
            if (!trimmedQuery.startsWith("select")) {
              return {
                error: "Only SELECT queries are allowed.",
                rows: [],
              };
            }

            // Strip trailing semicolon if present
            let cleanQuery = sql_query.trim();
            if (cleanQuery.endsWith(";")) {
              cleanQuery = cleanQuery.slice(0, -1);
            }

            // Replace any hardcoded dataset_id filters with our allowed list
            // This regex finds WHERE clauses with dataset_id = 'uuid' and replaces them
            const datasetIdPattern = /dataset_id\s*=\s*'[^']+'/gi;
            const hasDatasetFilter = datasetIdPattern.test(cleanQuery);

            let modifiedQuery = cleanQuery;
            if (hasDatasetFilter) {
              // Replace existing dataset_id filter with our allowed list
              modifiedQuery = cleanQuery.replace(
                datasetIdPattern,
                `dataset_id = ANY(ARRAY[${datasetIds.map((id) => `'${id}'`).join(", ")}]::uuid[])`,
              );
            } else {
              // Add dataset_id filter to WHERE clause or create one
              const wherePattern = /\bWHERE\b/i;
              if (wherePattern.test(modifiedQuery)) {
                // Add to existing WHERE clause
                modifiedQuery = modifiedQuery.replace(
                  wherePattern,
                  `WHERE dataset_id = ANY(ARRAY[${datasetIds.map((id) => `'${id}'`).join(", ")}]::uuid[]) AND`,
                );
              } else {
                // Add WHERE clause before ORDER BY, GROUP BY, or LIMIT if present
                const beforeClausePattern =
                  /\b(ORDER\s+BY|GROUP\s+BY|LIMIT|OFFSET)\b/i;
                const match = beforeClausePattern.exec(modifiedQuery);
                if (match) {
                  const insertPos = match.index;
                  modifiedQuery =
                    modifiedQuery.slice(0, insertPos) +
                    `WHERE dataset_id = ANY(ARRAY[${datasetIds.map((id) => `'${id}'`).join(", ")}]::uuid[]) ` +
                    modifiedQuery.slice(insertPos);
                } else {
                  // Add at the end
                  modifiedQuery += ` WHERE dataset_id = ANY(ARRAY[${datasetIds.map((id) => `'${id}'`).join(", ")}]::uuid[])`;
                }
              }
            }

            // Add LIMIT if not present to prevent runaway queries
            if (!/\bLIMIT\b/i.test(modifiedQuery)) {
              modifiedQuery += " LIMIT 1000";
            }

            // Execute the raw SQL query with Drizzle
            const query = sql.raw(modifiedQuery);
            const result = await db.execute(query);

            console.log(`Original SQL query: ${sql_query}`);
            console.log(`Modified SQL query: ${modifiedQuery}`);
            console.log(`Filtered to datasets: ${datasetIds.join(", ")}`);
            console.log(`Returned ${result.rows.length} rows`);

            return {
              rows: result.rows,
              rowCount: result.rows.length,
              query: sql_query,
            };
          } catch (error: unknown) {
            console.error("SQL query error:", error);
            return {
              error: `SQL Error: ${error instanceof Error ? error.message : String(error)}`,
              rows: [],
            };
          }
        },
      }),
      runCode: tool({
        description: "Execute Python code. SQL queries are not supported.",
        inputSchema: z.object({
          python_code: z.string(),
        }),
        execute: async ({ python_code }) => {
          const transport = new StreamableHTTPClientTransport(
            new URL(process.env.MCP_RUN_PYTHON_URL!),
          );

          const client = new Client({
            name: "streamable-http-client",
            version: "1.0.0",
          });

          await client.connect(transport);

          const output = await client.callTool({
            name: "run_python_code",
            arguments: {
              python_code,
            },
          });

          console.log("!!!", output);

          return { output };
        },
      }),
    },
    stopWhen: stepCountIs(20),
  });

  const stream = agent.stream({ messages: convertToModelMessages(messages) });

  // send reasoning back to the client
  return stream.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
