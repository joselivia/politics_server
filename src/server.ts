import express from "express";
import cors from "cors";
import pollRoutes from "./routes/polls";
import postRoutes from "./routes/posts";

import pool from "./config-db";
import dotenv from "dotenv";
import voteRoutes from "./routes/votes";

dotenv.config();

const app = express();
const port = process.env.PORT || 8082;
app.use(cors());
app.use(express.json());

app.use("/api/polls", pollRoutes);
app.use("/api", postRoutes); 
app.use("/api/votes", voteRoutes);

pool.query("SELECT NOW()", (err, res) => {
  if (err) {
    console.error("❌ Database connection failed:", err);
  } else {
    console.log("✅ Database connected successfully:", res.rows[0].now);
  }
});
 
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
});


