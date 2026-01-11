import { Pool } from "pg";
import dotenv from "dotenv";
import { insertAdmin } from "./routes/admin";

dotenv.config();
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
// export const pool = new Pool({
//   user: "postgres",
//   password: "@Joselivia254",
//   host: "localhost",
//   port: 5432,
//   database: "politics",
// });

const createTables = async () => {
  const queries = [
    `CREATE TABLE IF NOT EXISTS polls (
  id SERIAL PRIMARY KEY,
  title VARCHAR(255) NOT NULL,
  category VARCHAR(100) NOT NULL,
  region VARCHAR(100) NOT NULL,
  county VARCHAR(100) NOT NULL,
  constituency VARCHAR(100) ,
  ward VARCHAR(100) ,
  total_votes INTEGER DEFAULT 0,
  spoiled_votes INTEGER DEFAULT 0,
   voting_expires_at TIMESTAMP,
  allow_multiple_votes BOOLEAN DEFAULT false,
   published BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);`,
`CREATE TABLE IF NOT EXISTS competitors (
  id SERIAL PRIMARY KEY,
  poll_id INTEGER REFERENCES polls(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  party VARCHAR(255),
  profile_image BYTEA,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
`,
  `CREATE TABLE IF NOT EXISTS votes (
  id SERIAL PRIMARY KEY,
  voter_id TEXT,
  poll_id INTEGER NOT NULL REFERENCES polls(id) ON DELETE CASCADE,
  competitor_id INTEGER NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
`, 
  `CREATE TABLE IF NOT EXISTS blog_posts (
  id SERIAL PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  image_data BYTEA[],
  video_data BYTEA[],
  pdf_data bytea[],
  created_at TIMESTAMP DEFAULT NOW()
);`,
`CREATE TABLE IF NOT EXISTS login(
id SERIAL PRIMARY KEY,
email TEXT NOT NULL,
password TEXT NOT NULL
)`,

  ];

  try {
    for (const query of queries) {
      await pool.query(query);
    }
    console.log("✅ All tables are created successfully!");
    await insertAdmin();
  } catch (error: Error | any) {
    console.error("❌ Error creating tables:", error);
  }
};
createTables();
export default pool;
