import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { applySeoDefaults } from "./lib/seo";

applySeoDefaults();

createRoot(document.getElementById("root")!).render(<App />);
