import { createRoot } from "react-dom/client";

import { MobileApp } from "./mobile-app";
import "./styles.css";

const root = document.getElementById("root");

if (!root) {
  throw new Error("Mobile root element is missing");
}

createRoot(root).render(<MobileApp />);
