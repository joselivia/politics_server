import express from "express";
import { pool } from "../config-db";

const router = express.Router();

router.post("/", async (req, res) => {
  const { pollId, competitorId } = req.body;

  if (!pollId || !competitorId) {
    return res.status(400).json({ message: "pollId and competitorId are required." });
  }

  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const check = await client.query(
      `SELECT id FROM competitors WHERE id = $1 AND poll_id = $2`,
      [competitorId, pollId]
    );

    if (check.rowCount === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ message: "Competitor does not belong to the poll." });
    }

    await client.query(
      `INSERT INTO votes (poll_id, competitor_id) VALUES ($1, $2)`,
      [pollId, competitorId]
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

export default router;
