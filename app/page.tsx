"use client";

import { useEffect, useRef, useState } from "react";
import { UIMessage, useChat } from "@ai-sdk/react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ChatView } from "@/components/chat-view";
import { WorkbenchTab, WorkbenchView } from "@/components/workbench-view";
import { Dataset } from "@/lib/db/schema";
import { CustomDataPart } from "@/lib/ai/schema";

const Home = () => {
  const { messages, sendMessage, status, regenerate } = useChat<
    UIMessage<unknown, CustomDataPart>
  >({
    onData: ({ data, type }) => {
      if (type === "data-planDataPart" && data.steps.length > 0) {
        setTab(WorkbenchTab.PLAN);
      }
    },
  });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingFiles, setUploadingFiles] = useState<string[]>([]);
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [selectedDatasets, setSelectedDatasets] = useState<Dataset[]>([]);
  const [tab, setTab] = useState<string | undefined>();

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

  const handleFileUpload = async (files: FileList | null) => {
    if (!files || files.length === 0) return;

    setTab((prev) => (!prev ? WorkbenchTab.UPLOADING : prev));

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
          setTab((prev) =>
            prev === WorkbenchTab.UPLOADING ? result.data.id : prev,
          );
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

  return (
    <div className="flex h-screen w-full">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={45} minSize={30}>
          <ChatView
            messages={messages}
            sendMessage={sendMessage}
            status={status}
            regenerate={regenerate}
            uploadingFiles={uploadingFiles}
            datasets={datasets}
            selectedDatasets={selectedDatasets}
            selectDataset={(dataset) => {
              setSelectedDatasets((prev) => [...prev, dataset]);
              setTab(dataset.id);
            }}
            deselectDataset={(dataset) => {
              setSelectedDatasets((prev) => {
                const datasets = prev.filter((d) => d.id !== dataset.id);
                setTab(
                  (datasets.length > 0 && datasets[0].id) ||
                    (uploadingFiles.length > 0 && WorkbenchTab.UPLOADING) ||
                    WorkbenchTab.PLAN,
                );
                return datasets;
              });
            }}
            handleUploadClick={handleUploadClick}
          />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel minSize={30}>
          <WorkbenchView
            tab={tab}
            setTab={setTab}
            messages={messages}
            uploadingFiles={uploadingFiles}
            selectedDatasets={selectedDatasets}
            setSelectedDatasets={setSelectedDatasets}
          />
        </ResizablePanel>
      </ResizablePanelGroup>
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,text/csv"
        multiple
        onChange={(e) => handleFileUpload(e.target.files)}
        style={{ display: "none" }}
      />
    </div>
  );
};

export default Home;
