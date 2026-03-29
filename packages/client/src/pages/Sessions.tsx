import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client.js";

interface Session {
  id: string;
  name: string;
  updatedAt: string;
}

export default function Sessions() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
    },
  });

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
                  onClick={() => deleteMutation.mutate(s.id)}
                  className="ml-2 px-2 py-1 text-red-400 hover:text-red-300 text-sm"
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
