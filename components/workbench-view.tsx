"use client";

import { Dispatch, SetStateAction, useMemo } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dataset } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ai-elements/loader";
import { Shimmer } from "@/components/ai-elements/shimmer";
import {
  FileSpreadsheetIcon,
  SparklesIcon,
  WorkflowIcon,
  XIcon,
} from "lucide-react";
import { DatasetView } from "./dataset-view";
import { PlanView } from "./plan-view";
import { UIMessage } from "ai";
import { ReactFlowProvider } from "@xyflow/react";
import { CustomDataPart } from "@/lib/ai/schema";

export const WorkbenchTab = {
  PLAN: "plan",
  UPLOADING: "uploading",
} as const;

interface WorkbenchViewProps {
  tab?: string;
  setTab: (tab?: string) => void;
  messages: UIMessage<unknown, CustomDataPart>[];
  uploadingFiles: string[];
  selectedDatasets: Dataset[];
  setSelectedDatasets: Dispatch<SetStateAction<Dataset[]>>;
}

export const WorkbenchView = ({
  tab,
  setTab,
  messages,
  uploadingFiles,
  selectedDatasets,
  setSelectedDatasets,
}: WorkbenchViewProps) => {
  const { nodes, edges } = useMemo(() => {
    const planDataPart = messages
      .findLast((message) =>
        message.parts.some((part) => part.type === "data-planDataPart"),
      )
      ?.parts.findLast((part) => part.type === "data-planDataPart");
    const planId = planDataPart?.id;
    const steps = planDataPart?.data.steps ?? [];

    const nodes = steps.map((step, i) => ({
      id: `node-${step.id}`,
      type: "plan",
      position: { x: 0, y: 0 },
      data: {
        task: step.task,
        tools: step.tools.length > 0 ? `Tools: ${step.tools.join(", ")}` : "",
        instructions: step.instructions,
        handles: {
          target: i > 0,
          source: i < steps.length - 1,
        },
      },
    }));

    const edges = nodes.slice(0, -1).map((node, index) => {
      const completed = messages.some((message) =>
        message.parts.some(
          (part) =>
            part.type === "data-completedStepDataPart" &&
            part.data.planId === planId &&
            `node-${part.data.id}` === node.id,
        ),
      );
      const nextCompleted = messages.some((message) =>
        message.parts.some(
          (part) =>
            part.type === "data-completedStepDataPart" &&
            part.data.planId === planId &&
            `node-${part.data.id}` === nodes[index + 1].id,
        ),
      );

      return {
        id: `edge-${node.id}-${nodes[index + 1].id}`,
        source: node.id,
        target: nodes[index + 1].id,
        type: completed
          ? nextCompleted
            ? undefined
            : "animated"
          : "temporary",
      };
    });
    return { nodes, edges };
  }, [messages]);
  return (
    <div className="size-full p-6">
      <div className="flex flex-col h-full">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <SparklesIcon className="ml-2 size-5" />
          <span>Novablick</span>
        </h2>
        <Tabs
          value={tab}
          onValueChange={setTab}
          className="w-full flex flex-col flex-1 overflow-hidden"
        >
          <TabsList className="flex-wrap h-auto justify-start shrink-0">
            {nodes.length > 0 && (
              <TabsTrigger
                key="plan"
                value={WorkbenchTab.PLAN}
                className="justify-start max-h-8"
              >
                <WorkflowIcon className="size-4 shrink-0" />
                <Shimmer>Plan</Shimmer>
              </TabsTrigger>
            )}
            {selectedDatasets.map((dataset) => (
              <div key={dataset.id} className="relative group">
                <TabsTrigger
                  value={dataset.id}
                  className="justify-start max-w-[250px]"
                >
                  <FileSpreadsheetIcon className="size-4 shrink-0" />
                  <span className="truncate">{dataset.name}</span>
                </TabsTrigger>
                <Button
                  aria-label="Remove dataset"
                  className="-right-1.5 absolute top-1/2 -translate-y-1/2 h-6 w-6 rounded opacity-0 group-hover:opacity-100"
                  onClick={() =>
                    setSelectedDatasets((prev) => {
                      const datasets = prev.filter((d) => d.id !== dataset.id);
                      setTab(
                        (datasets.length > 0 && datasets[0].id) ||
                          (uploadingFiles.length > 0 &&
                            WorkbenchTab.UPLOADING) ||
                          WorkbenchTab.PLAN,
                      );
                      return datasets;
                    })
                  }
                  size="icon"
                  type="button"
                  variant="outline"
                >
                  <XIcon className="h-3 w-3" />
                </Button>
              </div>
            ))}
            {uploadingFiles.length > 0 && (
              <TabsTrigger
                key="uploading"
                value={WorkbenchTab.UPLOADING}
                className="justify-start max-h-8"
              >
                <Loader className="size-4 shrink-0" />
                <span>Uploading</span>
              </TabsTrigger>
            )}
          </TabsList>
          <div className="flex-1 border rounded-lg p-4 bg-muted/30 flex flex-col overflow-hidden">
            {messages.length === 0 &&
              nodes.length === 0 &&
              selectedDatasets.length === 0 &&
              uploadingFiles.length === 0 && (
                <div className="flex-1 flex items-center justify-center px-4">
                  <Shimmer
                    className="font-bold text-3xl text-center"
                    duration={3}
                  >
                    Upload a CSV file or start a conversation
                  </Shimmer>
                </div>
              )}
            {nodes.length > 0 && (
              <TabsContent
                key="plan"
                value={WorkbenchTab.PLAN}
                className="flex-1 overflow-y-auto overflow-x-hidden"
              >
                <ReactFlowProvider>
                  <PlanView nodes={nodes} edges={edges} />
                </ReactFlowProvider>
              </TabsContent>
            )}
            {selectedDatasets.map((dataset) => (
              <TabsContent
                key={dataset.id}
                value={dataset.id}
                className="flex-1 overflow-y-auto overflow-x-hidden"
              >
                <DatasetView datasetId={dataset.id} />
              </TabsContent>
            ))}
            <TabsContent
              key="uploading"
              value={WorkbenchTab.UPLOADING}
              className="flex flex-col items-center justify-center gap-2 flex-1 overflow-y-auto overflow-x-hidden"
            >
              {uploadingFiles.length > 0 ? (
                uploadingFiles.map((file, i) => (
                  <Shimmer
                    key={`${file}-${i}`}
                  >{`Uploading ${file}...`}</Shimmer>
                ))
              ) : (
                <span key="success">All files uploaded successfully.</span>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
};
