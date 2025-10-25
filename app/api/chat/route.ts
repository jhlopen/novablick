import { openai } from "@ai-sdk/openai";
import { streamText, UIMessage, convertToModelMessages } from "ai";

// Allow streaming responses up to 30 seconds
export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
  }: {
    messages: UIMessage[];
  } = await req.json();

  const result = streamText({
    model: openai("gpt-4o"),
    messages: convertToModelMessages(messages),
    system:
      "You are a helpful assistant that can answer questions and help with tasks",
  });

  // send reasoning back to the client
  return result.toUIMessageStreamResponse({
    sendReasoning: true,
  });
}
