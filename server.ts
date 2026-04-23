import express from 'express';
import http from 'http';
import { Server } from 'socket.io';
import mysql from 'mysql2/promise';
import multer from 'multer';
import path from 'path';
import cors from 'cors';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const server = http.createServer(app);
  const io = new Server(server, {
    cors: { origin: "*" }
  });

  const PORT = 3000;

  app.use(cors());
  app.use(express.json());

  // Database Connection
  const db = await mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'djsmmbdt_tamimbhai3',
    password: process.env.DB_PASS || 'djsmmbdt_tamimbhai3',
    database: process.env.DB_NAME || 'djsmmbdt_tamimbhai3',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
  });

  // Ensure uploads directory exists
  const uploadsDir = path.join(__dirname, 'public', 'uploads');
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }

  app.use('/uploads', express.static(uploadsDir));

  // File Upload Configuration
  const storage = multer.diskStorage({
    destination: (req, file, cb) => {
      cb(null, uploadsDir);
    },
    filename: (req, file, cb) => {
      cb(null, Date.now() + '-' + file.originalname);
    }
  });
  const upload = multer({ storage });

  // --- API ROUTES ---

  // Upload endpoint
  app.post('/api/upload', upload.single('file'), (req: any, res: any) => {
    if (!req.file) return res.status(400).send('No file uploaded');
    const fileUrl = `/uploads/${req.file.filename}`;
    res.json({ url: fileUrl });
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', database: 'connected' });
  });

  // --- Vite / Static Assets Handling ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // --- Socket.io Real-time Logic ---
  io.on('connection', (socket) => {
    console.log('User connected:', socket.id);

    socket.on('join_room', (roomId) => {
      socket.join(roomId);
    });

    socket.on('send_message', (data) => {
      // data: { roomId, senderId, text, mediaUrl, mediaType }
      io.to(data.roomId).emit('receive_message', data);
    });

    socket.on('disconnect', () => {
      console.log('User disconnected');
    });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running at http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Failed to start server:", err);
});
