import React from "react";
import ReactDOM from "react-dom/client";
import { HashRouter } from "react-router-dom";
import { App } from "./App";
import { NotificationProvider } from "@/providers/NotificationProvider";
import { QueryProvider } from "@/providers/QueryProvider";
import { RedLightProvider } from "@/providers/RedLightProvider";
import { ThemeProvider } from "@/providers/ThemeProvider";
import "./index.css";

/**
 * Hash routing is deliberate. `vite.config.ts` builds with `base: "./"` so the
 * exact same bundle runs from the Vite dev server, from FastAPI inside the
 * packaged .exe, and from a `file://` native shell. Relative asset URLs only
 * resolve correctly when the document path never gets deeper than the bundle
 * root — which is precisely what a hash route guarantees.
 */
const root = document.getElementById("root");
if (!root) throw new Error("#root is missing from index.html");

ReactDOM.createRoot(root).render(
  <React.StrictMode>
    <ThemeProvider>
      <RedLightProvider>
        <QueryProvider>
          <NotificationProvider>
            <HashRouter>
              <App />
            </HashRouter>
          </NotificationProvider>
        </QueryProvider>
      </RedLightProvider>
    </ThemeProvider>
  </React.StrictMode>
);
