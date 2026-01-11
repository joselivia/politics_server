import multer from "multer";
import express from "express";
import { pool } from "../config-db";
import { PoolClient } from "pg";

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post("/", upload.any(), async (req, res) => {
  const {
    title,
    category,
    region,
    county,
    constituency,
    ward,
    voting_expires_at,
    competitors: competitorsJson,
  } = req.body;

  if (!title || !category || !region) {
    return res.status(400).json({ message: "Missing required fields for poll creation." });
  }

  let expiry: Date | null = null;
  if (voting_expires_at && voting_expires_at.trim() !== "") {
    expiry = new Date(voting_expires_at);
    if (isNaN(expiry.getTime())) {
      return res.status(400).json({ message: "Invalid voting_expires_at format." });
    }
  }
  try {
    const competitors = JSON.parse(competitorsJson || "[]");
    if (!Array.isArray(competitors) || competitors.length < 1) {
      return res.status(400).json({ message: "At least one competitor is required." });
    }
 
    const pollResult = await pool.query(
      `INSERT INTO polls (
        title, category, region, county, constituency, ward,
        created_at, total_votes, voting_expires_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), 0, $7)
      RETURNING id`,
      [
        title,
        category,
        region,
        county || "All",
        constituency || "All",
        ward || "All",
        expiry,
      ]
    );

    const pollId = pollResult.rows[0].id;

    const filesArray = Array.isArray(req.files) ? req.files : [];

    for (let i = 0; i < competitors.length; i++) {
      const { name, party } = competitors[i];
      if (!name) {
        throw new Error(`Competitor ${i + 1} is missing a name.`);
      }

      const file = filesArray.find((f: any) => f.fieldname === `profile${i}`);
      const profileImageBuffer = file?.buffer ?? null;

      await pool.query(
        `INSERT INTO competitors (poll_id, name, party, profile_image)
         VALUES ($1, $2, $3, $4)`,
        [pollId, name, party || null, profileImageBuffer]
      );
    }

    return res.status(201).json({ success: true, id: pollId });
  } catch (error: any) {
       console.error("Error creating poll:", error);
    return res.status(500).json({
      message: error.message || "Server error during poll creation.",
    });
  } 
});


