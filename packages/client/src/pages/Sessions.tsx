import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";

interface Session {
  id: string;
  name: string;
  updatedAt: string;
}

interface DeleteConfirm {
  id: string;
  name: string;
  fileCount: number;
  totalSize: number;
}

export default function Sessions() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmDelete, setConfirmDelete] = useState<DeleteConfirm | null>(null);

  const { data: sessionsData, isLoading } = useQuery({
    queryKey: ["sessions"],
    queryFn: api.listSessions,
  });

  const sessions = (sessionsData || []) as Session[];

  const createMutation = useMutation({
    mutationFn: api.createSession,
    onSuccess: (session) => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      navigate(`/editor/${session.id}`);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: api.deleteSession,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sessions"] });
      setConfirmDelete(null);
    },
  });

  const handleDelete = async (s: Session) => {
    const summary = await api.getSessionSummary(s.id);
    if (summary.fileCount > 0) {
      setConfirmDelete({ id: s.id, name: s.name, ...summary });
    } else {
      deleteMutation.mutate(s.id);
    }
  };

  return (
    <div className="h-full flex flex-col">
      <header className="p-4 border-b border-slate-700">
        <h1 className="text-2xl font-bold">VEAS</h1>
        <p className="text-sm text-slate-400">Video Editing as a Service</p>
      </header>

      <main className="flex-1 overflow-y-auto p-4">
        <button
          onClick={() => createMutation.mutate({ name: "New Project" })}
          disabled={createMutation.isPending}
          className="w-full mb-4 py-3 px-4 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-800 rounded-lg font-medium transition-colors"
        >
          {createMutation.isPending ? "Creating..." : "+ New Project"}
        </button>

        {isLoading ? (
          <p className="text-slate-400 text-center mt-8">Loading...</p>
        ) : sessions?.length === 0 ? (
          <p className="text-slate-400 text-center mt-8">No projects yet</p>
        ) : (
          <div className="space-y-2">
            {sessions?.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between p-3 bg-slate-800 rounded-lg"
              >
                <button
                  onClick={() => navigate(`/editor/${s.id}`)}
                  className="flex-1 text-left"
                >
                  <div className="font-medium">{s.name}</div>
                  <div className="text-xs text-slate-400">
                    {new Date(s.updatedAt).toLocaleDateString()}
                  </div>
                </button>
                <button
                  onClick={() => handleDelete(s)}
                  className="ml-2 px-2 py-1 text-red-400 hover:text-red-300 text-sm"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setConfirmDelete(null)}
          />
          <div className="relative bg-slate-800 rounded-xl p-5 w-full max-w-sm space-y-4">
            <h2 className="text-lg font-semibold">Delete Project</h2>
            <p className="text-sm text-slate-300">
              <strong>"{confirmDelete.name}"</strong> has{" "}
              {confirmDelete.fileCount} file{confirmDelete.fileCount !== 1 ? "s" : ""}{" "}
              ({(confirmDelete.totalSize / 1024 / 1024).toFixed(1)} MB).
            </p>
            <p className="text-sm text-slate-400">
              This will permanently delete all videos, outputs, and project data.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2 bg-slate-700 hover:bg-slate-600 rounded font-medium text-sm transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={deleteMutation.isPending}
                className="flex-1 py-2 bg-red-600 hover:bg-red-500 disabled:bg-red-800 rounded font-medium text-sm transition-colors"
              >
                {deleteMutation.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
