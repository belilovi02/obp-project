import React from "react";
export default function CodeBlock({ code }) {
  return (
    <pre className="code">
      <code>{code}</code>
    </pre>
  );
}
