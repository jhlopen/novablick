import dagre from "@dagrejs/dagre";
import {
  Node as NodeType,
  Edge as EdgeType,
  Position,
  useReactFlow,
} from "@xyflow/react";
import { Canvas } from "@/components/ai-elements/canvas";
import { Connection } from "@/components/ai-elements/connection";
import { Edge } from "@/components/ai-elements/edge";
import {
  Node,
  NodeDescription,
  NodeHeader,
  NodeTitle,
} from "@/components/ai-elements/node";
import { useEffect, useState, useRef, useMemo } from "react";
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Controls } from "@/components/ai-elements/controls";

const nodeTypes = {
  plan: ({
    data,
  }: {
    data: {
      label: string;
      description: string;
      handles: { target: boolean; source: boolean };
      details: string;
    };
  }) => (
    <Node handles={data.handles}>
      <Tooltip>
        <TooltipTrigger asChild>
          <NodeHeader className="pointer-events-auto">
            <NodeTitle>{data.label}</NodeTitle>
            <NodeDescription>{data.description}</NodeDescription>
          </NodeHeader>
        </TooltipTrigger>
        <TooltipContent className="max-w-md" side="right">
          <p className="text-sm whitespace-pre-wrap">{data.details}</p>
        </TooltipContent>
      </Tooltip>
    </Node>
  ),
};

const edgeTypes = {
  animated: Edge.Animated,
  temporary: Edge.Temporary,
};

const dagreGraph = new dagre.graphlib.Graph().setDefaultEdgeLabel(() => ({}));

const getLayoutedElements = (
  nodes: NodeType[],
  edges: EdgeType[],
  containerWidth: number,
  containerHeight: number,
  direction = "TB",
) => {
  const isHorizontal = direction === "LR";

  const spacing = 50;
  const nodeWidth = Math.max(80, containerWidth - spacing * 2);
  const availableHeight = containerHeight - spacing;
  const nodeHeight = Math.max(80, availableHeight / nodes.length - spacing);

  dagreGraph.setGraph({ rankdir: direction });

  dagreGraph.nodes().forEach((node) => dagreGraph.removeNode(node));

  nodes.forEach((node) => {
    dagreGraph.setNode(node.id, { width: nodeWidth, height: nodeHeight });
  });

  edges.forEach((edge) => {
    dagreGraph.setEdge(edge.source, edge.target);
  });

  dagre.layout(dagreGraph);

  const newNodes = nodes.map((node) => {
    const nodeWithPosition = dagreGraph.node(node.id);
    const newNode = {
      ...node,
      targetPosition: isHorizontal ? Position.Left : Position.Top,
      sourcePosition: isHorizontal ? Position.Right : Position.Bottom,
      position: {
        x: nodeWithPosition.x - nodeWidth / 2,
        y: nodeWithPosition.y - nodeHeight / 2,
      },
    };

    return newNode;
  });

  return { layoutedNodes: newNodes, layoutedEdges: edges };
};

interface PlanViewProps {
  nodes: NodeType[];
  edges: EdgeType[];
}

export const PlanView = ({ nodes, edges }: PlanViewProps) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const reactFlow = useReactFlow();
  const [containerWidth, setContainerWidth] = useState(600);
  const [containerHeight, setContainerHeight] = useState(700);

  useEffect(() => {
    if (!containerRef.current) return;

    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        setContainerWidth(width);
        setContainerHeight(height);
      }
    });

    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
    };
  }, []);

  const { layoutedNodes, layoutedEdges } = useMemo(
    () => getLayoutedElements(nodes, edges, containerWidth, containerHeight),
    [containerWidth, containerHeight, nodes, edges],
  );

  useEffect(() => {
    reactFlow.fitView();
  }, [reactFlow, layoutedNodes, layoutedEdges]);

  return (
    <div ref={containerRef} className="h-full w-full">
      <Canvas
        edges={layoutedEdges}
        edgeTypes={edgeTypes}
        fitView
        nodes={layoutedNodes}
        nodeTypes={nodeTypes}
        connectionLineComponent={Connection}
        nodesDraggable={false}
        nodesConnectable={false}
        nodesFocusable={false}
        edgesFocusable={false}
        elementsSelectable={false}
        autoPanOnConnect={false}
        autoPanOnNodeDrag={false}
        selectionOnDrag={false}
        selectNodesOnDrag={false}
        elevateNodesOnSelect={false}
        connectOnClick={false}
      >
        <Controls showInteractive={false} />
      </Canvas>
    </div>
  );
};
