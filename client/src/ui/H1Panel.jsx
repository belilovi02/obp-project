import React from "react";
import QueryCard from "./QueryCard.jsx";

const H1_QUERIES = {
  // ---------------------- SELECT ----------------------
  q1: {
    title: "Q1 — Komentari po korisniku (godina, reputacija)",
    params: { TopN: 100, Year: 2010, MinRep: 1000 },
    unopt: `SELECT TOP (@TopN) u.Id, u.DisplayName, COUNT(c.Id) AS CommentCount
FROM dbo.Users u
JOIN dbo.Comments c ON u.Id = c.UserId
WHERE YEAR(c.CreationDate) = @Year AND u.Reputation >= @MinRep
GROUP BY u.Id, u.DisplayName
ORDER BY CommentCount DESC;`,
    opt: `SELECT TOP (@TopN) u.Id, u.DisplayName, COUNT(c.Id) AS CommentCount
FROM dbo.Users u
JOIN dbo.Comments c WITH (INDEX(IX_Comments_UserId_CreationDate)) ON u.Id = c.UserId
WHERE c.CreationDate >= DATEFROMPARTS(@Year,1,1)
  AND c.CreationDate < DATEFROMPARTS(@Year+1,1,1)
  AND u.Reputation >= @MinRep
GROUP BY u.Id, u.DisplayName
ORDER BY CommentCount DESC;`,
  },

  q2: {
    title: "Q2 — Najaktivniji korisnici glasovima",
    params: { TopN: 200 },
    unopt: `SELECT TOP (@TopN) u.Id, u.DisplayName, COUNT(v.Id) AS VoteCount
FROM dbo.Users u
JOIN dbo.Posts p ON p.OwnerUserId = u.Id
JOIN dbo.Votes v ON v.PostId = p.Id
WHERE v.VoteTypeId = 2   -- npr. upvotes
GROUP BY u.Id, u.DisplayName
ORDER BY VoteCount DESC;`,
    opt: `SELECT TOP (@TopN) u.Id, u.DisplayName, COUNT(v.Id) AS VoteCount
FROM dbo.Users u
JOIN dbo.Posts p WITH (INDEX(IX_Posts_OwnerUserId)) ON p.OwnerUserId = u.Id
JOIN dbo.Votes v WITH (INDEX(IX_Votes_PostId_VoteTypeId)) ON v.PostId = p.Id
WHERE v.VoteTypeId = 2
GROUP BY u.Id, u.DisplayName
ORDER BY VoteCount DESC;`,
  },

  q3: {
    title: "Q3 — Pitanja sa najviše upvote-ova",
    params: { TopN: 100, VoteTypeId: 2 },
    unopt: `SELECT TOP (@TopN) p.Id, p.Title, COUNT(*) AS Upvotes
FROM dbo.Posts p
JOIN dbo.Votes v ON v.PostId = p.Id
WHERE p.PostTypeId = 1 AND v.VoteTypeId = @VoteTypeId
GROUP BY p.Id, p.Title
ORDER BY Upvotes DESC;`,
    opt: `SELECT TOP (@TopN) p.Id, p.Title, COUNT(*) AS Upvotes
FROM dbo.Posts p
JOIN dbo.Votes v WITH (INDEX(IX_Votes_VoteTypeId_PostId)) ON v.PostId = p.Id
WHERE p.PostTypeId = 1 AND v.VoteTypeId = @VoteTypeId
GROUP BY p.Id, p.Title
ORDER BY Upvotes DESC;`,
  },

  q4: {
    title: "Q4 — Korisnici sa min. brojem odgovora i prosjekom score-a",
    params: { MinAns: 50, MinScore: 5 },
    unopt: `SELECT u.Id, u.DisplayName, COUNT(p.Id) AS AnswerCount, AVG(p.Score) AS AvgScore
FROM dbo.Users u
JOIN dbo.Posts p ON p.OwnerUserId = u.Id
WHERE p.PostTypeId = 2
GROUP BY u.Id, u.DisplayName
HAVING COUNT(p.Id) >= @MinAns AND AVG(p.Score) > @MinScore
ORDER BY AnswerCount DESC;`,
    opt: `SELECT u.Id, u.DisplayName, COUNT(p.Id) AS AnswerCount, AVG(p.Score) AS AvgScore
FROM dbo.Users u
JOIN dbo.Posts p WITH (INDEX(IX_Posts_OwnerUserId_PostTypeId_Score)) 
  ON p.OwnerUserId = u.Id AND p.PostTypeId = 2
GROUP BY u.Id, u.DisplayName
HAVING COUNT(p.Id) >= @MinAns AND AVG(p.Score) > @MinScore
ORDER BY AnswerCount DESC;`,
  },

  q5: {
  title: "Q5 — Top korisnici po broju odgovora iznad prosjeka",
  params: { TopN: 30 },
  unopt: `SELECT TOP (@TopN)
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
  opt: `SELECT TOP (@TopN)
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
    title: "Q6 — Korisnici aktivni tri godine zaredom",
    params: {},
    unopt: `SELECT u.Id, u.DisplayName
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
    opt: `SELECT u.Id, u.DisplayName
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
    title: "Q7 — Najproduktivniji korisnici sa reputacijom",
    params: { TopN: 200, MinRep: 1000 },
    unopt: `SELECT TOP (@TopN) u.Id, u.DisplayName, MAX(p.CreationDate) AS LastPost
FROM dbo.Users u
JOIN dbo.Posts p ON p.OwnerUserId = u.Id
WHERE u.Reputation >= @MinRep
GROUP BY u.Id, u.DisplayName
ORDER BY LastPost DESC;`,
    opt: `SELECT TOP (@TopN) u.Id, u.DisplayName, MAX(p.CreationDate) AS LastPost
FROM dbo.Users u WITH (INDEX(IX_Users_Reputation_Id))
JOIN dbo.Posts p WITH (INDEX(IX_Posts_OwnerUserId_CreationDate)) ON p.OwnerUserId = u.Id
WHERE u.Reputation >= @MinRep
GROUP BY u.Id, u.DisplayName
ORDER BY LastPost DESC;`,
  },
};

export default function H1Panel() {
  return (
    <div className="grid">
      {Object.entries(H1_QUERIES).map(([qid, def]) => (
        <QueryCard key={qid} qid={qid} def={def} apiNS="h1" showMetrics="h1" />
      ))}
    </div>
  );
}
