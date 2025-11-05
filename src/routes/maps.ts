import pool from "../config-db";
import express from "express";
const router = express.Router();
router.get("/:countyName", async (req, res) => {
  const { countyName } = req.params;
  try {
    const result = await pool.query(
      "SELECT id FROM polls WHERE region ILIKE $1 LIMIT 1",
      [countyName]
    );
    if (result.rows.length > 0) {
      res.json({ pollId: result.rows[0].id });
    } else {
      res.status(404).json({ message: "Poll not found" });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;