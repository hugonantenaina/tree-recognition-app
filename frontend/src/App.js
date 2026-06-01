import { useState, useEffect, useCallback } from 'react';
import {
  signInWithPopup,
  signOut,
  onAuthStateChanged,
} from 'firebase/auth';
import {
  collection,
  addDoc,
  query,
  where,
  onSnapshot,
  deleteDoc,
  doc,
  getDocs,
  writeBatch,
} from 'firebase/firestore';
import { auth, googleProvider, db } from './firebase';
import Camera from './components/Camera';
import Upload from './components/Upload';
import ResultDisplay from './components/ResultDisplay';

const timeAgo = (iso) => {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "à l'instant";
  if (diff < 3600) return `il y a ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `il y a ${Math.floor(diff / 3600)} h`;
  return `il y a ${Math.floor(diff / 86400)} j`;
};

function App() {
  const [activeTab, setActiveTab] = useState('upload');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  // Mihaino ny fiovan'ny auth (miditra / mivoaka)
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
    return () => unsub();
  }, []);

  // Maka ny historique an'ny utilisateur avy any Firestore (temps réel)
  useEffect(() => {
    if (!user) {
      setHistory([]);
      return;
    }
    // Esorina ny orderBy (tsy mila index) — alamina ao amin'ny JS
    const q = query(
      collection(db, 'history'),
      where('uid', '==', user.uid)
    );
    const unsub = onSnapshot(
      q,
      (snap) => {
        const items = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        // Alamina arakaraka ny daty (vaovao indrindra aloha)
        items.sort((a, b) => new Date(b.date) - new Date(a.date));
        setHistory(items);
      },
      (err) => console.warn('Lecture historique :', err.message)
    );
    return () => unsub();
  }, [user]);

  const handleLogin = async () => {
    setError('');
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      setError('Connexion impossible : ' + err.message);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
    setResult(null);
  };

  const handleResult = useCallback(
    async (data) => {
      setResult(data);
      if (data && data.scientificName && user) {
        try {
          await addDoc(collection(db, 'history'), {
            uid: user.uid,
            scientificName: data.scientificName,
            commonNames: data.commonNames || [],
            score: data.score || 0,
            image:
              (data.images || []).find((i) => i.url && i.url.startsWith('http'))?.url || '',
            date: new Date().toISOString(),
            full: data,
          });
        } catch (err) {
          console.warn('Sauvegarde historique :', err.message);
        }
      }
    },
    [user]
  );

  const handleTab = (tab) => {
    setActiveTab(tab);
    setError('');
  };

  const resetSearch = () => {
    setResult(null);
    setError('');
  };

  const openFromHistory = (entry) => {
    setResult(entry.full);
    setError('');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deleteHistoryItem = async (id) => {
    try {
      await deleteDoc(doc(db, 'history', id));
    } catch (err) {
      console.warn('Suppression :', err.message);
    }
  };

  const clearHistory = async () => {
    if (!window.confirm('Effacer tout l’historique ?')) return;
    try {
      const q = query(collection(db, 'history'), where('uid', '==', user.uid));
      const snap = await getDocs(q);
      const batch = writeBatch(db);
      snap.docs.forEach((d) => batch.delete(d.ref));
      await batch.commit();
    } catch (err) {
      console.warn('Effacement :', err.message);
    }
  };

  return (
    <>
      {/* ===== HEADER FIXE ===== */}
      <header className="app-topbar">
        <div className="app-topbar__inner">
          <div className="app-topbar__brand">
            <span className="app-topbar__logo">🌳</span>
            <div>
              <strong>ArbreScan</strong>
              <small>Reconnaissance d'arbres par IA</small>
            </div>
          </div>
          <div className="app-topbar__actions">
            {result && (
              <button className="topbar-btn" onClick={resetSearch}>
                ＋ Nouvelle recherche
              </button>
            )}
            {user ? (
              <div className="user-chip">
                {user.photoURL && (
                  <img src={user.photoURL} alt={user.displayName} className="user-chip__avatar" />
                )}
                <span className="user-chip__name">{user.displayName?.split(' ')[0]}</span>
                <button className="user-chip__logout" onClick={handleLogout} title="Déconnexion">
                  ⏻ Déconnexion
                </button>
              </div>
            ) : (
              !authLoading && (
                <button className="google-btn" onClick={handleLogin}>
                  <svg width="18" height="18" viewBox="0 0 48 48">
                    <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.7 29.6 2.5 24 2.5 12.1 2.5 2.5 12.1 2.5 24S12.1 45.5 24 45.5 45.5 35.9 45.5 24c0-1.2-.1-2.3-.4-3.5z"/>
                    <path fill="#FF3D00" d="M5.3 14.7l6.6 4.8C13.7 16 18.5 12.5 24 12.5c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.7 29.6 2.5 24 2.5 16.3 2.5 9.6 6.9 5.3 14.7z"/>
                    <path fill="#4CAF50" d="M24 45.5c5.5 0 10.4-2.1 14.1-5.6l-6.5-5.5c-2 1.5-4.6 2.6-7.6 2.6-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 41 16.2 45.5 24 45.5z"/>
                    <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.5l6.5 5.5c-.5.4 6.8-5 6.8-15 0-1.2-.1-2.3-.4-3.5z"/>
                  </svg>
                  Se connecter
                </button>
              )
            )}
          </div>
        </div>
      </header>

      <div className="app-shell">
        {!user && !authLoading ? (
          // ===== ÉCRAN DE CONNEXION =====
          <div className="login-screen">
            <div className="login-card">
              <span className="login-card__logo">🌳</span>
              <h2>Bienvenue sur ArbreScan</h2>
              <p>Connecte-toi pour identifier des arbres et garder ton historique de recherches.</p>
              <button className="google-btn google-btn--lg" onClick={handleLogin}>
                <svg width="20" height="20" viewBox="0 0 48 48">
                  <path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3c-1.6 4.7-6.1 8-11.3 8-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.7 29.6 2.5 24 2.5 12.1 2.5 2.5 12.1 2.5 24S12.1 45.5 24 45.5 45.5 35.9 45.5 24c0-1.2-.1-2.3-.4-3.5z"/>
                  <path fill="#FF3D00" d="M5.3 14.7l6.6 4.8C13.7 16 18.5 12.5 24 12.5c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 4.7 29.6 2.5 24 2.5 16.3 2.5 9.6 6.9 5.3 14.7z"/>
                  <path fill="#4CAF50" d="M24 45.5c5.5 0 10.4-2.1 14.1-5.6l-6.5-5.5c-2 1.5-4.6 2.6-7.6 2.6-5.2 0-9.6-3.3-11.3-7.9l-6.5 5C9.5 41 16.2 45.5 24 45.5z"/>
                  <path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.5l6.5 5.5c-.5.4 6.8-5 6.8-15 0-1.2-.1-2.3-.4-3.5z"/>
                </svg>
                Se connecter avec Google
              </button>
              {error && <div className="alert">⚠️ {error}</div>}
            </div>
          </div>
        ) : (
          // ===== APP PRINCIPALE =====
          <main className="app-main">
            <div className="left-column">
              <section className="card card--tabs">
                <nav className="tab-list">
                  <button
                    className={activeTab === 'upload' ? 'tab tab--active' : 'tab'}
                    onClick={() => handleTab('upload')}
                  >
                    📁 Upload
                  </button>
                  <button
                    className={activeTab === 'camera' ? 'tab tab--active' : 'tab'}
                    onClick={() => handleTab('camera')}
                  >
                    📷 Caméra
                  </button>
                </nav>

                {activeTab === 'camera' ? (
                  <Camera setResult={handleResult} setLoading={setLoading} setError={setError} />
                ) : (
                  <Upload setResult={handleResult} setLoading={setLoading} setError={setError} />
                )}

                {error && <div className="alert">⚠️ {error}</div>}
              </section>

              <section className="card history-card">
                <div className="history-head">
                  <h3 className="section-title">Historique</h3>
                  {history.length > 0 && (
                    <button className="history-clear" onClick={clearHistory}>
                      Tout effacer
                    </button>
                  )}
                </div>

                {history.length === 0 ? (
                  <p className="history-empty">Aucune recherche pour le moment.</p>
                ) : (
                  <div className="history-list">
                    {history.map((item) => (
                      <div className="history-item" key={item.id}>
                        <button className="history-item__main" onClick={() => openFromHistory(item)}>
                          {item.image ? (
                            <img className="history-item__img" src={`https://arbrescan-api.onrender.com/api/image-proxy?url=${encodeURIComponent(item.image)}`} alt={item.scientificName} loading="lazy" />
                          ) : (
                            <span className="history-item__img history-item__img--placeholder">🌿</span>
                          )}
                          <span className="history-item__info">
                            <span className="history-item__name">{item.scientificName}</span>
                            <span className="history-item__meta">
                              {Math.round((item.score || 0) * 100)}% · {timeAgo(item.date)}
                            </span>
                          </span>
                        </button>
                        <button
                          className="history-item__del"
                          onClick={() => deleteHistoryItem(item.id)}
                          title="Supprimer"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>

            <section className="card card--result">
              {loading && (
                <div className="loader-block">
                  <div className="spinner" />
                  <span>Analyse en cours...</span>
                </div>
              )}

              {!loading && result && <ResultDisplay result={result} />}

              {!loading && !result && (
                <div className="placeholder">
                  <p>Choisis une photo pour identifier un arbre.</p>
                </div>
              )}
            </section>
          </main>
        )}

        <footer className="app-footer">
          <p>ArbreScan · Propulsé par Pl@ntNet API · {new Date().getFullYear()}</p>
        </footer>
      </div>
    </>
  );
}

export default App;