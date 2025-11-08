"use client";

import { useEffect, useRef, useState } from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { ChatView } from "@/components/chat-view";
import { WorkbenchView } from "@/components/workbench-view";
import { Dataset } from "@/lib/db/schema";

const Home = () => {
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

  return (
    <div className="flex h-screen w-full">
      <ResizablePanelGroup direction="horizontal">
        <ResizablePanel defaultSize={30} minSize={30}>
          <ChatView
            uploadingFiles={uploadingFiles}
            datasets={datasets}
            selectedDatasets={selectedDatasets}
            setSelectedDatasets={setSelectedDatasets}
            handleUploadClick={handleUploadClick}
          />
        </ResizablePanel>
        <ResizableHandle />
        <ResizablePanel minSize={30}>
          <WorkbenchView
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
