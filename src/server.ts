import express from "express";
import cors from "cors";
import pollRoutes from "./routes/polls";
import postRoutes from "./routes/posts";
import pool from "./config-db";
import dotenv from "dotenv";
import voteRoutes from "./routes/votes";
import login from "./routes/login";
import updateAdmin from "./routes/update-admin";
import countyMap from "./routes/maps"
dotenv.config();

const app = express();
const port = process.env.PORT || 8082;
app.use(cors());
app.use(express.json());

app.use("/api/polls", pollRoutes);
app.use("/api/blogs", postRoutes); 
app.use("/api/votes", voteRoutes);
app.use("/api/login", login);
app.use("/api/county", countyMap);
app.use("/api/update-admin", updateAdmin);

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


