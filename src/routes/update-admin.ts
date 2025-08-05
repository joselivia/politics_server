import express from "express";
import bcrypt from "bcrypt";
import { pool } from "../config-db";
const router = express.Router();
router.put("/", async (req, res) => {
  const { currentEmail, currentPassword, newEmail, newPassword } = req.body;

  try {
    const result = await pool.query("SELECT * FROM login WHERE email = $1", [currentEmail]);

    if (result.rows.length === 0) {
      return res.status(404).json({ message: "Admin not found" });
    }

    const admin = result.rows[0];

    // Verify current password
    const isMatch = await bcrypt.compare(currentPassword, admin.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Incorrect current password" });
    }

    const updatedPassword = newPassword
      ? await bcrypt.hash(newPassword, 10)
      : admin.password;

    const updatedEmail = newEmail || admin.email;

    await pool.query(
      `UPDATE login SET email = $1, password = $2 WHERE email = $3`,
      [updatedEmail, updatedPassword, currentEmail]
    );

    console.log("✅ Admin credentials updated successfully");
    res.status(200).json({ message: "Admin credentials updated successfully" });
  } catch (error) {
    console.error("❌ Error updating admin credentials:", error);
    res.status(500).json({ message: "Server error" });
  }
});

export default router;
