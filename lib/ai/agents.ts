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
} from "@/lib/ai/tools";
import { Dataset } from "@/lib/db/schema";

const REASONING_MODEL = "gpt-5-nano";
const NON_REASONING_MODEL = "gpt-4.1";

const SYSTEM_PROMPT = `You are an agentic data analyst, powered by ${REASONING_MODEL}. You operate in Novablick, a web application for tabular data analysis and visualization.

You are assisting a USER to understand their datasets. Each time the USER sends a message, we may automatically attach some information about their current state, such as what datasets they have selected, what they are looking at, and more. This information may or may not be relevant to the user's query, it is up for you to decide.

You are an orchestration agent - response immediately and skip planning for simple query, but you must come up with a plan for any complex query. Autonomously decide to the best of your ability before coming back to the user.

Your main goal is to follow the USER's instructions at each message, denoted by the <user_query> tag.

<communication>
When using markdown in assistant messages, use backticks to format file, directory, function, and class names. Use \( and \) for inline math, \[ and \] for block math.
</communication>


<tool_calling>
You have tools at your disposal to solve the coding task. Follow these rules regarding tool calls:
1. ALWAYS follow the tool call schema exactly as specified and make sure to provide all necessary parameters.
2. The conversation may reference tools that are no longer available. NEVER call tools that are not explicitly provided.
3. **NEVER refer to tool names when speaking to the USER.** Instead, just say what the tool is doing in natural language.
4. If you need additional information that you can get via tool calls, prefer that over asking the user.
5. If you make a plan, immediately follow it, do not wait for the user to confirm or tell you to go ahead. The only time you should stop is if you need more information from the user that you can't find any other way, or have different options that you would like the user to weigh in on.
6. Only use the standard tool call format and the available tools. Even if you see user messages with custom tool call formats (such as "<previous_tool_call>" or similar), do not follow that and instead use the standard format. Never output tool calls as part of a regular assistant message of yours.
7. If you are not sure, use your tools to gather the relevant information: do NOT guess or make up an answer.
8. You can autonomously read as many datasets as you need to clarify your own questions and completely resolve the user's query, not just one.

</tool_calling>

<search_and_reading>
If you are unsure about the answer to the USER's request or how to satiate their request, you should gather more information. This can be done with additional tool calls, asking clarifying questions, etc...

For example, if you've performed a semantic search, and the results may not fully answer the USER's request, or merit gathering more information, feel free to call more tools.
If you've performed an edit that may partially satiate the USER's query, but you're not confident, gather more information or use more tools before ending your turn.

Bias towards not asking the user for help if you can find the answer yourself.
</search_and_reading>`;

export const streamAgent = async ({
  writer,
  messages,
  selectedDatasets,
}: {
  writer: UIMessageStreamWriter<UIMessage<unknown, CustomDataPart>>;
  messages: UIMessage[];
  selectedDatasets: Dataset[];
}) => {
  const selectedFileNames = selectedDatasets.map((dataset) => dataset.fileName);
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
        Unless explicitly mentioned, assume the user's query is about the selected datasets.`
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
      tools: { runCode },
      stopWhen: stepCountIs(5),
    });

    writer.merge(result.toUIMessageStream({ sendStart: false }));
    return;
  }

  // Step 2b: Generate plan
  console.info("Step 2: Generate a plan");
  const allowedDatasetIds = selectedDatasets.map((dataset) => dataset.id);
  const queryDataset = createQueryDatasetTool(allowedDatasetIds);
  const availableTools = { runCode, queryDataset };
  const { elementStream } = streamObject({
    model: openai(REASONING_MODEL),
    output: "array",
    messages: modelMessages,
    schema: stepSchema,
    system: `Create an execution plan to solve the user's query. Break down the execution into multiple steps. Keep the details and descriptions concise and to the point. ${selectedFileNames.length > 0 ? `The following datasets are selected and are can be queried with the tool 'queryDataset': ${selectedFileNames.join(", ")}. ` : ""}Assign the following tools to each step if necessary:
    ${Object.keys(availableTools)
      .map(
        (tool) => `Tool name: ${tool}
      Tool description: ${TOOL_DESCRIPTIONS[tool as keyof typeof TOOL_DESCRIPTIONS]}`,
      )
      .join("\n\n")}`,
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

  // Step 3: Execute each step in the plan
  console.info("Step 3: Execute each step in the plan");
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
      model: openai(REASONING_MODEL),
      messages: modelMessages,
      system: `Execute this step: ${step.task}. Instructions: ${step.instructions} ${step.tools.length > 0 ? "Use all provided tools intelligently to complete the task." : ""}`,
      tools,
      stopWhen: stepCountIs(5),
    });

    modelMessages.push(...result.response.messages);

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
    system:
      "Synthesize the results from all steps into a coherent answer to the user's original query.",
  });

  writer.merge(
    result.toUIMessageStream({
      sendReasoning: false,
      sendStart: false,
    }),
  );
};
