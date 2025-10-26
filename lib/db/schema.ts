import {
  pgTable,
  integer,
  timestamp,
  jsonb,
  uuid,
  index,
  varchar,
  boolean,
  real,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// Main datasets table - stores metadata about each CSV file
export const datasets = pgTable(
  "datasets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    fileName: varchar("file_name", { length: 255 }).notNull(),
    rowCount: integer("row_count").notNull().default(0),
    columnCount: integer("column_count").notNull().default(0),
    fileSizeBytes: integer("file_size_bytes"),
    delimiter: varchar("delimiter", { length: 10 }).default(","),
    hasHeader: boolean("has_header").default(true),
    metadata: jsonb("metadata"), // Store any additional metadata
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    nameIdx: index("datasets_name_idx").on(table.name),
    createdAtIdx: index("datasets_created_at_idx").on(table.createdAt),
  }),
);

// Column definitions for each dataset
export const datasetColumns = pgTable(
  "dataset_columns",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 255 }).notNull(),
    position: integer("position").notNull(), // Column order in CSV
    dataType: varchar("data_type", { length: 50 }).notNull(), // 'string', 'number', 'boolean', 'date', etc.
    nullRatio: real("null_ratio").default(0), // Ratio of null values (0.0 to 1.0, where 1.0 = 100% null)
    uniqueValues: integer("unique_values"), // Number of unique values (useful for stats)
    metadata: jsonb("metadata"), // Store column-specific metadata (e.g., min, max, avg for numbers)
  },
  (table) => ({
    datasetIdIdx: index("dataset_columns_dataset_id_idx").on(table.datasetId),
    positionIdx: index("dataset_columns_position_idx").on(
      table.datasetId,
      table.position,
    ),
  }),
);

// Store actual data rows - using JSONB for flexibility
export const datasetRows = pgTable(
  "dataset_rows",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    datasetId: uuid("dataset_id")
      .notNull()
      .references(() => datasets.id, { onDelete: "cascade" }),
    rowNumber: integer("row_number").notNull(), // Original row number in CSV
    data: jsonb("data").notNull(), // Store row data as JSON: { "column_name": "value" }
  },
  (table) => ({
    datasetIdIdx: index("dataset_rows_dataset_id_idx").on(table.datasetId),
    rowNumberIdx: index("dataset_rows_row_number_idx").on(
      table.datasetId,
      table.rowNumber,
    ),
    dataGinIdx: index("dataset_rows_data_gin_idx").using("gin", table.data), // GIN index for JSON queries
  }),
);

// Relations
export const datasetsRelations = relations(datasets, ({ many }) => ({
  columns: many(datasetColumns),
  rows: many(datasetRows),
}));

export const datasetColumnsRelations = relations(datasetColumns, ({ one }) => ({
  dataset: one(datasets, {
    fields: [datasetColumns.datasetId],
    references: [datasets.id],
  }),
}));

export const datasetRowsRelations = relations(datasetRows, ({ one }) => ({
  dataset: one(datasets, {
    fields: [datasetRows.datasetId],
    references: [datasets.id],
  }),
}));

// TypeScript types
export type Dataset = typeof datasets.$inferSelect;
export type NewDataset = typeof datasets.$inferInsert;
export type DatasetColumn = typeof datasetColumns.$inferSelect;
export type NewDatasetColumn = typeof datasetColumns.$inferInsert;
export type DatasetRow = typeof datasetRows.$inferSelect;
export type NewDatasetRow = typeof datasetRows.$inferInsert;
