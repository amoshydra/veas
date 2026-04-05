import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import App from "./App.js";
import "./index.css";

const IS_DEMO_MODE = import.meta.env.VITE_DEMO_MODE === "true";
const BASE_URL = import.meta.env.BASE_URL || "/";

async function startApp() {
  if (IS_DEMO_MODE) {
    try {
      const { setupWorker } = await import("msw/browser");
      const { handlers } = await import("@veas/mock/handlers");
      const worker = setupWorker(...handlers);
      const workerUrl = `${BASE_URL}mockServiceWorker.js`;
      await worker.start({
        serviceWorker: {
          url: workerUrl,
        },
        onUnhandledRequest: "bypass",
        quiet: true,
      });
      console.log("[MSW] Worker started at:", workerUrl);
    } catch (err) {
      console.error("[MSW] Failed to start worker:", err);
    }
  }

  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        staleTime: 30_000,
      },
    },
  });

  console.error("rendering");
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <QueryClientProvider client={queryClient}>
        <BrowserRouter>
          <Routes>
            <Route
              path="/*"
              element={<App />}
            />
          </Routes>
        </BrowserRouter>
      </QueryClientProvider>
    </React.StrictMode>,
  );
}

startApp();
