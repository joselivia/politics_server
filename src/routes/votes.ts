import express from "express";
import { pool } from "../config-db";

const router = express.Router();

router.post("/", async (req, res) => {
  const { pollId, competitorId,voter_id } = req.body;

  if (!pollId || !competitorId) {
    return res.status(400).json({ message: "pollId and competitorId are required." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");
const alreadyVoted = await client.query(
  `SELECT 1 FROM votes WHERE poll_id = $1 AND voter_id = $2`,
  [pollId, voter_id]
);

if (alreadyVoted.rowCount !== null && alreadyVoted.rowCount > 0) {
  await client.query("ROLLBACK");
  return res.status(403).json({ message: "You have already voted in this poll." });
}
    const check = await client.query(
      `SELECT id FROM competitors WHERE id = $1 AND poll_id = $2`,
      [competitorId, pollId]
    );

    if (check.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Competitor does not belong to the poll." });
    }

    await client.query(
      `INSERT INTO votes (poll_id, competitor_id, voter_id) VALUES ($1, $2, $3)`,
      [pollId, competitorId, voter_id]
    );

    // Update total_votes in polls table
    await client.query(
      `UPDATE polls SET total_votes = total_votes + 1 WHERE id = $1`,
      [pollId]
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
export default router;
