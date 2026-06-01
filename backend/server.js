const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const classifyRouter = require('./routes/classify');

require('dotenv').config();

// ===== CRASH HANDLERS =====
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('❌ UNHANDLED REJECTION:', err);
});

const app = express();
const PORT = process.env.PORT || 5000;

// ===== CORS (localhost + URL en ligne) =====
const allowedOrigins = [
  'http://localhost:3000',
  process.env.FRONTEND_URL, // URL Vercel (hampidirina ao Render)
];

app.use(
  cors({
    origin: (origin, cb) => {
      // Avela ny request tsy misy origin (ohatra Postman, na server-to-server)
      if (!origin || allowedOrigins.includes(origin)) {
        cb(null, true);
      } else {
        console.warn('CORS bloqué pour origin :', origin);
        cb(new Error('Not allowed by CORS'));
      }
    },
  })
);

app.use(express.json());

app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'Le serveur est opérationnel.' });
});

const storage = multer.memoryStorage();

const upload = multer({
  storage,
  fileFilter: (req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Format d’image non pris en charge. Utilisez JPG, PNG ou WEBP.'));
    }
  },
  limits: { fileSize: 15 * 1024 * 1024 },
});

// Wrapper mba hisamborana ny erreur-n'ny multer
const uploadMiddleware = (req, res, next) => {
  upload.single('image')(req, res, (err) => {
    if (err) {
      console.error('Erreur upload :', err.message);
      let message = err.message || 'Erreur lors du téléchargement.';
      if (err.code === 'LIMIT_FILE_SIZE') {
        message = 'Image trop volumineuse (max 15 Mo).';
      }
      return res.status(400).json({ success: false, message });
    }
    next();
  });
};

app.post('/api/classify', uploadMiddleware, classifyRouter);

// Gestionnaire d'erreurs global
app.use((err, req, res, next) => {
  console.error('Erreur serveur :', err);
  if (!res.headersSent) {
    res.status(500).json({ success: false, message: err.message || 'Erreur serveur.' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Server started on http://localhost:${PORT}`);
});