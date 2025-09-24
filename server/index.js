const express = require("express");
const sql = require("mssql");
const cors = require("cors");

const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

const port = process.env.PORT || 5000;

const config = {
  user: process.env.DB_USER || "appuser",
  password: process.env.DB_PASS || "appuser",
  server: process.env.DB_HOST || "host.docker.internal",
  database: process.env.DB_NAME || "StackOverflow2013",
  port: process.env.DB_PORT ? +process.env.DB_PORT : 1433,
  options: { encrypt: false, trustServerCertificate: true },
  requestTimeout: 240000,
  connectionTimeout: 30000,
};

let poolPromise;
async function getPool() {
  if (!poolPromise) poolPromise = sql.connect(config);
  return poolPromise;
}

async function runQueryTimed(query, params = {}) {
  const pool = await getPool();
  const req = pool.request();
  for (const [k, v] of Object.entries(params)) {
    if (v === null || v === undefined) continue;
    if (typeof v === "number") req.input(k, sql.Int, v);
    else if (v instanceof Date) req.input(k, sql.DateTime2, v);
    else req.input(k, sql.NVarChar, String(v));
  }
  const t0 = Date.now();
  const result = await req.query(query);
  const t1 = Date.now();
  return { durationMs: t1 - t0, rows: result.recordset };
}
async function runWithMetrics(pool, sqlReqFn) {
  // E2E start
  const e2eStart = Date.now();

  // DB execution start
  const t0 = Date.now();
  const result = await sqlReqFn();
  const t1 = Date.now();

  // CPU statistika iz DMV
  const cpuStats = await pool.request().query(`
  SELECT TOP 1 
    (total_worker_time / execution_count) / 1000.0 AS avg_cpu_time_ms,
    (total_elapsed_time / execution_count) / 1000.0 AS avg_duration_ms,
    execution_count
  FROM sys.dm_exec_query_stats
  ORDER BY last_execution_time DESC;
`);

const cpu = cpuStats.recordset[0]?.avg_cpu_time_ms || 0;
const execCount = cpuStats.recordset[0]?.execution_count || 1;


  const e2eEnd = Date.now();

  return {
    rows: result.recordset || [],
    dbTime: t1 - t0,          // samo vrijeme DB izvršavanja
    e2eTime: e2eEnd - e2eStart, // end-to-end (uklj. network, serialization…)
    cpu,
    execCount
  };
}


