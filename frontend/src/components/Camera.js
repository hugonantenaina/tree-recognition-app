import { useRef, useState } from 'react';

const API_URL = 'https://arbrescan-api.onrender.com';

const Camera = ({ setResult, setLoading, setError }) => {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [streamActive, setStreamActive] = useState(false);

  const startCamera = async () => {
    setError('');
    setResult(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' },
        audio: false,
      });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
      }
      setStreamActive(true);
    } catch {
      setError('Impossible d\'accéder à la caméra. Vérifie tes permissions.');
    }
  };

  const stopCamera = () => {
    const stream = videoRef.current?.srcObject;
    if (stream?.getTracks) {
      stream.getTracks().forEach((track) => track.stop());
      if (videoRef.current) videoRef.current.srcObject = null;
    }
    setStreamActive(false);
  };

  const capturePhoto = async () => {
    setError('');
    setResult(null);

    if (!videoRef.current || !canvasRef.current) {
      setError('Aucune image à capturer.');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

    canvas.toBlob(async (blob) => {
      if (!blob) {
        setError('Échec de la capture.');
        return;
      }
      const formData = new FormData();
      formData.append('image', blob, 'capture.jpg');
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
    }, 'image/jpeg', 0.92);
  };

  return (
    <div className="camera-panel">
      <div className="camera-preview">
        <video ref={videoRef} className="camera-video" playsInline muted />
        <canvas ref={canvasRef} hidden />
      </div>

      <div className="camera-actions">
        <button type="button" className="button" onClick={startCamera}>
          📷 Démarrer
        </button>
        <button
          type="button"
          className="button button--primary"
          onClick={capturePhoto}
          disabled={!streamActive}
        >
          📸 Capturer
        </button>
        <button
          type="button"
          className="button"
          onClick={stopCamera}
          disabled={!streamActive}
        >
          ⏹ Arrêter
        </button>
      </div>
    </div>
  );
};

export default Camera;