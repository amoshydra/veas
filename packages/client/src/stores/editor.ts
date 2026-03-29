import { create } from "zustand";

interface EditorState {
  sessionId: string | null;
  selectedFileId: string | null;
  activeOperation: string | null;
  timelineZoom: number;

  setSessionId: (id: string) => void;
  setSelectedFile: (id: string | null) => void;
  setActiveOperation: (op: string | null) => void;
  setTimelineZoom: (zoom: number) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  sessionId: null,
  selectedFileId: null,
  activeOperation: null,
  timelineZoom: 1,

  setSessionId: (id) => set({ sessionId: id }),
  setSelectedFile: (id) => set({ selectedFileId: id }),
  setActiveOperation: (op) => set({ activeOperation: op }),
  setTimelineZoom: (zoom) => set({ timelineZoom: zoom }),
}));
