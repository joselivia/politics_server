import { pool } from "../config-db";
import bcrypt from "bcrypt";

export async function insertAdmin() {
  const email = "admin@example.com";
  const rawPassword = "admin123";

  try {
    const existing = await pool.query("SELECT * FROM login WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      console.log("Admin already exists.");
      return;
    }

    const hashedPassword = await bcrypt.hash(rawPassword, 10);

    await pool.query(
      "INSERT INTO login (email, password) VALUES ($1, $2)",
      [email, hashedPassword]
    );
    console.log("✅ Admin inserted successfully");
  } catch (err) {
    console.error("❌ Error inserting admin:", err);
  } }