// ========================== H1 upiti ==========================
const H1 = {
  // -------- SELECT --------
  q1: {
    defaults: { TopN: 100, Year: 2010, MinRep: 1000 },
    unoptimized: `
      SELECT TOP (@TopN) u.Id, u.DisplayName, COUNT(c.Id) AS CommentCount
      FROM dbo.Users u
      JOIN dbo.Comments c ON u.Id = c.UserId
      WHERE YEAR(c.CreationDate) = @Year AND u.Reputation >= @MinRep
      GROUP BY u.Id, u.DisplayName
      ORDER BY CommentCount DESC;`,
    optimized: `
      SELECT TOP (@TopN) u.Id, u.DisplayName, COUNT(c.Id) AS CommentCount
      FROM dbo.Users u
      JOIN dbo.Comments c WITH (INDEX(IX_Comments_UserId_CreationDate)) ON u.Id = c.UserId
      WHERE c.CreationDate >= DATEFROMPARTS(@Year,1,1)
        AND c.CreationDate < DATEFROMPARTS(@Year+1,1,1)
        AND u.Reputation >= @MinRep
      GROUP BY u.Id, u.DisplayName
      ORDER BY CommentCount DESC;`,
  },

  q2: {
    defaults: { TopN: 200 },
    unoptimized: `
      SELECT TOP (@TopN) u.Id, u.DisplayName, COUNT(v.Id) AS VoteCount
      FROM dbo.Users u
      JOIN dbo.Posts p ON p.OwnerUserId = u.Id
      JOIN dbo.Votes v ON v.PostId = p.Id
      WHERE v.VoteTypeId = 2   -- npr. upvotes
      GROUP BY u.Id, u.DisplayName
      ORDER BY VoteCount DESC;`,
    optimized: `
      SELECT TOP (@TopN) u.Id, u.DisplayName, COUNT(v.Id) AS VoteCount
      FROM dbo.Users u
      JOIN dbo.Posts p WITH (INDEX(IX_Posts_OwnerUserId)) ON p.OwnerUserId = u.Id
      JOIN dbo.Votes v WITH (INDEX(IX_Votes_PostId_VoteTypeId)) ON v.PostId = p.Id
      WHERE v.VoteTypeId = 2
      GROUP BY u.Id, u.DisplayName
      ORDER BY VoteCount DESC;`,
  },

  q3: {
    defaults: { TopN: 100, VoteTypeId: 2 },
    unoptimized: `
      SELECT TOP (@TopN) p.Id, p.Title, COUNT(*) AS Upvotes
      FROM dbo.Posts p
      JOIN dbo.Votes v ON v.PostId = p.Id
      WHERE p.PostTypeId = 1 AND v.VoteTypeId = @VoteTypeId
      GROUP BY p.Id, p.Title
      ORDER BY Upvotes DESC;`,
    optimized: `
      SELECT TOP (@TopN) p.Id, p.Title, COUNT(*) AS Upvotes
      FROM dbo.Posts p
      JOIN dbo.Votes v WITH (INDEX(IX_Votes_VoteTypeId_PostId)) ON v.PostId = p.Id
      WHERE p.PostTypeId = 1 AND v.VoteTypeId = @VoteTypeId
      GROUP BY p.Id, p.Title
      ORDER BY Upvotes DESC;`,
  },

  q4: {
    defaults: { MinAns: 50, MinScore: 5 },
    unoptimized: `
      SELECT u.Id, u.DisplayName, COUNT(p.Id) AS AnswerCount, AVG(p.Score) AS AvgScore
      FROM dbo.Users u
      JOIN dbo.Posts p ON p.OwnerUserId = u.Id
      WHERE p.PostTypeId = 2
      GROUP BY u.Id, u.DisplayName
      HAVING COUNT(p.Id) >= @MinAns AND AVG(p.Score) > @MinScore
      ORDER BY AnswerCount DESC;`,
    optimized: `
      SELECT u.Id, u.DisplayName, COUNT(p.Id) AS AnswerCount, AVG(p.Score) AS AvgScore
      FROM dbo.Users u
      JOIN dbo.Posts p WITH (INDEX(IX_Posts_OwnerUserId_PostTypeId_Score)) 
        ON p.OwnerUserId = u.Id AND p.PostTypeId = 2
      GROUP BY u.Id, u.DisplayName
      HAVING COUNT(p.Id) >= @MinAns AND AVG(p.Score) > @MinScore
      ORDER BY AnswerCount DESC;`,
  },

  q5: {
  defaults: { TopN: 30 },
  unoptimized: `
    SELECT TOP (@TopN)
        u.Id,
        u.DisplayName,
        COUNT(p.Id) AS AnswerCount,
        AVG(p.Score) AS AvgScore
    FROM dbo.Users u
    JOIN dbo.Posts p ON p.OwnerUserId = u.Id
    WHERE p.PostTypeId = 2
    GROUP BY u.Id, u.DisplayName
    HAVING AVG(p.Score) > (
        SELECT AVG(Score) FROM dbo.Posts WHERE PostTypeId = 2
    )
    ORDER BY AnswerCount DESC;`,
  optimized: `
    SELECT TOP (@TopN)
        u.Id,
        u.DisplayName,
        COUNT(p.Id) AS AnswerCount,
        AVG(p.Score) AS AvgScore
    FROM dbo.Users u
    JOIN dbo.Posts p WITH (INDEX(IX_Posts_OwnerUserId_PostTypeId_Score))
        ON p.OwnerUserId = u.Id AND p.PostTypeId = 2
    GROUP BY u.Id, u.DisplayName
    HAVING AVG(p.Score) > (
        SELECT AVG(Score) FROM dbo.Posts WITH (INDEX(IX_Posts_PostTypeId_Score)) WHERE PostTypeId = 2
    )
    ORDER BY AnswerCount DESC;`,
},


  q6: {
    defaults: {},
    unoptimized: `
      SELECT u.Id, u.DisplayName
      FROM dbo.Users u
      WHERE EXISTS (
        SELECT 1 FROM dbo.Posts p
        WHERE p.OwnerUserId = u.Id AND p.PostTypeId = 1 AND YEAR(p.CreationDate) = 2008
      )
      AND EXISTS (
        SELECT 1 FROM dbo.Posts p
        WHERE p.OwnerUserId = u.Id AND p.PostTypeId = 1 AND YEAR(p.CreationDate) = 2009
      )
      AND EXISTS (
        SELECT 1 FROM dbo.Posts p
        WHERE p.OwnerUserId = u.Id AND p.PostTypeId = 1 AND YEAR(p.CreationDate) = 2010
      );`,
    optimized: `
      SELECT u.Id, u.DisplayName
      FROM dbo.Users u
      WHERE EXISTS (
        SELECT 1 FROM dbo.Posts p WITH (INDEX(IX_Posts_OwnerUserId_CreationDate_PostTypeId))
        WHERE p.OwnerUserId = u.Id AND p.PostTypeId = 1 
          AND p.CreationDate >= '2008-01-01' AND p.CreationDate < '2009-01-01'
      )
      AND EXISTS (
        SELECT 1 FROM dbo.Posts p WITH (INDEX(IX_Posts_OwnerUserId_CreationDate_PostTypeId))
        WHERE p.OwnerUserId = u.Id AND p.PostTypeId = 1 
          AND p.CreationDate >= '2009-01-01' AND p.CreationDate < '2010-01-01'
      )
      AND EXISTS (
        SELECT 1 FROM dbo.Posts p WITH (INDEX(IX_Posts_OwnerUserId_CreationDate_PostTypeId))
        WHERE p.OwnerUserId = u.Id AND p.PostTypeId = 1 
          AND p.CreationDate >= '2010-01-01' AND p.CreationDate < '2011-01-01'
      );`,
  },

  q7: {
    defaults: { TopN: 200, MinRep: 1000 },
    unoptimized: `
      SELECT TOP (@TopN) u.Id, u.DisplayName, MAX(p.CreationDate) AS LastPost
      FROM dbo.Users u
      JOIN dbo.Posts p ON p.OwnerUserId = u.Id
      WHERE u.Reputation >= @MinRep
      GROUP BY u.Id, u.DisplayName
      ORDER BY LastPost DESC;`,
    optimized: `
      SELECT TOP (@TopN) u.Id, u.DisplayName, MAX(p.CreationDate) AS LastPost
      FROM dbo.Users u WITH (INDEX(IX_Users_Reputation_Id))
      JOIN dbo.Posts p WITH (INDEX(IX_Posts_OwnerUserId_CreationDate)) ON p.OwnerUserId = u.Id
      WHERE u.Reputation >= @MinRep
      GROUP BY u.Id, u.DisplayName
      ORDER BY LastPost DESC;`,
  },

};


