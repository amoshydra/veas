import { Routes, Route } from "react-router-dom";
import Sessions from "./pages/Sessions.js";
import Editor from "./pages/Editor.js";

export default function App() {
  return (
    <div className="h-full flex flex-col">
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
  );
}
