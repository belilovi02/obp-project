import React from "react";
import QueryCard from "./QueryCard.jsx";

const H3_QUERIES = {
  q1: {
    title: "H3 Q1 — Top korisnici po engagementu",
    params: { TopN: 20 },
    unopt:`
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
;`,
    opt: "EXEC dbo.sp_H3_Q1 @TopN = @TopN"
  },
  q2: {
    title: "H3 Q2 — Najviše komentirani postovi",
    params: { TopN: 20 },
    unopt: `
      SELECT TOP (@TopN) p.Id, p.Title, COUNT(c.Id) AS CommentCount
      FROM dbo.Posts p
      JOIN dbo.Comments c ON c.PostId=p.Id
      GROUP BY p.Id, p.Title
      ORDER BY CommentCount DESC;
    `,
    opt: "EXEC dbo.sp_H3_Q2 @TopN = @TopN"
  },
  q3: {
    title: "H3 Q3 — Ukupni glasovi po korisniku",
    params: { TopN: 20 },
    unopt: `
      SELECT TOP (@TopN) u.Id, u.DisplayName, COUNT(v.Id) AS TotalVotes
      FROM dbo.Users u
      JOIN dbo.Posts p ON u.Id=p.OwnerUserId
      JOIN dbo.Votes v ON v.PostId=p.Id
      GROUP BY u.Id, u.DisplayName
      ORDER BY TotalVotes DESC;
    `,
    opt: "EXEC dbo.sp_H3_Q3 @TopN = @TopN"
  },
  insertComment: {
    title: "H3 — Insert novi komentar",
    params: { PostId: 1, UserId: 1, Text: "Komentar" },
    unopt: `
      INSERT INTO dbo.Comments (PostId, UserId, Text, CreationDate)
      OUTPUT INSERTED.Id, INSERTED.PostId, INSERTED.UserId
      VALUES (@PostId, @UserId, @Text, GETDATE());
    `,
    opt: "EXEC dbo.sp_H3_InsertComment @PostId=@PostId, @UserId=@UserId, @Text=@Text"
  },
  updateReputation: {
    title: "H3 — Update reputacije korisnika",
    params: { UserId: 1, Delta: 10 },
    unopt: `
      UPDATE dbo.Users SET Reputation = Reputation + @Delta WHERE Id = @UserId;
    `,
    opt: "EXEC dbo.sp_H3_UpdateReputation @UserId=@UserId, @Delta=@Delta"
  },
  deleteComment: {
    title: "H3 — Delete komentar",
    params: { CommentId: 1 },
    unopt: `
      DELETE FROM dbo.Comments WHERE Id = @CommentId;
    `,
    opt: "EXEC dbo.sp_H3_DeleteComment @CommentId=@CommentId"
  }
};

export default function H3Panel() {
  return (
    <div className="grid">
      {Object.entries(H3_QUERIES).map(([qid, def]) => (
        <QueryCard
  key={qid}
  apiNS="h3"
  qid={qid}
  def={def}
  showMetrics="h3"
/>
      ))}
    </div>
  );
}