// ========================== H2 upiti ==========================
// Denormalizacija (PostDetails_MV) vs Normalizacija (JOIN/podupiti)
const H2 = {
  q1: {
  defaults: { TopN: 20 },
  unoptimized: `
    SELECT TOP (@TopN) 
        u.Id, 
        u.DisplayName,
        COUNT(p.Id) AS PostCount,
        COUNT(c.Id) AS CommentCount,
        COUNT(v.Id) AS VoteCount,
        (COUNT(p.Id) + COUNT(c.Id) + COUNT(v.Id)) AS Engagement
    FROM dbo.Users u
    LEFT JOIN dbo.Posts p ON u.Id = p.OwnerUserId
    LEFT JOIN dbo.Comments c ON c.PostId = p.Id
    LEFT JOIN dbo.Votes v ON v.PostId = p.Id
    WHERE u.Reputation > 1000
    GROUP BY u.Id, u.DisplayName
    ORDER BY Engagement DESC;`,
  optimized: `
    SELECT TOP (@TopN)
    UserId,
    DisplayName,
    COUNT(PostId) AS PostCount,
    SUM(CommentTotal) AS CommentCount,
    SUM(VoteCount) AS VoteCount,
    (COUNT(PostId) + SUM(CommentTotal) + SUM(VoteCount)) AS Engagement
FROM dbo.PostDetails_MV
WHERE Reputation > 1000
GROUP BY UserId, DisplayName
ORDER BY Engagement DESC;`
},

  q2: {
    defaults: { TopN: 20 },
    unoptimized: `
      SELECT TOP (@TopN) p.Id, p.Title, COUNT(c.Id) AS CommentCount
      FROM dbo.Posts p
      JOIN dbo.Comments c ON c.PostId = p.Id
      GROUP BY p.Id, p.Title
      ORDER BY CommentCount DESC;`,
    optimized: `
      SELECT TOP (@TopN) PostId, Title, CommentTotal
      FROM dbo.PostDetails_MV
      ORDER BY CommentTotal DESC;`,
  },

  q3: {
    defaults: {},
    unoptimized: `
      SELECT u.Id, u.DisplayName, COUNT(v.Id) AS TotalVotes
      FROM dbo.Users u
      JOIN dbo.Posts p ON u.Id = p.OwnerUserId
      JOIN dbo.Votes v ON v.PostId = p.Id
      GROUP BY u.Id, u.DisplayName
      ORDER BY TotalVotes DESC;`,
    optimized: `
      SELECT UserId, DisplayName, SUM(VoteCount) AS TotalVotes
      FROM dbo.PostDetails_MV
      GROUP BY UserId, DisplayName
      ORDER BY TotalVotes DESC;`,
  },

  q4: {
    defaults: { TopN: 20 },
    unoptimized: `
      SELECT TOP (@TopN) u.Id, u.DisplayName, AVG(p.Score) AS AvgScore
      FROM dbo.Users u
      JOIN dbo.Posts p ON u.Id = p.OwnerUserId
      GROUP BY u.Id, u.DisplayName
      ORDER BY AvgScore DESC;`,
    optimized: `
      SELECT TOP (@TopN) UserId, DisplayName, AVG(Score) AS AvgScore
      FROM dbo.PostDetails_MV
      GROUP BY UserId, DisplayName
      ORDER BY AvgScore DESC;`,
  },

  q5: {
    defaults: {},
    unoptimized: `
      SELECT DATENAME(WEEKDAY, p.CreationDate) AS DayOfWeek, COUNT(*) AS Posts
      FROM dbo.Posts p
      GROUP BY DATENAME(WEEKDAY, p.CreationDate)
      ORDER BY Posts DESC;`,
    optimized: `
      SELECT DATENAME(WEEKDAY, CreationDate) AS DayOfWeek, COUNT(*) AS Posts
      FROM dbo.PostDetails_MV
      GROUP BY DATENAME(WEEKDAY, CreationDate)
      ORDER BY Posts DESC;`,
  },

  q6: {
    defaults: {},
    unoptimized: `
      SELECT p.Id, p.Title, u.DisplayName, u.Reputation, p.Score, p.CreationDate
FROM dbo.Posts p
JOIN dbo.Users u ON p.OwnerUserId = u.Id
WHERE p.CreationDate >= '2013-10-01'
  AND p.CreationDate < '2014-01-01'
  AND u.Reputation > 5000
ORDER BY p.Score DESC;`,
    optimized: `
      SELECT PostId, Title, DisplayName, Reputation, Score, CreationDate
FROM dbo.PostDetails_MV
WHERE CreationDate >= '2013-10-01'
  AND CreationDate < '2014-01-01'
  AND Reputation > 5000
ORDER BY Score DESC;`,
  },

  q7: {
    defaults: { TopN: 20 },
    unoptimized: `
      SELECT TOP (@TopN) p.Id, p.Title, p.ViewCount
      FROM dbo.Posts p
      ORDER BY p.ViewCount DESC;`,
    optimized: `
      SELECT TOP (@TopN) PostId, Title, ViewCount
      FROM dbo.PostDetails_MV
      ORDER BY ViewCount DESC;`,
  },

  q8: {
    defaults: { TopN: 20 },
    unoptimized: `
      SELECT TOP (@TopN) u.Location, COUNT(p.Id) AS PostCount
      FROM dbo.Users u
      JOIN dbo.Posts p ON u.Id = p.OwnerUserId
      WHERE u.Location IS NOT NULL
      GROUP BY u.Location
      ORDER BY PostCount DESC;`,
    optimized: `
      SELECT TOP (@TopN) Location, COUNT(PostId) AS PostCount
      FROM dbo.PostDetails_MV
      WHERE Location IS NOT NULL
      GROUP BY Location
      ORDER BY PostCount DESC;`,
  },

  q10: {
    defaults: { TopN: 20 },
    unoptimized: `
      SELECT TOP 20 
       u.Id, 
       u.DisplayName,
       COUNT(DISTINCT p.Id) AS PostCount,
       COUNT(DISTINCT c.Id) AS CommentCount,
       COUNT(DISTINCT v.Id) AS VoteCount
FROM dbo.Users u
LEFT JOIN dbo.Posts p 
       ON u.Id = p.OwnerUserId 
      AND p.CreationDate >= '2013-07-01' 
      AND p.CreationDate < '2014-01-01'
LEFT JOIN dbo.Comments c 
       ON c.PostId = p.Id
LEFT JOIN dbo.Votes v 
       ON v.PostId = p.Id
GROUP BY u.Id, u.DisplayName
ORDER BY (COUNT(DISTINCT p.Id) + COUNT(DISTINCT c.Id) + COUNT(DISTINCT v.Id)) DESC;`,
    optimized: `
     SELECT TOP 20 
       UserId, 
       DisplayName,
       COUNT(PostId) AS PostCount,
       SUM(CommentTotal) AS CommentCount,
       SUM(VoteCount) AS VoteCount
FROM dbo.PostDetails_MV
WHERE CreationDate >= '2013-07-01' 
  AND CreationDate < '2014-01-01'
GROUP BY UserId, DisplayName
ORDER BY (COUNT(PostId) + SUM(CommentTotal) + SUM(VoteCount)) DESC;`,
  },

  q11: {
    defaults: { TopN: 20 },
    unoptimized: `
      SELECT TOP (@TopN) u.Id, u.DisplayName,
             AVG(p.Score) * u.Reputation AS WeightedScore
      FROM dbo.Users u
      JOIN dbo.Posts p ON p.OwnerUserId = u.Id
      GROUP BY u.Id, u.DisplayName, u.Reputation
      ORDER BY WeightedScore DESC;`,
    optimized: `
      SELECT TOP (@TopN) UserId, DisplayName,
             AVG(Score) * MAX(Reputation) AS WeightedScore
      FROM dbo.PostDetails_MV
      GROUP BY UserId, DisplayName
      ORDER BY WeightedScore DESC;`,
  },
};

