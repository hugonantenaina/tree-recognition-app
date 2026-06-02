const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp');
const treeDatabase = require('../models/tree_model');

const PLANTNET_ENDPOINT = 'https://my-api.plantnet.org/v2/identify/k-world-flora';
const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

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

// Génération texte avec Gemini (description, origine, utilisations, caractéristiques)
const enrichWithAI = async (scientificName, commonNames) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const prompt = `You are a botanist. For the plant/tree with scientific name "${scientificName}"${
    commonNames?.length ? ` (also known as: ${commonNames.slice(0, 3).join(', ')})` : ''
  }, provide accurate factual information.
Respond ONLY with a valid JSON object (no markdown, no backticks) with these exact keys:
{
  "description": "2-3 sentence general description in French",
  "origin": "native region/countries in French, short",
  "uses": "main uses (medicinal, wood, food, ornamental...) in French, 2-3 sentences",
  "characteristics": { "Hauteur": "...", "Feuilles": "...", "Floraison": "...", "Habitat": "..." },
  "conservationStatus": "IUCN status if known (e.g. Préoccupation mineure, Vulnérable, En danger), else 'Non évalué'"
}`;

  try {
    const response = await axios.post(
      GEMINI_ENDPOINT,
      {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 800 },
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': apiKey,
        },
        timeout: 20000,
      }
    );

    let text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
    // Manadio ny markdown raha misy
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(text);
  } catch (err) {
    console.warn('Gemini enrichment failed:', err.message);
    return null;
  }
};

const classify = async (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({ success: false, message: 'Aucune image reçue.' });
  }

  const apiKey = process.env.PLANTNET_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ success: false, message: 'Clé API PlantNet non configurée.' });
  }

  try {
    const convertedBuffer = await sharp(req.file.buffer)
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

    // Génération texte AI (raha tsy ao amin'ny database local)
    const aiData = await enrichWithAI(topMatch.scientificName, topMatch.commonNames);

    const result = {
      success: true,
      scientificName: topMatch.scientificName,
      commonNames: topMatch.commonNames,
      score: topMatch.score,
      description: localData.description || aiData?.description || '',
      origin: localData.origin || aiData?.origin || '',
      characteristics: localData.characteristics || aiData?.characteristics || {},
      uses: localData.uses || aiData?.uses || 'Informations non disponibles.',
      conservationStatus:
        localData.conservationStatus || aiData?.conservationStatus || 'Non renseigné',
      aiGenerated: !localData.uses && !!aiData,
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

    if (!res.headersSent) {
      res.status(status).json({ success: false, message: userMessage });
    }
  }
};

module.exports = classify;