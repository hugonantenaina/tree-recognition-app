import { useRef, useState } from 'react';

const API_URL = 'https://arbrescan-api.onrender.com';

const Upload = ({ setResult, setLoading, setError, serverReady }) => {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const sendFile = async (file) => {
    setError('');
    setResult(null);
    if (!file) return;

    // Raha tsy mbola ready ny server → mampiseho message
    if (!serverReady) {
      setError('Le serveur démarre, veuillez patienter quelques secondes...');
      return;
    }

    const formData = new FormData();
    formData.append('image', file);
    setLoading(true);
    try {
      const response = await fetch(`${API_URL}/api/classify`, {
        method: 'POST',
        body: formData,
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.message || 'Erreur lors de l\'analyse.');
      } else {
        setResult(data);
      }
    } catch {
      setError('Impossible de contacter le serveur. Réessayez dans quelques secondes.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => sendFile(e.target.files?.[0]);
  const handleDrop = (e) => { e.preventDefault(); setDragActive(false); sendFile(e.dataTransfer.files?.[0]); };
  const handleDragOver = (e) => { e.preventDefault(); setDragActive(true); };
  const handleDragLeave = () => setDragActive(false);

  return (
    <div>
      <div
        className={`upload-zone${dragActive ? ' upload-zone--active' : ''}${!serverReady ? ' upload-zone--waiting' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <div className="upload-icon">🌿</div>
        <p>Glisse-dépose une image ici<br/>ou clique pour sélectionner</p>
        <small>JPG · PNG · WEBP — max 15 Mo</small>
      </div>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        hidden
        onChange={handleFileSelect}
      />
    </div>
  );
};

export default Upload;