const H3 = {
  q1: {
  sql: `
    SELECT TOP (@TopN) 
    u.Id, 
    u.DisplayName,
    COUNT(p.Id) AS PostCount,
    COUNT(c.Id) AS CommentCount,
    COUNT(v.Id) AS VoteCount,
    (COUNT(p.Id) + COUNT(c.Id) + COUNT(v.Id)) AS Engagement
FROM dbo.Users u
LEFT JOIN dbo.Posts p ON u.Id = p.OwnerUserId
LEFT JOIN dbo.Comments c ON c.PostId = p.Id
LEFT JOIN dbo.Votes v ON v.PostId = p.Id
WHERE u.Reputation > 1000
GROUP BY u.Id, u.DisplayName
ORDER BY Engagement DESC;
`,
  sp: "sp_H3_Q1",
  defaults: { TopN: 20 }
},

  q2: {
    sql: `
      SELECT TOP (@TopN) p.Id, p.Title, COUNT(c.Id) AS CommentCount
      FROM dbo.Posts p
      JOIN dbo.Comments c ON c.PostId=p.Id
      GROUP BY p.Id, p.Title
      ORDER BY CommentCount DESC;`,
    sp: "sp_H3_Q2",
    defaults: { TopN: 20 }
  },
  q3: {
    sql: `
      SELECT TOP (@TopN) u.Id, u.DisplayName, COUNT(v.Id) AS TotalVotes
      FROM dbo.Users u
      JOIN dbo.Posts p ON u.Id=p.OwnerUserId
      JOIN dbo.Votes v ON v.PostId=p.Id
      GROUP BY u.Id, u.DisplayName
      ORDER BY TotalVotes DESC;`,
    sp: "sp_H3_Q3",
    defaults: { TopN: 20 }
  },
  insertComment: {
    sql: `
      INSERT INTO dbo.Comments (PostId, UserId, Text, CreationDate)
      OUTPUT INSERTED.Id, INSERTED.PostId, INSERTED.UserId
      VALUES (@PostId, @UserId, @Text, GETDATE());`,
    sp: "sp_H3_InsertComment",
    defaults: { PostId: 1, UserId: 1, Text: "Test komentar" }
  },
  updateReputation: {
    sql: `UPDATE dbo.Users SET Reputation = Reputation + @Delta WHERE Id = @UserId;`,
    sp: "sp_H3_UpdateReputation",
    defaults: { UserId: 1, Delta: 10 }
  },
  deleteComment: {
    sql: `DELETE FROM dbo.Comments WHERE Id = @CommentId;`,
    sp: "sp_H3_DeleteComment",
    defaults: { CommentId: 1 }
  }
};


