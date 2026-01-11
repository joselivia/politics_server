import express from "express";
import { pool } from "../config-db";
import rateLimit from "express-rate-limit";
const router = express.Router();
const voteLimiter = rateLimit({
  windowMs: 1000,
  max: 1,
  message: "Too many requests from this IP, slow down.",
});
router.post("/", voteLimiter, async (req, res) => {
  const { id, competitorId,voter_id } = req.body;

  if (!id || !competitorId) {
    return res.status(400).json({ message: "pollId and competitorId are required." });
  }
  const client = await pool.connect();

try {
  await client.query("BEGIN");

  const pollSettings = await client.query(
    `SELECT allow_multiple_votes FROM polls WHERE id = $1`,
    [id]
  );

  const allowMultiple = pollSettings.rows[0]?.allow_multiple_votes;
  if (!allowMultiple) {
    const alreadyVoted = await client.query(
      `SELECT 1 FROM votes WHERE poll_id = $1 AND voter_id = $2`,
      [id, voter_id]
    );

    if (alreadyVoted?.rowCount && alreadyVoted.rowCount > 0) {
      await client.query("ROLLBACK");
      return res.status(403).json({ message: "You have already voted in this poll." });
    }
  }

  const check = await client.query(
    `SELECT id FROM competitors WHERE id = $1 AND poll_id = $2`,
    [competitorId, id]
  );

  if (check.rowCount === 0) {
    await client.query("ROLLBACK");
    return res.status(400).json({ message: "Competitor does not belong to the poll." });
  }

  await client.query(
    `INSERT INTO votes (poll_id, competitor_id, voter_id) VALUES ($1, $2, $3)`,
    [id, competitorId, voter_id]
  );

  await client.query(
    `UPDATE polls SET total_votes = total_votes + 1 WHERE id = $1`,
    [id]
  );

  await client.query("COMMIT");

  return res.status(200).json({ message: "Vote recorded successfully!" });
} catch (error) {
  await client.query("ROLLBACK");
  console.error("Vote Error:", error);
  return res.status(500).json({ message: "Internal server error while recording vote." });
} finally {
  client.release();
}

});
router.get("/status", async (req, res) => {
  const { pollId, voter_id } = req.query;

  if (!pollId || !voter_id) {
    return res.status(400).json({ message: "Missing pollId or voter_id" });
  }

  try {
    const result = await pool.query(
      `SELECT 1 FROM votes WHERE poll_id = $1 AND voter_id = $2`,
      [pollId, voter_id]
    );

const alreadyVoted = result.rowCount !== null && result.rowCount > 0;
    return res.json({ alreadyVoted });
  } catch (err) {
    console.error("Vote status check error:", err);
    return res.status(500).json({ message: "Server error checking vote status." });
  }
});
router.patch("/:id/allow-multiple", async (req, res) => {
  const pollId = parseInt(req.params.id);
  const { allow_multiple_votes } = req.body;

  if (isNaN(pollId) || typeof allow_multiple_votes !== "boolean") {
    return res.status(400).json({ message: "Invalid poll ID or vote setting." });
  }

  try {
    await pool.query(
      `UPDATE polls SET allow_multiple_votes = $1 WHERE id = $2`,
      [allow_multiple_votes, pollId]
    );
    return res.status(200).json({ message: `Multiple voting ${allow_multiple_votes ? "enabled" : "disabled"}.` });
  } catch (err) {
    console.error("Failed to update voting mode:", err);
    return res.status(500).json({ message: "Server error." });
  }
});

export default router;
