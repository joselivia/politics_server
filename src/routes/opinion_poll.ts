import express from 'express';
import pool from '../config-db'; 
const router = express.Router();

router.post('/', async (req, res) => {
    const { pollId, respondent, answers } = req.body;

    if (!pollId || !respondent || !answers || !Array.isArray(answers)) {
        return res.status(400).json({ error: "Missing required fields: pollId, respondent, or answers array." });
    }

    if (!respondent.name || !respondent.gender || !respondent.age) {
        return res.status(400).json({ error: "Respondent details (name, gender, age) are required." });
    }

    const parsedPollId = parseInt(pollId);
    if (isNaN(parsedPollId)) {
        return res.status(400).json({ error: "Invalid pollId provided." });
    }

    const parsedAge = parseInt(respondent.age);
    if (isNaN(parsedAge)) {
        return res.status(400).json({ error: "Invalid respondent age provided." });
    }

    try {
        const pollCheck = await pool.query('SELECT id FROM polls WHERE id = $1', [parsedPollId]);
        if (pollCheck.rowCount === 0) {
            return res.status(404).json({ error: "Poll not found." });
        }

        const result = await pool.query(
            `INSERT INTO survey_responses (poll_id, name, gender,age, answers)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING id, submitted_at`, 
            [parsedPollId, respondent.name, respondent.gender, parsedAge, JSON.stringify(answers)] 
        );

        res.status(201).json({
            message: "✅ Survey response recorded successfully!",
            responseId: result.rows[0].id,
            submittedAt: result.rows[0].submitted_at
        });

    } catch (error) {
        console.error("❌ Error recording survey response:", error);
        res.status(500).json({ error: "Failed to record survey response." });
    }
});

router.get('/:pollId', async (req, res) => {
    const { pollId } = req.params;
    const parsedPollId = parseInt(pollId);

    if (isNaN(parsedPollId)) {
        return res.status(400).json({ error: "Invalid poll ID provided." });
    }

    try {
        const result = await pool.query(
            `SELECT id, name, gender, age, answers, submitted_at
             FROM survey_responses
             WHERE poll_id = $1
             ORDER BY submitted_at DESC`,
            [parsedPollId]
        );

        res.status(200).json(result.rows);
    } catch (error) {
        console.error(`❌ Error fetching survey responses for poll ${pollId}:`, error);
        res.status(500).json({ error: "Failed to fetch survey responses." });
    }
});

export default router;