// ========================== ROUTES ==========================
app.get("/api/h1/:qid/:variant", async (req, res) => {
  try {
    const { qid, variant } = req.params;
    const entry = H1[qid];
    if (!entry) return res.status(404).json({ error: "Unknown qid" });
    if (!["unoptimized", "optimized"].includes(variant))
      return res
        .status(400)
        .json({ error: "variant must be unoptimized|optimized" });

    const params = { ...(entry.defaults || {}) };
    for (const [k, v] of Object.entries(req.query))
      params[k] = isNaN(v) ? v : +v;

    const sqlText = entry[variant];
    const out = await runQueryTimed(sqlText, params);
    res.set("X-Query-Time", String(out.durationMs));
    res.json(out);
  } catch (err) {
    console.error("H1_ERR", err);
    res.status(500).json({ error: err.message });
  }
});
// H2 ruta
app.get("/api/h2/:qid/:variant", async (req, res) => {
  try {
    const { qid, variant } = req.params;
    const entry = H2[qid];
    if (!entry) return res.status(404).json({ error: "Unknown qid" });
    if (!["unoptimized", "optimized"].includes(variant))
      return res.status(400).json({ error: "variant must be unoptimized|optimized" });

    const params = { ...(entry.defaults || {}) };
    for (const [k, v] of Object.entries(req.query))
      params[k] = isNaN(v) ? v : +v;

    const sqlText = entry[variant];
    const out = await runQueryTimed(sqlText, params);
    res.set("X-Query-Time", String(out.durationMs));
    res.json(out);
  } catch (err) {
    console.error("H2_ERR", err);
    res.status(500).json({ error: err.message });
  }
});


// H3 ruta
app.get("/api/h3/:qid/:variant", async (req, res) => {
  try {
    const { qid, variant } = req.params;
    const entry = H3[qid];
    if (!entry) return res.status(404).json({ error: "Nepoznat H3 query" });

    const pool = await getPool();
    const sqlReq = pool.request();

    const params = { ...(entry.defaults || {}), ...req.query };
    for (const [k, v] of Object.entries(params)) {
      sqlReq.input(k, isNaN(v) ? sql.NVarChar : sql.Int, v);
    }

    let result;
    if (variant === "unoptimized") {
    result = await runWithMetrics(pool, () => sqlReq.query(entry.sql));
    } else {
    result = await runWithMetrics(pool, () => sqlReq.execute(entry.sp));
    } 

    res.set("X-Query-Time", String(result.dbTime));

    res.json({
    rows: result.rows,
    dbTime: result.dbTime,
    e2eTime: result.e2eTime,
    cpu: result.cpu,
    execCount: result.execCount
    });


  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get("/api/test", (_, res) => res.send("OK"));

app.listen(port, () =>
  console.log(`API running on http://localhost:${port}`)
);
