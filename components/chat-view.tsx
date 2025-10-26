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
import {
  Fragment,
  useState,
  useRef,
  useEffect,
  HTMLAttributes,
  useLayoutEffect,
} from "react";
import { useChat } from "@ai-sdk/react";
import { Response } from "@/components/ai-elements/response";
import {
  CheckIcon,
  CopyIcon,
  FileSpreadsheetIcon,
  RefreshCcwIcon,
  UploadIcon,
  XIcon,
} from "lucide-react";
import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from "@/components/ai-elements/reasoning";
import { Loader } from "@/components/ai-elements/loader";
import { DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Button } from "@/components/ui/button";
import { InputGroupAddon } from "@/components/ui/input-group";

interface Dataset {
  id: string;
  name: string;
  fileName: string;
  rowCount: number;
  columnCount: number;
  createdAt: string;
}

export const ChatView = () => {
  const [input, setInput] = useState("");
  const { messages, sendMessage, status, regenerate } = useChat();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasets, setSelectedDatasets] = useState<Dataset[]>([]);

  const fetchDatasets = async () => {
    try {
      const response = await fetch("/api/datasets");
      const result = await response.json();
      if (result.success) {
        setDatasets(result.data);
      }
    } catch (error) {
      console.error("Error fetching datasets:", error);
    }
  };

  // Fetch datasets on mount
  useEffect(() => {
    fetchDatasets();
  }, []);

  const handleSubmit = (message: PromptInputMessage) => {
    if (uploadingFiles.length > 0 || !message.text) {
      return;
    }

    sendMessage({
      text: message.text,
    });
    setInput("");
  };

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    const csvFiles = Array.from(files);

    // Add all files to uploading state at once
    setUploadingFiles((prev) => [...prev, ...csvFiles.map((f) => f.name)]);

    // Upload all files in parallel (non-blocking)
    const uploadPromises = csvFiles.map(async (file) => {
      try {
        const formData = new FormData();
        formData.append("file", file);

        const response = await fetch("/api/upload-csv", {
          method: "POST",
          body: formData,
        });

        const result = await response.json();

        if (result.success) {
          setSelectedDatasets((prev) =>
            prev.some((d) => d.id === result.data.id)
              ? prev
              : [...prev, result.data],
          );

          // Refresh datasets list
          await fetchDatasets();
        } else {
          console.error(`Upload failed: ${file.name}`, result.error);
        }
      } catch (error) {
        const errorMsg =
          error instanceof Error ? error.message : "Unknown error";
        console.error(`Upload error: ${file.name}`, errorMsg);
      } finally {
        // Remove this specific file from uploading state
        setUploadingFiles((prev) => prev.filter((name) => name !== file.name));
      }
    });

    // Run in the background
    Promise.all(uploadPromises);

    // Reset the file input immediately so user can select more files
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  type PromptInputDatasetProps = HTMLAttributes<HTMLDivElement> & {
    dataset: Dataset;
    className?: string;
  };

  function PromptInputDataset({
    dataset,
    className,
    ...props
  }: PromptInputDatasetProps) {
    return (
      <div
        className={cn(
          "group relative rounded-md border h-8 w-auto max-w-full",
          className,
        )}
        key={dataset.id}
        {...props}
      >
        <div className="flex size-full max-w-full cursor-pointer items-center justify-start gap-2 overflow-hidden px-2 text-muted-foreground">
          <FileSpreadsheetIcon className="size-4 shrink-0" />
          <Tooltip delayDuration={400}>
            <TooltipTrigger className="min-w-0 flex-1">
              <h4 className="w-full truncate text-left font-medium text-sm">
                {dataset.name}
              </h4>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-muted-foreground text-xs">
                <h4 className="max-w-[240px] overflow-hidden whitespace-normal break-words text-left font-semibold text-sm">
                  {dataset.name}
                </h4>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
        <Button
          aria-label="Remove dataset"
          className="-right-1.5 -top-1.5 absolute h-6 w-6 rounded-full opacity-0 group-hover:opacity-100"
          onClick={() =>
            setSelectedDatasets((prev) =>
              prev.filter((d) => d.id !== dataset.id),
            )
          }
          size="icon"
          type="button"
          variant="outline"
        >
          <XIcon className="h-3 w-3" />
        </Button>
      </div>
    );
  }

  type PromptInputUploadingFileProps = HTMLAttributes<HTMLDivElement> & {
    id: string;
    file: string;
    className?: string;
  };

  function PromptInputUploadingFile({
    id,
    file,
    className,
    ...props
  }: PromptInputUploadingFileProps) {
    return (
      <div
        className={cn(
          "group relative rounded-md border h-8 w-auto max-w-full",
          className,
        )}
        key={id}
        {...props}
      >
        <div className="flex size-full max-w-full cursor-pointer items-center justify-start gap-2 overflow-hidden px-2 text-muted-foreground">
          <Loader className="size-4 shrink-0" />
          <Tooltip delayDuration={400}>
            <TooltipTrigger className="min-w-0 flex-1">
              <h4 className="w-full truncate text-left font-medium text-sm">
                {file}
              </h4>
            </TooltipTrigger>
            <TooltipContent>
              <div className="text-muted-foreground text-xs">
                <h4 className="max-w-[240px] overflow-hidden whitespace-normal break-words text-left font-semibold text-sm">
                  {file}
                </h4>
              </div>
            </TooltipContent>
          </Tooltip>
        </div>
      </div>
    );
  }

  type PromptInputDatasetsProps = Omit<
    HTMLAttributes<HTMLDivElement>,
    "children"
  >;

  function PromptInputDatasets({
    className,
    ...props
  }: PromptInputDatasetsProps) {
    const [height, setHeight] = useState(0);
    const contentRef = useRef<HTMLDivElement>(null);

    useLayoutEffect(() => {
      const el = contentRef.current;
      if (!el) {
        return;
      }
      const ro = new ResizeObserver(() => {
        setHeight(el.getBoundingClientRect().height);
      });
      ro.observe(el);
      setHeight(el.getBoundingClientRect().height);
      return () => ro.disconnect();
    }, []);

    // Force height measurement when datasets or uploading files change
    useLayoutEffect(() => {
      const el = contentRef.current;
      if (!el) {
        return;
      }
      setHeight(el.getBoundingClientRect().height);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedDatasets.length, uploadingFiles.length]);

    if (selectedDatasets.length + uploadingFiles.length === 0) {
      return null;
    }

    return (
      <InputGroupAddon
        align="block-start"
        aria-live="polite"
        className={cn(
          "overflow-hidden transition-[height] duration-200 ease-out",
          className,
        )}
        style={{
          height: selectedDatasets.length + uploadingFiles.length ? height : 0,
        }}
        {...props}
      >
        <div className="space-y-2 py-1" ref={contentRef}>
          <div className="flex flex-wrap gap-2">
            {selectedDatasets.map((dataset) => (
              <PromptInputDataset key={dataset.id} dataset={dataset} />
            ))}
          </div>
          <div className="flex flex-wrap gap-2">
            {uploadingFiles.map((file, i) => (
              <PromptInputUploadingFile
                key={`${file}-${i}`}
                id={`${file}-${i}`}
                file={file}
              />
            ))}
          </div>
        </div>
      </InputGroupAddon>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6 relative size-full h-screen">
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
            <PromptInputDatasets />
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
        <input
          ref={fileInputRef}
          type="file"
          accept=".csv,text/csv"
          multiple
          onChange={(e) => handleFileUpload(e.target.files)}
          style={{ display: "none" }}
        />
      </div>
    </div>
  );
};
