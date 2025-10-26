"use client";

import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { ChatView } from "@/components/chat-view";
import { DatasetView } from "@/components/dataset-view";
import { useCallback, useEffect, useState } from "react";
import { Dataset } from "@/lib/db/schema";

const Home = () => {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [activeDatasetId, setActiveDatasetId] = useState<string | undefined>(
    undefined,
  );

  const fetchDatasets = useCallback(async () => {
    try {
      const response = await fetch("/api/datasets");
      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setDatasets(result.data);
      }
    } catch (error) {
      console.error("Error fetching datasets:", error);
    }
  }, []);

  useEffect(() => {
    // Initial data fetch on mount
    const loadInitialData = async () => {
      try {
        const response = await fetch("/api/datasets");
        const result = await response.json();
        if (result.success && Array.isArray(result.data)) {
          setDatasets(result.data);
        }
      } catch (error) {
        console.error("Error fetching datasets:", error);
      }
    };

    loadInitialData();
  }, []);

  return (
    <SidebarProvider>
      <AppSidebar
        datasets={datasets}
        activeDatasetId={activeDatasetId}
        setActiveDatasetId={setActiveDatasetId}
      />
      <main className="flex h-screen w-full flex-col overflow-hidden">
        <SidebarTrigger />
        <div className="flex-1 overflow-y-auto">
          {activeDatasetId ? (
            <DatasetView datasetId={activeDatasetId} />
          ) : (
            <ChatView onDatasetUploaded={fetchDatasets} />
          )}
        </div>
      </main>
    </SidebarProvider>
  );
};

export default Home;
