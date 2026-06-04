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

// Proxy ho an'ny sary PlantNet (mba tsy hisy CONNECTION_TIMED_OUT eo amin'ny client)
const axios = require('axios');
app.get('/api/image-proxy', async (req, res) => {
  const imageUrl = req.query.url;
  if (!imageUrl || !imageUrl.startsWith('https://bs.plantnet.org/')) {
    return res.status(400).send('URL invalide');
  }
  try {
    const response = await axios.get(imageUrl, {
      responseType: 'arraybuffer',
      timeout: 20000,
    });
    res.set('Content-Type', response.headers['content-type'] || 'image/jpeg');
    res.set('Cache-Control', 'public, max-age=86400');
    res.send(response.data);
  } catch (err) {
    console.error('Image proxy error:', err.message);
    res.status(502).send('Image indisponible');
  }
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
// Keep alive — mba tsy hatory ny Render free tier
const SELF_URL = process.env.RENDER_EXTERNAL_URL || 'https://arbrescan-api.onrender.com';
setInterval(async () => {
  try {
    await axios.get(`${SELF_URL}/api/test`);
    console.log('Keep alive ping sent');
  } catch (err) {
    console.warn('Keep alive failed:', err.message);
  }
}, 14 * 60 * 1000); // 14 minitra