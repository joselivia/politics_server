import express from 'express';
import multer from 'multer';
import pool from '../config-db';

const router = express.Router();
const storage = multer.memoryStorage();
const fileFilter = (_req: any, file: Express.Multer.File, cb: any) => {
  const allowedTypes = /jpeg|jpg|png|gif|mp4|webm|avi|mov|pdf/;
  const isValid = allowedTypes.test(file.mimetype);
  cb(null, isValid);
};
const upload = multer({ 
  storage,
  limits: { files: 6 }, 
  fileFilter 
});

const posts: {
  id: number;
  title: string;
  content: string;
  images: string[];
  created_at: string;
}[] = [];

router.post('/posts', upload.array('media', 6), async (req, res) => {
  try {
    const { title, content } = req.body;
    const files = req.files as Express.Multer.File[];

 const images: Buffer[] = [];
const videos: Buffer[] = [];
const pdfs: Buffer[] = [];

files.forEach((file) => {
  if (file.mimetype.startsWith('video/')) {
    if (videos.length < 3) videos.push(file.buffer);
  } else if (file.mimetype.startsWith('image/')) {
    if (images.length < 3) images.push(file.buffer);
  } else if (file.mimetype === 'application/pdf') {
    if (pdfs.length < 3) pdfs.push(file.buffer);
  }
});

    await pool.query(
      `INSERT INTO blog_posts (title, content, image_data, video_data,pdf_data, created_at)
       VALUES ($1, $2, $3, $4, $5,$6)`,
      [title, content, images, videos,pdfs, new Date()]
    );

    res.status(200).json({ message: '✅ Post Successifully Created' });
  } catch (error) {
    console.error('❌ Post creation failed:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

router.get('/posts', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const offset = Number(req.query.offset) || 0;

    const result = await pool.query(
      `SELECT id, title, content, created_at FROM blog_posts ORDER BY created_at DESC LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const posts = result.rows;

    const { rows } = await pool.query("SELECT MAX(created_at) as last_updated FROM blog_posts");
    const lastUpdated = rows[0].last_updated || new Date();

    res.json({ posts, lastUpdated });
  } catch (error) {
    console.error("❌ Failed to fetch posts:", error);
    res.status(500).json({ error: "Failed to fetch posts" });
  }
});

router.get('/posts/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(`SELECT * FROM blog_posts WHERE id = $1`, [id]);
    if (result.rows.length === 0) {
       res.status(404).json({ error: 'Post not found' });
    }

    const post = result.rows[0];

    const images = (post.image_data || []).map((img: Buffer) =>
      `data:image/jpeg;base64,${img.toString('base64')}`
    );
    const videos = (post.video_data || []).map((vid: Buffer) =>
      `data:video/mp4;base64,${vid.toString('base64')}`
    );
const pdfs = (post.pdf_data || []).map((pdf: Buffer) =>
  `data:application/pdf;base64,${pdf.toString('base64')}`
);

    res.json({
      id: post.id,
      title: post.title,
      content: post.content,
      created_at: post.created_at,
      images,
      videos,
      pdfs,
    });
  } catch (error) {
    console.error("❌ Failed to fetch post details:", error);
    res.status(500).json({ error: "Failed to fetch post details" });
  }
});

export default router;   