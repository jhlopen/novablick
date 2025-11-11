import { openai } from "@ai-sdk/openai";
import {
  streamText,
  UIMessage,
  UIMessageStreamWriter,
  convertToModelMessages,
  generateText,
  generateObject,
  stepCountIs,
  streamObject,
  ModelMessage,
  Tool,
} from "ai";
import { v4 as uuidv4 } from "uuid";
import { z } from "zod";
import { CustomDataPart, Step, stepSchema } from "./schema";
import {
  runCode,
  createQueryDatasetTool,
  TOOL_DESCRIPTIONS,
  createDisplayBarChartTool,
  createDisplayLineChartTool,
  createDisplayPieChartTool,
} from "@/lib/ai/tools";
import { Dataset } from "@/lib/db/schema";

const REASONING_MODEL = "gpt-5-nano";
const NON_REASONING_MODEL = "gpt-4.1";

const SYSTEM_PROMPT = `You are an agentic data analyst, powered by the best large language model. You operate in Novablick, a web application for tabular data analysis and visualization.

You are assisting a USER to understand their datasets. Each time the USER sends a message, we may automatically attach some information about their current state, such as what datasets they have selected, what they are looking at, and more. This information may or may not be relevant to the user's query, it is up for you to decide. Autonomously decide to the best of your ability before coming back to the user. Bias towards not asking the user for help if you can find the answer yourself.

<communication>
You are especially knowledgeable about the pharmaceutical industry, e.g. "ACTs" refer to "appropriate comparative therapies". However, do not presume and make sure to gather the data with the tool \`queryDataset\`. Be smart and infer the user's intent even if the request does not match exactly the column names.
DO NOT use code e.g. Plotly, Matplotlib, etc. to generate visualizations or ascii charts.
When displaying data, always use one of the following tools: \`displayBarChart\`, \`displayLineChart\`, \`displayPieChart\`.
</communication>
`;