router.get("/", async (req, res) => {
  const { category } = req.query;
  try {
    let result;
    if (category) {
      result = await pool.query(
        `SELECT id, title, created_at, category, region, county, constituency,total_votes, ward,voting_expires_at
         FROM polls
         WHERE category = $1
         ORDER BY created_at DESC`,
        [category]
      );
    } else {
      result = await pool.query(
        `SELECT id, title, created_at, category, region, county, constituency,total_votes, ward,voting_expires_at
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
router.get("/live", async (req, res) => {
  try {
    const { rows } = await pool.query(`
      WITH vote_counts AS (
        SELECT
          p.id AS poll_id,
          p.title,
          p.category,
          p.county,
          p.voting_expires_at,
          c.id AS candidate_id,
          c.name AS candidate_name,
          COUNT(v.id)::int AS votes
        FROM polls p
        JOIN competitors c ON c.poll_id = p.id
        LEFT JOIN votes v ON v.competitor_id = c.id
        WHERE p.voting_expires_at > NOW()
        GROUP BY p.id, c.id
      ),
      ranked AS (
        SELECT *,
          SUM(votes) OVER (PARTITION BY poll_id) AS total_votes,
          ROW_NUMBER() OVER (PARTITION BY poll_id ORDER BY votes DESC) AS rank
        FROM vote_counts
      )
      SELECT
        poll_id AS id,
        title,
        category,
        county,
        voting_expires_at,
        total_votes,
        json_agg(
          json_build_object(
            'id', candidate_id,
            'name', candidate_name,
            'voteCount', votes
          )
          ORDER BY votes DESC
        ) FILTER (WHERE rank <= 2) AS top_candidates
      FROM ranked
      GROUP BY poll_id, title, category, county, voting_expires_at, total_votes
      ORDER BY voting_expires_at ASC;
    `);
    res.json(rows);
  } catch (err) {
    console.error("Error fetching live polls:", err);
    res.status(500).json({ message: "Failed to fetch live polls" });
  }
});

router.get("/:id", async (req, res) => {
  const pollId = parseInt(req.params.id);
  if (isNaN(pollId)) {
    return res.status(400).json({ message: "Invalid poll ID" });
  }
  try {

    const pollResult = await pool.query(
      `SELECT id, title, category, region, county, constituency, ward, spoiled_votes, total_votes, created_at,voting_expires_at
       FROM polls WHERE id = $1`,
      [pollId]
    );

    if (pollResult.rows.length === 0) {
      return res.status(404).json({ message: "Poll not found" });
    }

    const poll = pollResult.rows[0];

    const competitorsResult = await pool.query(
      `SELECT id, name, party, encode(profile_image, 'base64') AS profile_base64
       FROM competitors WHERE poll_id = $1 ORDER BY id`,
      [pollId]
    );

const competitorsMap = new Map<number, any>();

const competitors = competitorsResult.rows.map((row: any) => {
  const competitor = {
    id: row.id,
    name: row.name,
    party: row.party,
    profile: row.profile_base64
      ? `data:image/png;base64,${row.profile_base64}`
      : null,
  };

  competitorsMap.set(row.id, competitor);
  return competitor;
});
  

    const voteResults = await pool.query(
      `SELECT c.id, c.name, COUNT(v.id) AS vote_count
       FROM competitors c
       LEFT JOIN votes v ON v.competitor_id = c.id
       WHERE c.poll_id = $1
       GROUP BY c.id, c.name
       ORDER BY vote_count DESC`,
      [pollId]
    );

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

    return res.json({
      id: poll.id,
      title: poll.title,
      category: poll.category,
      region: poll.region,
      county: poll.county,
      constituency: poll.constituency,
      ward: poll.ward,
      spoiled_votes: poll.spoiled_votes || 0,
      totalVotes: poll.total_votes || 0,
      created_at: poll.created_at,
      voting_expires_at: poll.voting_expires_at,
      competitors,
      results,
    });
  } catch (error) {
    console.error("Error fetching poll:", error);
    return res.status(500).json({ message: "Server error" });
  } 
});

router.put("/:id", upload.any(), async (req, res) => {
  const pollId = Number(req.params.id);
  if (!Number.isInteger(pollId)) {
    return res.status(400).json({ message: "Invalid poll ID" });
  }

  const {
    title,
    category,
    region,
    county,
    constituency,
    ward,
    voting_expires_at,
    competitors: competitorsJson,
  } = req.body;

  let expiry: Date | null = null;
  if (voting_expires_at?.trim()) {
    expiry = new Date(voting_expires_at);
    if (isNaN(expiry.getTime())) {
      return res.status(400).json({ message: "Invalid expiry date" });
    }
  }

  let competitors: any[] = [];
  try {
    competitors = JSON.parse(competitorsJson || "[]");
  } catch {
    return res.status(400).json({ message: "Invalid competitors payload" });
  }

  if (!Array.isArray(competitors) || competitors.length === 0) {
    return res.status(400).json({ message: "At least one competitor required" });
  }

  const files = Array.isArray(req.files) ? req.files : [];

  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // 1️⃣ Update poll
    await client.query(
      `UPDATE polls
       SET title=$1, category=$2, region=$3, county=$4,
           constituency=$5, ward=$6, voting_expires_at=$7
       WHERE id=$8`,
      [
        title,
        category,
        region,
        county || "All",
        constituency || "All",
        ward || "All",
        expiry,
        pollId,
      ]
    );

    // 2️⃣ Fetch existing competitors
    const existingRes = await client.query(
      `SELECT id, profile_image FROM competitors WHERE poll_id=$1`,
      [pollId]
    );
    const existing = existingRes.rows;
    const existingIds = existing.map(c => c.id);
    const keptIds: number[] = [];
    // 3️⃣ Upsert competitors
    for (let index = 0; index < competitors.length; index++) {
      const comp = competitors[index];
      const { id, name, party } = comp;
      if (!name?.trim()) throw new Error("Competitor name required");
      const file = files.find(
        (f: any) => f.fieldname === `profile${index}`
      );
      if (Number.isInteger(id)) {
        // UPDATE
        const old = existing.find(e => e.id === id);
        if (!old) throw new Error(`Invalid competitor id ${id}`);

        await client.query(
          `UPDATE competitors
           SET name=$1, party=$2, profile_image=$3
           WHERE id=$4 AND poll_id=$5`,
          [
            name.trim(),
            party || null,
            file ? file.buffer : old.profile_image,
            id,
            pollId,
          ]
        );
        keptIds.push(id);
      } else {
        // INSERT
        const insertRes = await client.query(
          `INSERT INTO competitors (poll_id, name, party, profile_image)
           VALUES ($1,$2,$3,$4)
           RETURNING id`,
          [pollId, name.trim(), party || null, file?.buffer ?? null]
        );
        keptIds.push(insertRes.rows[0].id);
      }
    }
    const toDelete = existingIds.filter(id => !keptIds.includes(id));
    if (toDelete.length > 0) {
      await client.query(
        `DELETE FROM competitors WHERE poll_id=$1 AND id=ANY($2::int[])`,
        [pollId, toDelete]
      );
    }

    await client.query("COMMIT");
    res.json({ message: "Poll updated successfully" });
  } catch (err: any) {
    await client.query("ROLLBACK");
    console.error(err);
    res.status(500).json({ message: err.message });
  } finally {
    client.release();
  }
});

router.delete("/:id", async (req, res) => {
  const pollId = parseInt(req.params.id);
  if (isNaN(pollId)) {
    return res.status(400).json({ message: "Invalid poll ID" });
  }

  let client: PoolClient | null = null;
  try {
    client = await pool.connect();
    await client.query("BEGIN");
    await client.query(`DELETE FROM votes WHERE poll_id = $1`, [pollId]);
    await client.query(`DELETE FROM competitors WHERE poll_id = $1`, [pollId]);
    await client.query(`DELETE FROM polls WHERE id = $1`, [pollId]);

    await client.query("COMMIT");
    res.json({ message: "Entire poll system deleted successfully" });
  } catch (err) {
    if (client) await client.query("ROLLBACK");
    console.error("Error deleting poll:", err);
    res.status(500).json({ message: "Server error during deletion" });
  } finally {
    if (client) client.release();
  }
});
router.put("/:id/publish", async (req, res) => {
  const { id } = req.params;
  const { published } = req.body; 

  try {
    const result = await pool.query(
      "UPDATE polls SET published = $1 WHERE id = $2 RETURNING *",
      [published, id]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ message: "Poll not found" });
    }

    res.json(result.rows[0]);
  } catch (error) {
    console.error("Error updating publish status:", error);
    res.status(500).json({ message: "Failed to update publish status" });
  }
});



export default router;
