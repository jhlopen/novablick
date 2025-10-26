import { useEffect, useState } from "react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import {
  FileSpreadsheetIcon,
  MessageCircleIcon,
  SparklesIcon,
} from "lucide-react";
import { Dataset } from "@/lib/db/schema";

interface AppSidebarProps {
  datasets: Dataset[];
  activeDatasetId?: string;
  setActiveDatasetId: (id?: string) => void;
}

export function AppSidebar({
  datasets,
  activeDatasetId,
  setActiveDatasetId,
}: AppSidebarProps) {
  return (
    <Sidebar>
      <SidebarHeader className="flex-row font-bold text-2xl items-center">
        <SparklesIcon className="ml-2 size-5" />
        <span>Novablick</span>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  isActive={!activeDatasetId}
                  onClick={() => setActiveDatasetId(undefined)}
                >
                  <div>
                    <MessageCircleIcon />
                    <span>New query</span>
                  </div>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup>
          <SidebarGroupLabel>Datasets</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {datasets.map((dataset) => (
                <SidebarMenuItem key={dataset.id}>
                  <SidebarMenuButton
                    asChild
                    isActive={activeDatasetId === dataset.id}
                    onClick={() => setActiveDatasetId(dataset.id)}
                  >
                    <div>
                      <FileSpreadsheetIcon />
                      <span>{dataset.name}</span>
                    </div>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter />
    </Sidebar>
  );
}
