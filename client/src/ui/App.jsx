import React, { useState } from "react";
import H1Panel from "./H1Panel.jsx";
import H2Panel from "./H2Panel.jsx";
import H3Panel from "./H3Panel.jsx";

export default function App() {
  const [tab, setTab] = useState("h1");

  return (
    <div className="shell">
      <header className="site-header">
        <div className="brand">OBP • Performance Lab</div>
        <nav className="tabs">
          <button
            className={`tab ${tab === "h1" ? "active" : ""}`}
            onClick={() => setTab("h1")}
          >
            H1 Indeksi
          </button>
          <button
            className={`tab ${tab === "h2" ? "active" : ""}`}
            onClick={() => setTab("h2")}
          >
            H2 Denormalizacija
          </button>
          <button
            className={`tab ${tab === "h3" ? "active" : ""}`}
            onClick={() => setTab("h3")}
          >
            H3 Stored Procedure
          </button>
        </nav>
      </header>

      <main className="container">
        {tab === "h1" && (
          <section className="section">
            <div className="section-head">
              <h1>Hipoteza 1 — Kompozitni indeksi (WHERE + JOIN)</h1>
              <p className="muted">
                Uporedi neoptimizovane i optimizovane upite. Mjeri DB i E2E
                vrijeme. Klikni “Detalji” za svaku karticu.
              </p>
            </div>
            <H1Panel />
          </section>
        )}

        {tab === "h2" && (
          <section className="section">
            <div className="section-head">
              <h1>Hipoteza 2 — Denormalizacija kroz VIEW</h1>
              <p className="muted">
                Normalizovani JOIN/podupiti vs. preagregirani podaci u
                denormalizovanom view-u <code>PostDetails</code>.
              </p>
            </div>
            <H2Panel />
          </section>
        )}

        {tab === "h3" && (
          <section className="section">
            <div className="section-head">
              <h1>Hipoteza 3 — Stored procedure vs. Dynamic SQL</h1>
              <p className="muted">
                Dinamički SQL upiti iz Node backend-a naspram predefinisanih
                stored procedura. Poredi latenciju, DB vrijeme i E2E vrijeme.
              </p>
            </div>
            <H3Panel />
          </section>
        )}
      </main>

      <footer className="site-footer">
        <span>StackOverflow2013 • Node/Express • React/Vite</span>
      </footer>
    </div>
  );
}
