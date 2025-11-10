import { z } from "zod";

export const stepSchema = z.object({
  id: z.string(),
  task: z.string(),
  instructions: z.string(),
  context: z.string(),
  tools: z.array(
    z.enum([
      "runCode",
      "queryDataset",
      "displayBarChart",
      "displayLineChart",
      "displayPieChart",
    ]),
  ),
});

export type Step = z.infer<typeof stepSchema>;

const planDataPart = z.object({
  steps: z.array(stepSchema),
});

const completedStepDataPart = z.object({
  id: z.string(),
  planId: z.uuid(),
  completed: z.boolean(),
});

const chartConfigSchema = z
  .object({
    metadata: z.object({
      type: z.enum(["bar", "line", "pie"]),
      title: z.string(),
      description: z.string(),
    }),
  })
  .catchall(
    z.object({
      label: z.string(),
    }),
  );

export const chartDataPart = z.object({
  data: z.array(z.record(z.string(), z.union([z.string(), z.number()]))),
  config: chartConfigSchema,
});

export const dataPartSchema = z.object({
  planDataPart,
  completedStepDataPart,
  chartDataPart,
});

export type CustomDataPart = z.infer<typeof dataPartSchema>;
