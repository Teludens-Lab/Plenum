import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.js";
import { PlatformNavigationLoader } from "./PlenumLoader.js";
import "./styles.css";

const root = document.getElementById("root");
if (root === null) throw new Error("Studio root element is missing");
createRoot(root).render(<StrictMode><App /><PlatformNavigationLoader /></StrictMode>);
