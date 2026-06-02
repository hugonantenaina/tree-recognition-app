const axios = require('axios');
const FormData = require('form-data');
const sharp = require('sharp');
const treeDatabase = require('../models/tree_model');

const PLANTNET_ENDPOINT = 'https://my-api.plantnet.org/v2/identify/k-world-flora';
const GEMINI_ENDPOINT =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Cache: tsy antso indray Gemini raha efa fantatra ilay hazo
const aiCache = new Map();

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

const enrichWithAI = async (scientificName, commonNames) => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  // Cache: averina mivantana raha efa ao
  if (aiCache.has(scientificName)) {
    console.log('AI cache hit:', scientificName);
    return aiCache.get(scientificName);
  }

  const prompt = `You are a botanist expert. For the tree/plant "${scientificName}"${
    commonNames?.length ? ` (common names: ${commonNames.slice(0, 2).join(', ')})` : ''
  }, respond ONLY with this JSON (no markdown, no backticks, no extra text before or after):
{"description":"2 sentences in French about this plant","origin":"native countries/region in French","uses":"medicinal/wood/food/ornamental uses in French in 2 sentences","characteristics":{"Hauteur":"value","Feuilles":"value","Floraison":"value","Habitat":"value"},"conservationStatus":"IUCN status in French or Non evalué"}`;

  // Andramo 3 fotoana miaraka amin'ny fotoam-piandrasana
  const delays = [0, 5000, 10000];

  for (let attempt = 0; attempt < 3; attempt++) {
    if (delays[attempt] > 0) {
      console.log(`Gemini retry ${attempt}, waiting ${delays[attempt]}ms...`);
      await new Promise(r => setTimeout(r, delays[attempt]));
    }

    try {
      const response = await axios.post(
        GEMINI_ENDPOINT,
        {
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            maxOutputTokens: 1200,
          },
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          timeout: 30000,
        }
      );

      let text = response.data?.candidates?.[0]?.content?.parts?.[0]?.text || '';

      // Manadio: esory markdown raha misy
      text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

      // Maka ny JSON eo anelanelan'ny { sy } voalohany sy farany
      const start = text.indexOf('{');
      const end = text.lastIndexOf('}');
      if (start === -1 || end === -1) throw new Error('No JSON found');

      const parsed = JSON.parse(text.substring(start, end + 1));

      // Cache ny resultat
      aiCache.set(scientificName, parsed);
      console.log('AI enrichment success:', scientificName);
      return parsed;

    } catch (err) {
      const status = err.response?.status;
      console.warn(`Gemini attempt ${attempt + 1} failed (${status || err.message})`);

      // Raha 400 (bad request) → tsy misy fotoana anelanelan'izany
      if (status === 400) break;
    }
  }

  console.warn('All Gemini attempts failed for:', scientificName);
  return null;
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
      throw new Error('Aucune correspondance trouvée par l\'API Pl@ntNet.');
    }

    const matches = getMatches(rawResults);
    const topMatch = matches[0];
    const localData = treeDatabase[topMatch.scientificName] || {};

    // Génération texte AI
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
    console.error('Erreur classification:', error.message || error);
    if (error.response?.data) {
      console.error('Full error:', error.response.data);
    }
    const status = error.response?.status || 500;
    let userMessage = error.message || 'Erreur lors de l\'appel à l\'API.';
    if (error.response?.data?.message?.includes('Unsupported file type')) {
      userMessage = 'Type de fichier non supporté. Utilisez une image JPG, PNG ou WEBP.';
    }
    if (!res.headersSent) {
      res.status(status).json({ success: false, message: userMessage });
    }
  }
};

module.exports = classify;