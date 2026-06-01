# Tree Recognition App

Application de reconnaissance d'arbres utilisant React 18 côté frontend et Node.js + Express côté backend.

## Installation

### Backend
1. Ouvre un terminal dans `backend`
2. Exécute `npm install`
3. Ajoute ta clé Pl@ntNet dans `backend/.env`

### Frontend
1. Ouvre un terminal dans `frontend`
2. Exécute `npm install`

## Lancement

1. Démarre le backend :
   - `cd backend`
   - `npm start`
2. Démarre le frontend :
   - `cd frontend`
   - `npm start`

## Utilisation

- Ouvre `http://localhost:3000`
- Sélectionne l’onglet `Caméra` pour capturer une photo
- Ou utilise `Upload` pour glisser-déposer une image JPG/PNG
- L’application envoie l’image à `http://localhost:5000/api/classify`
- Le serveur interroge l’API Pl@ntNet et enrichit la réponse avec des données locales

## Notes

- Ne committe pas `backend/.env` ni le dossier `backend/uploads`
- La route de test est disponible sur `http://localhost:5000/api/test`
