import React from "react";

export default function ResultTable({ rows }) {
  if (!rows || rows.length === 0) return null;
  const headers = Object.keys(rows[0]);
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {headers.map((h) => (
                <td key={h}>{String(r[h])}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
  
}