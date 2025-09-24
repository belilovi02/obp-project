import React from "react";
import QueryCard from "./QueryCard.jsx";

const H2_QUERIES = {
  // Q1
  q1: {
    title: "H2 Q1 — Top korisnici po engagementu",
    params: { TopN: 20 },
    unopt: `
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
  opt: `
    SELECT TOP (@TopN) 
        UserId, 
        DisplayName,
        SUM(PostCount) + SUM(CommentTotal) + SUM(VoteCount) AS Engagement
    FROM dbo.PostDetails_MV
    WHERE Reputation > 1000
    GROUP BY UserId, DisplayName
    ORDER BY Engagement DESC;`,
  },

  // Q2
  q2: {
    title: "H2 Q2 — Najviše komentirani postovi",
    params: { TopN: 20 },
    unopt: `SELECT TOP (@TopN) p.Id, p.Title, COUNT(c.Id) AS CommentCount
FROM dbo.Posts p
JOIN dbo.Comments c ON c.PostId = p.Id
GROUP BY p.Id, p.Title
ORDER BY CommentCount DESC;`,
    opt: `SELECT TOP (@TopN) PostId, Title, CommentTotal
FROM dbo.PostDetails_MV
ORDER BY CommentTotal DESC;`,
  },

  // Q3
  q3: {
    title: "H2 Q3 — Ukupni glasovi po korisniku",
    params: {},
    unopt: `SELECT u.Id, u.DisplayName, COUNT(v.Id) AS TotalVotes
FROM dbo.Users u
JOIN dbo.Posts p ON u.Id = p.OwnerUserId
JOIN dbo.Votes v ON v.PostId = p.Id
GROUP BY u.Id, u.DisplayName
ORDER BY TotalVotes DESC;`,
    opt: `SELECT UserId, DisplayName, SUM(VoteCount) AS TotalVotes
FROM dbo.PostDetails_MV
GROUP BY UserId, DisplayName
ORDER BY TotalVotes DESC;`,
  },

  // Q4
  q4: {
    title: "H2 Q4 — Prosječni Score po korisniku",
    params: { TopN: 20 },
    unopt: `SELECT TOP (@TopN) u.Id, u.DisplayName, AVG(p.Score) AS AvgScore
FROM dbo.Users u
JOIN dbo.Posts p ON u.Id = p.OwnerUserId
GROUP BY u.Id, u.DisplayName
ORDER BY AvgScore DESC;`,
    opt: `SELECT TOP (@TopN) UserId, DisplayName, AVG(Score) AS AvgScore
FROM dbo.PostDetails_MV
GROUP BY UserId, DisplayName
ORDER BY AvgScore DESC;`,
  },

  // Q5
  q5: {
    title: "H2 Q5 — Aktivnost po danima u sedmici",
    params: {},
    unopt: `SELECT DATENAME(WEEKDAY, p.CreationDate) AS DayOfWeek, COUNT(*) AS Posts
FROM dbo.Posts p
GROUP BY DATENAME(WEEKDAY, p.CreationDate)
ORDER BY Posts DESC;`,
    opt: `SELECT DATENAME(WEEKDAY, CreationDate) AS DayOfWeek, COUNT(*) AS Posts
FROM dbo.PostDetails_MV
GROUP BY DATENAME(WEEKDAY, CreationDate)
ORDER BY Posts DESC;`,
  },

  // Q6
  q6: {
    title: "H2 Q6 — Zadnja 3 mjeseca & reputacija > 5000",
    params: {},
    unopt: `SELECT p.Id, p.Title, u.DisplayName, u.Reputation, p.Score, p.CreationDate
FROM dbo.Posts p
JOIN dbo.Users u ON p.OwnerUserId = u.Id
WHERE p.CreationDate >= '2013-10-01'
  AND p.CreationDate < '2014-01-01'
  AND u.Reputation > 5000
ORDER BY p.Score DESC;`,
    opt: `SELECT PostId, Title, DisplayName, Reputation, Score, CreationDate
FROM dbo.PostDetails_MV
WHERE CreationDate >= '2013-10-01'
  AND CreationDate < '2014-01-01'
  AND Reputation > 5000
ORDER BY Score DESC;`,
  },

  // Q7
  q7: {
    title: "H2 Q7 — Najposjećeniji postovi",
    params: { TopN: 20 },
    unopt: `SELECT TOP (@TopN) p.Id, p.Title, p.ViewCount
FROM dbo.Posts p
ORDER BY p.ViewCount DESC;`,
    opt: `SELECT TOP (@TopN) PostId, Title, ViewCount
FROM dbo.PostDetails_MV
ORDER BY ViewCount DESC;`,
  },

  // Q8
  q8: {
    title: "H2 Q8 — Najaktivnije lokacije",
    params: { TopN: 20 },
    unopt: `SELECT TOP (@TopN) u.Location, COUNT(p.Id) AS PostCount
FROM dbo.Users u
JOIN dbo.Posts p ON u.Id = p.OwnerUserId
WHERE u.Location IS NOT NULL
GROUP BY u.Location
ORDER BY PostCount DESC;`,
    opt: `SELECT TOP (@TopN) Location, COUNT(PostId) AS PostCount
FROM dbo.PostDetails_MV
WHERE Location IS NOT NULL
GROUP BY Location
ORDER BY PostCount DESC;`,
  },


  // Q10
  q10: {
    title: "H2 Q9 — Najaktivniji korisnici zadnjih 6 mjeseci",
    params: { TopN: 20 },
    unopt: `SELECT TOP 20 
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
    opt: `SELECT TOP 20 
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

  // Q11
  q11: {
    title: "H2 Q10 — Reputation Weighted Score",
    params: { TopN: 20 },
    unopt: `SELECT TOP (@TopN) u.Id, u.DisplayName,
       AVG(p.Score) * u.Reputation AS WeightedScore
FROM dbo.Users u
JOIN dbo.Posts p ON p.OwnerUserId = u.Id
GROUP BY u.Id, u.DisplayName, u.Reputation
ORDER BY WeightedScore DESC;`,
    opt: `SELECT TOP (@TopN) UserId, DisplayName,
       AVG(Score) * MAX(Reputation) AS WeightedScore
FROM dbo.PostDetails_MV
GROUP BY UserId, DisplayName
ORDER BY WeightedScore DESC;`,
  },
};

export default function H2Panel() {
  return (
    <div className="grid">
      {Object.entries(H2_QUERIES).map(([qid, def]) => (
      <QueryCard key={qid} qid={qid} def={def} apiNS="h2" showMetrics="h2" />
      ))}
    </div>
  );
}
