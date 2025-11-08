import { Dispatch, SetStateAction } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dataset } from "@/lib/db/schema";
import { Button } from "@/components/ui/button";
import { Loader } from "@/components/ai-elements/loader";
import { Shimmer } from "@/components/ai-elements/shimmer";
import { FileSpreadsheetIcon, SparklesIcon, XIcon } from "lucide-react";
import { DatasetView } from "./dataset-view";

interface WorkbenchViewProps {
  uploadingFiles: string[];
  selectedDatasets: Dataset[];
  setSelectedDatasets: Dispatch<SetStateAction<Dataset[]>>;
}

export const WorkbenchView = ({
  uploadingFiles,
  selectedDatasets,
  setSelectedDatasets,
}: WorkbenchViewProps) => {
  return (
    <div className="size-full p-6">
      <div className="flex flex-col h-full">
        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
          <SparklesIcon className="ml-2 size-5" />
          <span>Novablick</span>
        </h2>
        <Tabs
          defaultValue="account"
          className="w-full flex flex-col flex-1 overflow-hidden"
        >
          <TabsList className="flex-wrap h-auto justify-start shrink-0">
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
            ))}
            {uploadingFiles.length > 0 && (
              <TabsTrigger
                key="uploading"
                value="uploading"
                className="justify-start max-w-[250px] max-h-8"
              >
                <Loader className="size-4 shrink-0" />
                <span>Uploading</span>
              </TabsTrigger>
            )}
          </TabsList>
          <div className="flex-1 border rounded-lg p-4 bg-muted/30 flex flex-col overflow-hidden">
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
              value="uploading"
              className="flex items-center justify-center flex-1 overflow-y-auto overflow-x-hidden"
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
