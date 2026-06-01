const ResultDisplay = ({ result }) => {
  if (!result) return null;

  const API_URL = 'https://arbrescan-api.onrender.com';
  const proxify = (url) => `${API_URL}/api/image-proxy?url=${encodeURIComponent(url)}`;

  const scorePercent = Math.round((result.score || 0) * 100);
  const topAlternatives = result.results?.slice(1, 4) || [];
  const characteristics = Object.entries(result.characteristics || {});

  // Loko arakaraka ny confiance
  const getScoreColor = (percent) => {
    if (percent >= 70) return { start: '#28a745', end: '#20c997', label: 'Élevée' };
    if (percent >= 40) return { start: '#f0a500', end: '#f7c948', label: 'Moyenne' };
    return { start: '#e85d4e', end: '#f08a5d', label: 'Faible' };
  };

  // Loko arakaraka ny statut conservation
  const getStatusStyle = (status) => {
    const s = (status || '').toLowerCase();
    if (s.includes('danger') || s.includes('menac') || s.includes('critique')) return 'badge badge--danger';
    if (s.includes('vulnérable') || s.includes('vulnerable')) return 'badge badge--warning';
    if (s.includes('préoccup') || s.includes('mineure') || s.includes('stable')) return 'badge badge--success';
    return 'badge badge--neutral';
  };

  const scoreColor = getScoreColor(scorePercent);
  const hasValidImages = result.images?.some((img) => img.url && img.url.startsWith('http'));

  return (
    <div className="result-display">
      {/* HERO : Anarana siantifika + anarana mahazatra */}
      <div className="result-hero">
        <span className="result-hero__tag">Espèce identifiée</span>
        <h2 className="result-hero__title">{result.scientificName}</h2>
        {result.commonNames?.length > 0 && (
          <div className="badge-row">
            {result.commonNames.slice(0, 4).map((name, i) => (
              <span className="badge badge--soft" key={i}>{name}</span>
            ))}
          </div>
        )}
      </div>

      {/* CONFIANCE + STATUT */}
      <div className="stat-row">
        <div className="stat-card">
          <div className="stat-card__head">
            <span className="stat-card__label">Confiance</span>
            <span className="stat-card__value">{scorePercent}%</span>
          </div>
          <div className="score-bar">
            <div
              className="score-fill"
              style={{
                width: `${scorePercent}%`,
                background: `linear-gradient(90deg, ${scoreColor.start}, ${scoreColor.end})`,
              }}
            />
          </div>
          <span className="stat-card__hint">Fiabilité {scoreColor.label.toLowerCase()}</span>
        </div>

        <div className="stat-card">
          <span className="stat-card__label">Statut de conservation</span>
          <div className="stat-card__badge-wrap">
            <span className={getStatusStyle(result.conservationStatus)}>
              {result.conservationStatus || 'Non renseigné'}
            </span>
          </div>
        </div>
      </div>

      {/* UTILISATION */}
      <div className="info-block">
        <div className="info-block__icon">🌿</div>
        <div>
          <h3 className="info-block__title">Utilisation</h3>
          <p className="info-block__text">
            {result.uses || 'Aucune donnée locale disponible.'}
          </p>
        </div>
      </div>

      {/* CARACTÉRISTIQUES */}
      {characteristics.length > 0 && (
        <div className="result-section">
          <h3 className="section-title">Caractéristiques</h3>
          <div className="feature-grid">
            {characteristics.map(([label, value]) => (
              <div className="feature-card" key={label}>
                <span className="feature-card__label">{label}</span>
                <span className="feature-card__value">{value}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* IMAGES DE RÉFÉRENCE */}
      {hasValidImages && (
        <div className="result-section">
          <h3 className="section-title">Images de référence</h3>
          <div className="images-grid">
            {result.images
              .filter((img) => img.url && img.url.startsWith('http'))
              .slice(0, 4)
              .map((image, index) => (
                <a
                  className="image-card"
                  key={index}
                  href={image.url}
                  target="_blank"
                  rel="noreferrer"
                >
                  <img src={proxify(image.url)} alt={result.scientificName} loading="lazy" />
                  <span className="image-card__credit">📷 {image.credit}</span>
                </a>
              ))}
          </div>
        </div>
      )}

      {/* AUTRES CORRESPONDANCES */}
      {topAlternatives.length > 0 && (
        <div className="result-section">
          <h3 className="section-title">Autres correspondances possibles</h3>
          <div className="alt-list">
            {topAlternatives.map((item, index) => {
              const altPercent = Math.round((item.score || 0) * 100);
              return (
                <div className="alt-card" key={index}>
                  <div className="alt-card__info">
                    <strong className="alt-card__name">{item.scientificName}</strong>
                    <span className="alt-card__common">
                      {item.commonNames?.slice(0, 2).join(', ') || 'Nom commun inconnu'}
                    </span>
                  </div>
                  <div className="alt-card__score">
                    <div className="mini-bar">
                      <div className="mini-fill" style={{ width: `${altPercent}%` }} />
                    </div>
                    <span className="alt-card__percent">{altPercent}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* LIENS EXTERNES */}
      <div className="result-section">
        <h3 className="section-title">En savoir plus</h3>
        <div className="external-links">
          <a
            href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(result.scientificName)}`}
            target="_blank"
            rel="noreferrer"
          >
            🔍 Google Images
          </a>
          <a
            href={`https://fr.wikipedia.org/wiki/${encodeURIComponent(result.scientificName)}`}
            target="_blank"
            rel="noreferrer"
          >
            📖 Wikipedia
          </a>
          <a
            href={`https://www.gbif.org/species/search?q=${encodeURIComponent(result.scientificName)}`}
            target="_blank"
            rel="noreferrer"
          >
            🌍 GBIF
          </a>
        </div>
      </div>
    </div>
  );
};

export default ResultDisplay;