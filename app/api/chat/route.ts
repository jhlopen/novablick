import {
  UIMessage,
  createUIMessageStreamResponse,
  createUIMessageStream,
} from "ai";
import { streamAgent } from "@/lib/ai/agents";
import { CustomDataPart } from "@/lib/ai/schema";
import { Dataset } from "@/lib/db/schema";

export const maxDuration = 60; // 1 minute

export async function POST(req: Request) {
  const {
    messages,
    selectedDatasets,
  }: {
    messages: UIMessage[];
    selectedDatasets: Dataset[];
  } = await req.json();

  return createUIMessageStreamResponse({
    stream: createUIMessageStream<UIMessage<unknown, CustomDataPart>>({
      execute: async ({ writer }) =>
        streamAgent({ writer, messages, selectedDatasets }),
    }),
  });
}