export const streamAgent = async ({
  writer,
  messages,
  selectedDatasets,
}: {
  writer: UIMessageStreamWriter<UIMessage<unknown, CustomDataPart>>;
  messages: UIMessage[];
  selectedDatasets: Dataset[];
}) => {
  const selectedFileNames = selectedDatasets.map(
    (dataset) => `${dataset.fileName} (id: ${dataset.id})`,
  );
  const allowedDatasetIds = selectedDatasets.map((dataset) => dataset.id);
  const queryDataset = createQueryDatasetTool(allowedDatasetIds);
  const displayBarChart = createDisplayBarChartTool(writer);
  const displayLineChart = createDisplayLineChartTool(writer);
  const displayPieChart = createDisplayPieChartTool(writer);
  const availableTools = {
    runCode,
    queryDataset,
    displayBarChart,
    displayLineChart,
    displayPieChart,
  };
  const modelMessages: ModelMessage[] = convertToModelMessages(messages).map(
    (message) => {
      if (message.role === "assistant" && !message.providerOptions) {
        return {
          ...message,
          content: Array.isArray(message.content)
            ? message.content.map((part) =>
                part.type === "reasoning" && !part.providerOptions
                  ? { type: "text", text: part.text }
                  : part,
              )
            : message.content,
        };
      }
      return message;
    },
  );

  const reasoningId = uuidv4();
  writer.write({
    type: "reasoning-start",
    id: reasoningId,
  });

  // Step 1: Decide if planning is needed
  console.info("Step 1: Decide if planning is needed");
  const { object: planDecision } = await generateObject({
    model: openai(NON_REASONING_MODEL),
    messages: modelMessages,
    schema: z.object({
      requiresPlanning: z.boolean(),
      reasoning: z.string(),
    }),
    system: `Determine if this query requires multi-step planning or can be answered directly. Simple queries (greetings, clarifications, calculations) don't need planning. Complex queries (data analysis, multi-step reasoning) do.${
      selectedFileNames.length > 0
        ? ` The following datasets are selected by the user: ${selectedFileNames.join(", ")}.
        Unless explicitly mentioned, assume the user's query is about the selected datasets/files.`
        : ""
    }`,
  });
  writer.write({
    type: "reasoning-delta",
    id: reasoningId,
    delta: planDecision.reasoning,
  });
  writer.write({
    type: "reasoning-end",
    id: reasoningId,
  });

  // Step 2a: Respond directly if no planning needed
  if (!planDecision.requiresPlanning) {
    console.info("Step 2: Respond directly (no planning needed)");
    const result = streamText({
      model: openai(NON_REASONING_MODEL),
      messages: modelMessages,
      system: SYSTEM_PROMPT,
      tools: availableTools,
      stopWhen: stepCountIs(5),
    });

    writer.merge(result.toUIMessageStream({ sendStart: false }));
    return;
  }

  // Step 2b: Generate plan
  console.info("Step 2: Generate a plan");
  const { elementStream } = streamObject({
    model: openai(NON_REASONING_MODEL),
    output: "array",
    messages: modelMessages,
    schema: stepSchema,
    system: `${SYSTEM_PROMPT}
    Create an execution plan to solve the user's query. Break down the execution into multiple steps (ideally 3-6 steps). Keep the task name concise without long words. Keep the task instructions to the point. ${selectedFileNames.length > 0 ? `The following datasets are selected and can be queried with the tool 'queryDataset': ${selectedFileNames.join(", ")}. ` : ""}Assign the following tools to each step if necessary:
    ${Object.keys(availableTools)
      .map(
        (tool) => `Tool name: ${tool}
      Tool description: ${TOOL_DESCRIPTIONS[tool as keyof typeof TOOL_DESCRIPTIONS]}`,
      )
      .join("\n\n")}
    
    Always display the most suitable chart based on the user's query, unless requested otherwise. Keep to one tool per step, and not all tools are required.
    Summarize all relevant information for each task as \`context\` so that the subagent has what they need to complete the task.`,
  });
  const planId = uuidv4();
  const steps: Step[] = [];
  writer.write({
    type: "data-planDataPart",
    data: { steps },
    id: planId,
  });
  for await (const step of elementStream) {
    steps.push(step);
    writer.write({
      type: "data-planDataPart",
      data: { steps },
      id: planId,
    });
  }

  // Step 2c: Respond directly if the plan is empty
  if (steps.length === 0) {
    console.info("Respond directly (empty plan)");
    const result = streamText({
      model: openai(REASONING_MODEL),
      messages: modelMessages,
      system: `${SYSTEM_PROMPT}
      Planning was attempted but failed, so please respond directly to the user's query using the available tools as needed.`,
      tools: availableTools,
      stopWhen: stepCountIs(5),
    });

    writer.merge(result.toUIMessageStream({ sendStart: false }));
    return;
  }

  // Step 3: Execute each step in the plan
  console.info("Step 3: Execute each step in the plan");
  const executionMessages: ModelMessage[] = [];
  for (const step of steps) {
    console.info(`Executing step: ${step.task}`);
    const stepId = uuidv4();
    writer.write({
      type: "data-completedStepDataPart",
      data: { id: step.id, planId, completed: false },
      id: stepId,
    });

    const tools = step.tools.reduce(
      (acc, toolName) => {
        if (toolName in availableTools) {
          acc[toolName] =
            availableTools[toolName as keyof typeof availableTools];
        }
        return acc;
      },
      {} as Record<string, Tool>,
    );

    const result = await generateText({
      model: openai(NON_REASONING_MODEL),
      messages: [
        {
          role: "user",
          content: `Context from the main agent: ${step.context}
        Context from previous steps: ${executionMessages.map((message) => message.content).join("\n")}
        Execute this task immediately: ${step.task}.
        Detailed instructions: ${step.instructions}`,
        },
      ],
      system: `DO NOT ask clarifying questions.
      DO NOT rely on general knowledge.
      MUST USE information from the provided context, especially from the previous steps.
      ${step.tools.length > 0 ? " Use all provided tools intelligently to complete the task." : ""}`,
      tools,
      toolChoice:
        step.tools.length === 1 &&
        (step.tools[0] === "displayBarChart" ||
          step.tools[0] === "displayLineChart" ||
          step.tools[0] === "displayPieChart")
          ? "required"
          : "auto",
      stopWhen: stepCountIs(3),
      prepareStep: async ({ steps }) => {
        if (
          steps.some((step) =>
            step.toolResults.some(
              (result) =>
                (result.toolName === "displayBarChart" ||
                  result.toolName === "displayLineChart" ||
                  result.toolName === "displayPieChart") &&
                result.output === "Chart displayed successfully.",
            ),
          )
        ) {
          return { toolChoice: "auto" };
        }
      },
    });

    executionMessages.push(...result.response.messages);
    const lastAssistantMessage = result.response.messages.findLast(
      (message) => message.role === "assistant",
    );
    if (lastAssistantMessage) {
      modelMessages.push(lastAssistantMessage);
    }

    writer.write({
      type: "data-completedStepDataPart",
      data: { id: step.id, planId, completed: true },
      id: stepId,
    });
  }

  // Step 4: Final synthesis
  console.info("Step 4: Final synthesis");
  const result = streamText({
    model: openai(NON_REASONING_MODEL),
    messages: modelMessages,
    system: `${SYSTEM_PROMPT}
    Synthesize the results from all steps into a coherent answer to the user's query.`,
  });

  writer.merge(
    result.toUIMessageStream({
      sendReasoning: false,
      sendStart: false,
    }),
  );
};
