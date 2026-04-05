import { Routes, Route } from "react-router-dom";
import Sessions from "./pages/Sessions.js";
import Editor from "./pages/Editor.js";
import DemoBanner from "./components/DemoBanner.js";

export default function App() {
  return (
    <div className="h-full flex flex-col">
      <DemoBanner />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Routes>
          <Route
            path="/"
            element={<Sessions />}
          />
          <Route
            path="/editor/:sessionId"
            element={<Editor />}
          />
        </Routes>
      </div>
    </div>
  );
}
