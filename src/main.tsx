import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App";
import "./ui";

const showStyleGuide = import.meta.env.DEV && window.location.hash === "#styleguide";
const StyleGuide = showStyleGuide ? React.lazy(() => import("./ui/StyleGuide").then((module) => ({ default: module.StyleGuide }))) : null;

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    {StyleGuide ? (
      <React.Suspense fallback={null}>
        <StyleGuide />
      </React.Suspense>
    ) : (
      <App />
    )}
  </React.StrictMode>
);
