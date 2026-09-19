import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Capacitor } from "@capacitor/core";

import "./styles.css";

function MobileShell() {
  const platform = Capacitor.getPlatform();
  const runtime = Capacitor.isNativePlatform() ? "native" : "web";

  return (
    <main className="mobile-shell">
      <section className="foundation-card" aria-labelledby="foundation-title">
        <p className="brand">OWNLEVEL</p>
        <h1 id="foundation-title">Native foundation</h1>
        <p className="status">iOS shell ready</p>
        <dl className="runtime-details">
          <div>
            <dt>Runtime</dt>
            <dd>{runtime}</dd>
          </div>
          <div>
            <dt>Platform</dt>
            <dd>{platform}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}

const root = document.getElementById("root");

if (!root) {
  throw new Error("Mobile root element is missing");
}

createRoot(root).render(
  <StrictMode>
    <MobileShell />
  </StrictMode>,
);
