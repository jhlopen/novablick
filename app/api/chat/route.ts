import {
  UIMessage,
  createUIMessageStreamResponse,
  createUIMessageStream,
} from "ai";
import { streamAgent } from "@/lib/ai/agents";
import { CustomDataPart } from "@/lib/ai/schema";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
  }: {
    messages: UIMessage[];
  } = await req.json();

  return createUIMessageStreamResponse({
    stream: createUIMessageStream<UIMessage<unknown, CustomDataPart>>({
      execute: async ({ writer }) => streamAgent({ writer, messages }),
    }),
  });
}
