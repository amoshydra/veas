import type { GraphNode, GraphEdge } from "../stores/nodeGraph.js";

export function resolvePreviewSource(
  nodeId: string,
  nodes: GraphNode[],
  edges: GraphEdge[],
): { fileId: string | undefined; isReady: boolean } {
  const node = nodes.find((n) => n.id === nodeId);
  if (!node) return { fileId: undefined, isReady: false };

  if (node.type === "fileInput") {
    return { fileId: node.data?.config?.fileId, isReady: true };
  }

  const inputEdge = edges.find((e) => e.target === nodeId && e.targetHandle === "video");
  if (!inputEdge) return { fileId: undefined, isReady: false };

  const sourceNode = nodes.find((n) => n.id === inputEdge.source);
  if (!sourceNode) return { fileId: undefined, isReady: false };

  const fileId = sourceNode.data?.outputId || sourceNode.data?.config?.fileId;
  const sourceStatus = sourceNode.data?.status;
  const isSourceCompleted = sourceStatus === "completed";
  const isSourceFileInput = sourceNode.type === "fileInput";

  const isReady = isSourceCompleted || isSourceFileInput;

  return { fileId, isReady };
}
