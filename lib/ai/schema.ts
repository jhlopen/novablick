import { z } from "zod";

export const stepSchema = z.object({
  id: z.string(),
  label: z.enum(["read", "write", "search", "ask"]),
  description: z.string(),
  details: z.string(),
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

export const dataPartSchema = z.object({
  planDataPart,
  completedStepDataPart,
});

export type CustomDataPart = z.infer<typeof dataPartSchema>;
