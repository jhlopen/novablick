import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "@/components/ai-elements/conversation";
import { Message, MessageContent } from "@/components/ai-elements/message";
import {
  PromptInput,
  PromptInputBody,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
  PromptInputFooter,
  PromptInputTools,
  PromptInputActionMenu,
  PromptInputActionMenuTrigger,
  PromptInputActionMenuContent,
  PromptInputActionMenuItem,
} from "@/components/ai-elements/prompt-input";
import { Action, Actions } from "@/components/ai-elements/actions";
import { Fragment, useState, Dispatch, SetStateAction } from "react";
import { useChat } from "@ai-sdk/react";
import { Response } from "@/components/ai-elements/response";
import {
  CheckIcon,
  CopyIcon,
  FileSpreadsheetIcon,
  RefreshCcwIcon,
  UploadIcon,
} from "lucide-react";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Loader } from "@/components/ai-elements/loader";
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { Dataset } from "@/lib/db/schema";

interface ChatViewProps {
  uploadingFiles: string[];
  datasets: Dataset[];
  selectedDatasets: Dataset[];
  setSelectedDatasets: Dispatch<SetStateAction<Dataset[]>>;
  handleUploadClick: () => void;
}

export const ChatView = ({
  uploadingFiles,
  datasets,
  selectedDatasets,
  setSelectedDatasets,
  handleUploadClick,
}: ChatViewProps) => {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, regenerate } = useChat();

  const handleSubmit = (message: PromptInputMessage) => {
    if (uploadingFiles.length > 0 || !message.text) {
      return;
    }

    sendMessage({
      text: message.text,
    });
    setInput("");
  };

  return (
    <div className="max-w-4xl mx-auto p-6 relative size-full">
      <div className="flex flex-col h-full">
        <Conversation className="h-full">
          <ConversationContent>
            {messages.map((message, messageIndex) => (
              <div key={message.id}>
                {message.parts.map((part, i) => {
                  switch (part.type) {
                    case "text":
                      return (
                        <Fragment key={`${message.id}-${i}`}>
                          <Message from={message.role}>
                            <MessageContent>
                              <Response>{part.text}</Response>
                            </MessageContent>
                          </Message>
                          {message.role === "assistant" && (
                            <Actions className="mt-2">
                              {messageIndex === messages.length - 1 && (
                                <Action
                                  onClick={() => regenerate()}
                                  label="Retry"
                                >
                                  <RefreshCcwIcon className="size-3" />
                                </Action>
                              )}
                              <Action
                                onClick={() =>
                                  navigator.clipboard.writeText(part.text)
                                }
                                label="Copy"
                              >
                                <CopyIcon className="size-3" />
                              </Action>
                            </Actions>
                          )}
                        </Fragment>
                      );
                    case "reasoning":
                      return (
                        <Reasoning
                          key={`${message.id}-${i}`}
                          className="w-full"
                          isStreaming={
                            status === "streaming" &&
                            i === message.parts.length - 1 &&
                            message.id === messages.at(-1)?.id
                          }
                        >
                          <ReasoningTrigger />
                          <ReasoningContent>{part.text}</ReasoningContent>
                        </Reasoning>
                      );
                    default:
                      return null;
                  }
                })}
              </div>
            ))}
            {status === "submitted" && <Loader />}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <PromptInput
          onSubmit={handleSubmit}
          className="mt-4"
          globalDrop
          multiple
        >
          <PromptInputBody>
            <PromptInputTextarea
              onChange={(e) => setInput(e.target.value)}
              value={input}
            />
          </PromptInputBody>
          <PromptInputFooter>
            <PromptInputTools>
              <PromptInputActionMenu>
                <PromptInputActionMenuTrigger />
                <PromptInputActionMenuContent>
                  {datasets.length > 0 && (
                    <>
                      {datasets.map((dataset) => {
                        const isSelected = selectedDatasets.some(
                          (d) => d.id === dataset.id,
                        );
                        return (
                          <PromptInputActionMenuItem
                            key={dataset.id}
                            onClick={() => {
                              setSelectedDatasets((prev) =>
                                isSelected
                                  ? prev.filter((d) => d.id !== dataset.id)
                                  : [...prev, dataset],
                              );
                            }}
                          >
                            {isSelected ? (
                              <CheckIcon className="mr-2 size-4" />
                            ) : (
                              <FileSpreadsheetIcon className="mr-2 size-4" />
                            )}
                            {dataset.name}
                          </PromptInputActionMenuItem>
                        );
                      })}
                      <DropdownMenuSeparator />
                    </>
                  )}
                  <PromptInputActionMenuItem onClick={handleUploadClick}>
                    <UploadIcon className="mr-2 size-4" />
                    Upload CSV files
                  </PromptInputActionMenuItem>
                </PromptInputActionMenuContent>
              </PromptInputActionMenu>
            </PromptInputTools>
            <PromptInputSubmit
              disabled={uploadingFiles.length > 0 || (!input && !status)}
              status={status}
            />
          </PromptInputFooter>
        </PromptInput>
      </div>
    </div>
  );
};
