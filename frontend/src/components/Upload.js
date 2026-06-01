import { useRef, useState } from 'react';
const API_URL = 'https://arbrescan-api.onrender.com';
// URL backend : en ligne (Render) raha misy, sinon localhost via proxy

console.log('API_URL =', API_URL);  // ⬅️ diagnostic
const Upload = ({ setResult, setLoading, setError }) => {
  const fileInputRef = useRef(null);
  const [dragActive, setDragActive] = useState(false);

  const sendFile = async (file) => {
    setError('');
    setResult(null);
    if (!file) {
      setError('Aucun fichier sélectionné.');
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
        setError(data.message || 'Erreur lors de l’analyse.');
      } else {
        setResult(data);
      }
    } catch (err) {
      setError('Impossible de contacter le serveur.');
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (event) => {
    const file = event.target.files?.[0];
    sendFile(file);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setDragActive(false);
    const file = event.dataTransfer.files?.[0];
    sendFile(file);
  };

  const handleDragOver = (event) => {
    event.preventDefault();
    setDragActive(true);
  };

  const handleDragLeave = () => {
    setDragActive(false);
  };

  return (
    <div>
      <div
        className={dragActive ? 'upload-zone upload-zone--active' : 'upload-zone'}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onClick={() => fileInputRef.current?.click()}
      >
        <p>Glisse-dépose une image ici ou clique pour sélectionner.</p>
        <small>JPG, PNG, WEBP</small>
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