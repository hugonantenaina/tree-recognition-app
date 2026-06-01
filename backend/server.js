const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const classifyRouter = require('./routes/classify');

require('dotenv').config();

// ===== CRASH HANDLERS (fiarovana ny process tsy ho maty tampoka) =====
process.on('uncaughtException', (err) => {
  console.error('❌ UNCAUGHT EXCEPTION:', err);
});
process.on('unhandledRejection', (err) => {
  console.error('❌ UNHANDLED REJECTION:', err);
});

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.get('/api/test', (req, res) => {
  res.json({ success: true, message: 'Le serveur est opérationnel.' });
});

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, 'uploads')),
  filename: (req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    cb(null, `${uniqueSuffix}-${file.originalname}`);
  },
});

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

// Wrapper mba hisamborana ny erreur-n'ny multer (tsy hampaty ny process)
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