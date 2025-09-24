import React, { useMemo, useState } from "react";
import axios from "axios";
import CodeBlock from "./CodeBlock.jsx";
import Metric from "./Metric.jsx";
import ResultTable from "./ResultTable.jsx";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export default function QueryCard({ qid, def, apiNS = "h1", showMetrics }) {
  const [expanded, setExpanded] = useState(false);
  const [params, setParams] = useState(def.params || {});
  const [state, setState] = useState({
    loading: false,
    err: "",
    dbBase: "",
    dbOpt: "",
    e2eBase: "",
    e2eOpt: "",
    cpuBase: "",
    cpuOpt: "",
    execBase: "",
    execOpt: "",
    rows: [],
  });

  const queryString = (ps) =>
    Object.entries(ps)
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");

  const canCompare = state.dbBase && state.dbOpt;
  const speedup = useMemo(() => {
    const a = Number(state.dbBase),
      b = Number(state.dbOpt);
    return a && b ? (a / b).toFixed(2) : "";
  }, [state.dbBase, state.dbOpt]);

  async function run(variant) {
    setState((s) => ({ ...s, loading: true, err: "" }));
    try {
      const qs = queryString(params);
      const t0 = performance.now();
      const { data, headers } = await axios.get(
        `${API}/${apiNS}/${qid}/${variant}?${qs}`
      );
      const t1 = performance.now();
      const db = headers["x-query-time"] || data.durationMs;

      setState((s) => ({
        ...s,
        loading: false,
        rows: data.rows || [],
        dbBase: variant === "unoptimized" ? (data.dbTime ?? db) : s.dbBase,
        dbOpt: variant === "optimized" ? (data.dbTime ?? db) : s.dbOpt,
        e2eBase:
          variant === "unoptimized"
            ? (data.e2eTime ?? (t1 - t0).toFixed(1))
            : s.e2eBase,
        e2eOpt:
          variant === "optimized"
            ? (data.e2eTime ?? (t1 - t0).toFixed(1))
            : s.e2eOpt,
        cpuBase: variant === "unoptimized" ? data.cpu : s.cpuBase,
        cpuOpt: variant === "optimized" ? data.cpu : s.cpuOpt,
        execBase: variant === "unoptimized" ? data.execCount : s.execBase,
        execOpt: variant === "optimized" ? data.execCount : s.execOpt,
      }));
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        err: e.response?.data?.error || e.message,
      }));
    }
  }

  async function runBoth() {
    await run("unoptimized");
    await run("optimized");
  }

  function copy(text) {
    navigator.clipboard?.writeText(text);
  }

  return (
    <div className={`card ${expanded ? "card-open" : ""}`}>
      <div className="card-head">
        <h3 className="card-title">{def.title}</h3>
        <div className="head-actions">
          {canCompare && (
            <Metric
              label="Speed-up"
              value={`${speedup}×`}
              tone={speedup >= 1.2 ? "good" : "neutral"}
            />
          )}
          <button
            className="btn ghost"
            onClick={() => setExpanded((x) => !x)}
          >
            {expanded ? "Sakrij detalje" : "Detalji"}
          </button>
        </div>
      </div>

      {expanded && (
        <div className="card-body">
          {/* Parametri */}
          <div className="controls">
            {Object.keys(params).map((k) => (
              <label key={k} className="control">
                <span>{k}</span>
                <input
                  className="input"
                  value={params[k]}
                  onChange={(e) =>
                    setParams({ ...params, [k]: e.target.value })
                  }
                />
              </label>
            ))}
          </div>

          {/* SQL blokovi */}
          <div className="code-grid">
            {/* NEOPT */}
            <div className="code-col">
              <div className="code-head">
                <span className="badge">NEOPT</span>
                <div className="code-actions">
                  <button
                    className="btn sm"
                    onClick={() => copy(def.unopt)}
                  >
                    Copy
                  </button>
                  <button
                    className="btn"
                    onClick={() => run("unoptimized")}
                  >
                    ▶️ Pokreni
                  </button>
                </div>
              </div>
              <CodeBlock code={def.unopt} />
              <div className="metrics">
                <Metric
                  label="DB"
                  value={state.dbBase ? `${state.dbBase} ms` : "—"}
                />
                <Metric
                  label="E2E"
                  value={state.e2eBase ? `${state.e2eBase} ms` : "—"}
                />
                {showMetrics === "h3" && (
                  <>
                    <Metric
                      label="CPU"
                      value={state.cpuBase ? `${state.cpuBase} ms` : "—"}
                    />
                    <Metric
                      label="Plan reuse"
                      value={state.execBase ? `${state.execBase}×` : "—"}
                    />
                  </>
                )}
              </div>
            </div>

            {/* OPT */}
            <div className="code-col">
              <div className="code-head">
                <span className="badge good">OPT</span>
                <div className="code-actions">
                  <button
                    className="btn sm"
                    onClick={() => copy(def.opt)}
                  >
                    Copy
                  </button>
                  <button
                    className="btn"
                    onClick={() => run("optimized")}
                  >
                    ▶️ Pokreni
                  </button>
                </div>
              </div>
              <CodeBlock code={def.opt} />
              <div className="metrics">
                <Metric
                  label="DB"
                  value={state.dbOpt ? `${state.dbOpt} ms` : "—"}
                />
                <Metric
                  label="E2E"
                  value={state.e2eOpt ? `${state.e2eOpt} ms` : "—"}
                />
                {showMetrics === "h3" && (
                  <>
                    <Metric
                      label="CPU"
                      value={state.cpuOpt ? `${state.cpuOpt} ms` : "—"}
                    />
                    <Metric
                      label="Plan reuse"
                      value={state.execOpt ? `${state.execOpt}×` : "—"}
                    />
                  </>
                )}
              </div>
            </div>
          </div>

          {/* Run oba + status */}
          <div className="toolbar">
            <button
              className="btn primary"
              onClick={runBoth}
              disabled={state.loading}
            >
              {state.loading ? "Izvršavam…" : "Pokreni oba"}
            </button>
            {state.err && (
              <span className="chip danger">Greška: {state.err}</span>
            )}
            {canCompare && (
              <span className="chip">
                {Number(state.dbBase) - Number(state.dbOpt)} ms uštede (DB)
              </span>
            )}
          </div>

          {/* Rezultati */}
          <ResultTable rows={state.rows} />
        </div>
      )}
    </div>
  );
}
