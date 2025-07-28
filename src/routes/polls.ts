import express from "express";
import multer from "multer";
import { pool } from "../config-db";
import { PoolClient } from "pg";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", upload.any(), async (req, res) => {
  const {
    title,
    category,
    presidential,
    region,
    county,
    constituency,
    ward,
    competitors: competitorsJson,
  } = req.body;

  if (!title || !category || !region) {
    return res.status(400).json({ message: "Missing required fields for poll creation." });
  }

  let client: PoolClient | null = null;

  try {
    const competitors = JSON.parse(competitorsJson || "[]");

    client = await pool.connect();
    await client.query("BEGIN");

const pollResult = await client.query(
  `INSERT INTO polls (title, category, presidential, region, county, constituency, ward, created_at, total_votes)
   VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), 0) RETURNING id`,
  [title, category, presidential, region, county, constituency, ward]
);

    const pollId = pollResult.rows[0].id;
    for (let i = 0; i < competitors.length; i++) {
      const { name, party } = competitors[i];
      const filesArray = Array.isArray(req.files) ? req.files : [];
      const file = filesArray.find((f: any) => f.fieldname === `profile${i}`);
      const profileImageBuffer = file?.buffer ?? null;

      await client.query(
        `INSERT INTO competitors (poll_id, name, party, profile_image)
         VALUES ($1, $2, $3, $4)`,
        [pollId, name, party, profileImageBuffer]
      );
    }await client.query("COMMIT");
    return res.status(201).json({ success: true, id: pollId });
  } catch (error) {
    if (client) await client.query("ROLLBACK");
    console.error("Error creating poll:", error);
    return res.status(500).json({ message: "Server error during poll creation." });
  } finally {
    if (client) client.release();
  }
});
router.get("/", async (req, res) => {
  const { category } = req.query;

  try {
    let result;

    if (category) {
      result = await pool.query(
        `SELECT id, title, created_at AS "lastUpdated", category
         FROM polls
         WHERE category = $1
         ORDER BY created_at DESC`,
        [category]
      );
    } else {
      result = await pool.query(
        `SELECT id, title, created_at AS "lastUpdated", category
         FROM polls
         ORDER BY created_at DESC`
      );
    }

    res.json(result.rows);
  } catch (err) {
    console.error("Error fetching polls:", err);
    res.status(500).json({ message: "Server error" });
  }
});

router.get("/:id", async (req, res) => {
  const pollId = parseInt(req.params.id);
  if (isNaN(pollId)) {
    return res.status(400).json({ message: "Invalid poll ID" });
  }

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();

    // Fetch poll data
    const pollResult = await client.query(
      `SELECT id, title, category, presidential, region, county, constituency, ward, spoiled_votes, total_votes, created_at
       FROM polls WHERE id = $1`,
      [pollId]
    );

    if (pollResult.rows.length === 0) {
      return res.status(404).json({ message: "Poll not found" });
    }

    const poll = pollResult.rows[0];

    // Fetch competitors (with profile image)
    const competitorsResult = await client.query(
      `SELECT id, name, party, encode(profile_image, 'base64') AS profile_base64
       FROM competitors WHERE poll_id = $1 ORDER BY id`,
      [pollId]
    );

    const competitorsMap = new Map<number, any>();
    const competitors = competitorsResult.rows.map((row: any) => {
      const profile = row.profile_base64
        ? `data:image/png;base64,${row.profile_base64}`
        : null;
      const competitor = {
        id: row.id,
        name: row.name,
        party: row.party,
        profile,
      };
      competitorsMap.set(row.id, competitor);
      return competitor;
    });

    // Fetch vote results
    const voteResults = await client.query(
      `SELECT c.id, c.name, COUNT(v.id) AS vote_count
       FROM competitors c
       LEFT JOIN votes v ON v.competitor_id = c.id
       WHERE c.poll_id = $1
       GROUP BY c.id, c.name
       ORDER BY vote_count DESC`,
      [pollId]
    );

    if (voteResults.rows.length === 0) {
      return res.status(404).json({ message: "No votes found for this poll" });
    }

    const totalValidVotes = voteResults.rows.reduce(
  (sum, row) => sum + parseInt(row.vote_count),
  0
);

const results = voteResults.rows.map((row) => {
  const candidate = competitorsMap.get(row.id);
  const voteCount = parseInt(row.vote_count);
  const percentage =
    totalValidVotes > 0
      ? ((voteCount / totalValidVotes) * 100).toFixed(2)
      : "0.00";
  return {
    id: row.id,
    name: row.name,
    party: candidate?.party || "Independent",
    profile: candidate?.profile || null,
    voteCount,
    percentage,
  };
});

// Return even if there are no votes
return res.json({
  id: poll.id,
  title: poll.title,
  category: poll.category,
  presidential: poll.presidential,
  region: poll.region,
  county: poll.county,
  constituency: poll.constituency,
  ward: poll.ward,
  spoiled_votes: poll.spoiled_votes || 0,
  totalVotes: poll.total_votes || 0,
  lastUpdated: new Date().toISOString(),
  results,
});

  } catch (error) {
    console.error("Error fetching poll:", error);
    return res.status(500).json({ message: "Server error" });
  } finally {
    if (client) client.release();
  }
});



export default router;
