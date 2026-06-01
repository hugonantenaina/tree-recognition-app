const fs = require('fs');
const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp');
const treeDatabase = require('../models/tree_model');

const PLANTNET_ENDPOINT = 'https://my-api.plantnet.org/v2/identify/k-world-flora';

// Famafana rakitra azo antoka (tsy mampmaty ny process raha tsy mety)
const safeDelete = (filePath) => {
  if (!filePath) return;
  // Andraso kely mba ho afaka tanteraka ny rakitra (Windows)
  setTimeout(() => {
    fs.unlink(filePath, (err) => {
      if (err && err.code !== 'ENOENT') {
        console.warn('Avertissement suppression fichier :', err.message);
      }
    });
  }, 500);
};

const getMatches = (rawResults) => {
  if (!Array.isArray(rawResults)) return [];
  return rawResults.map((item) => {
    const species = item.species || item.consensus?.species || {};
    return {
      scientificName:
        species.scientificNameWithoutAuthor || species.scientificName || 'Inconnu',
      commonNames: species.commonNames || [],
      score: item.score || item.probability || 0,
      images: (item.images || []).map((img) => ({
        url: img.url?.m || img.url?.o || img.url?.s || (typeof img.url === 'string' ? img.url : ''),
        credit: img.author || img.copyright?.author || 'Source non renseignée',
      })),
    };
  });
};

const classify = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Aucune image reçue.' });
  }

  const filePath = req.file.path;
  const apiKey = process.env.PLANTNET_API_KEY;

  if (!apiKey) {
    safeDelete(filePath);
    return res.status(500).json({ success: false, message: 'Clé API PlantNet non configurée.' });
  }

  try {
    // Mamaky ny rakitra ho buffer ALOHA (mba tsy hisy lock amin'ny rakitra)
    const inputBuffer = await fs.promises.readFile(filePath);

    // Manova ho JPEG madio amin'ny buffer (tsy mikitika ny rakitra intsony)
    const convertedBuffer = await sharp(inputBuffer)
      .rotate()
      .jpeg({ quality: 90 })
      .toBuffer();

    const form = new FormData();
    form.append('images', convertedBuffer, {
      filename: 'plant.jpg',
      contentType: 'image/jpeg',
    });
    form.append('organs', 'auto');

    const response = await axios.post(
      `${PLANTNET_ENDPOINT}?api-key=${encodeURIComponent(apiKey)}&include-related-images=true`,
      form,
      {
        headers: form.getHeaders(),
        timeout: 30000,
        maxContentLength: Infinity,
        maxBodyLength: Infinity,
      }
    );

    const rawResults = response.data?.results || [];
    if (!rawResults.length) {
      throw new Error('Aucune correspondance trouvée par l’API Pl@ntNet.');
    }

    const matches = getMatches(rawResults);
    const topMatch = matches[0];
    const localData = treeDatabase[topMatch.scientificName] || {};

    const result = {
      success: true,
      scientificName: topMatch.scientificName,
      commonNames: topMatch.commonNames,
      score: topMatch.score,
      characteristics: localData.characteristics || {},
      uses: localData.uses || 'Informations locales non disponibles.',
      conservationStatus: localData.conservationStatus || 'Non renseigné',
      results: matches,
      images: topMatch.images,
    };

    res.json(result);
  } catch (error) {
    console.error('Erreur classification :', error.message || error);
    if (error.response?.data) {
      console.error('Full error:', error.response.data);
    }
    const status = error.response?.status || 500;

    let userMessage = error.message || 'Erreur lors de l’appel à l’API.';
    if (error.response?.data?.message?.includes('Unsupported file type')) {
      userMessage = 'Type de fichier non supporté. Utilisez une image JPG, PNG ou WEBP valide.';
    }

    // Manamarina fa tsy efa lasa ny réponse vao mandefa
    if (!res.headersSent) {
      res.status(status).json({ success: false, message: userMessage });
    }
  } finally {
    // Famafana azo antoka (asynchrone, tsy mampaty ny process)
    safeDelete(filePath);
  }
};

module.exports = classify;