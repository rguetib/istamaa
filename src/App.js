import React, { useState, useRef, useEffect, useCallback } from 'react';
import './index.css';

/* ---------- Utilitaires ---------- */

const formatTime = (t) => {
  const s = Math.max(0, t || 0);
  const m = Math.floor(s / 60);
  const sec = (s % 60).toFixed(1).padStart(4, '0');
  return `${m}:${sec}`;
};

const parseTime = (str) => {
  const clean = str.trim().replace(',', '.');
  const parts = clean.split(':');
  if (parts.length > 2) return null;
  const [m, s] = parts.length === 2 ? parts : [0, parts[0]];
  const t = Number(m) * 60 + Number(s);
  return Number.isFinite(t) && t >= 0 ? t : null;
};

const getVideoId = (url) => {
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?(?:.*&)?v=|shorts\/|embed\/|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  return m ? m[1] : null;
};

let ytPromise = null;
const ensureYT = () => {
  if (window.YT && window.YT.Player) return Promise.resolve();
  if (!ytPromise) {
    ytPromise = new Promise((resolve) => {
      const previous = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        if (previous) previous();
        resolve();
      };
      const script = document.createElement('script');
      script.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(script);
    });
  }
  return ytPromise;
};

const STORAGE_KEY = 'ecoute-passages';
const loadSaved = () => {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
  } catch {
    return [];
  }
};

const btn =
  'rounded-lg border border-teal-800/30 bg-white px-3 py-3 text-base active:bg-teal-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-teal-700';

/* ---------- Réglage d'un temps ---------- */

function TimeAdjuster({ label, markLabel, value, onChange, onMark, onTest, testLabel }) {
  const [draft, setDraft] = useState(formatTime(value));
  useEffect(() => setDraft(formatTime(value)), [value]);

  const adjust = (d) => onChange(Math.max(0, +(value + d).toFixed(1)));
  const commit = () => {
    const t = parseTime(draft);
    if (t === null) setDraft(formatTime(value));
    else onChange(t);
  };

  return (
    <section className="mb-5">
      <h2 className="mb-2 text-lg font-semibold">{label}</h2>
      <div className="flex items-center gap-2">
        <button className={btn} onClick={() => adjust(-1)} aria-label={`${label} : reculer d'une seconde`}>−1 s</button>
        <button className={btn} onClick={() => adjust(-0.5)} aria-label={`${label} : reculer d'une demi-seconde`}>−0,5</button>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
          inputMode="decimal"
          aria-label={label}
          className="w-full min-w-0 rounded-lg border border-teal-800/30 bg-white px-2 py-3 text-center text-xl tabular-nums"
        />
        <button className={btn} onClick={() => adjust(0.5)} aria-label={`${label} : avancer d'une demi-seconde`}>+0,5</button>
        <button className={btn} onClick={() => adjust(1)} aria-label={`${label} : avancer d'une seconde`}>+1 s</button>
      </div>
      <div className="mt-2 flex gap-2">
        <button
          onClick={onMark}
          className="flex-1 rounded-lg bg-teal-800 px-3 py-3 text-base font-medium text-white active:bg-teal-900"
        >
          {markLabel}
        </button>
        <button className={`${btn} flex-1`} onClick={onTest}>{testLabel}</button>
      </div>
    </section>
  );
}

/* ---------- Application ---------- */

function App() {
  const [videoUrl, setVideoUrl] = useState('');
  const [videoType, setVideoType] = useState(null); // 'youtube' | 'local'
  const [error, setError] = useState('');
  const [ready, setReady] = useState(false);

  const [startTime, setStartTime] = useState(0);
  const [endTime, setEndTime] = useState(10);
  const [repeatCount, setRepeatCount] = useState('5');
  const [pauseSec, setPauseSec] = useState('0');
  const [rate, setRate] = useState('1');

  const [isLooping, setIsLooping] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [now, setNow] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hideVideo, setHideVideo] = useState(false);

  const [saved, setSaved] = useState(loadSaved);
  const [passageName, setPassageName] = useState('');

  const videoRef = useRef(null);
  const ytHostRef = useRef(null);
  const playerRef = useRef(null);
  const typeRef = useRef(null);
  const timerRef = useRef(null); // pauses entre répétitions et tests
  const loopRef = useRef({ active: false, waiting: false, current: 0, total: 0 });

  // Valeurs toujours à jour pour la boucle
  const live = useRef({});
  live.current = { startTime, endTime, repeatCount, pauseSec };
  typeRef.current = videoType;

  /* --- Contrôle commun YouTube / fichier local --- */
  const getTime = () =>
    typeRef.current === 'youtube'
      ? playerRef.current?.getCurrentTime?.() ?? 0
      : videoRef.current?.currentTime ?? 0;
  const seekTo = (t) => {
    if (typeRef.current === 'youtube') playerRef.current?.seekTo(t, true);
    else if (videoRef.current) videoRef.current.currentTime = t;
  };
  const play = () =>
    typeRef.current === 'youtube' ? playerRef.current?.playVideo() : videoRef.current?.play();
  const pause = () =>
    typeRef.current === 'youtube' ? playerRef.current?.pauseVideo() : videoRef.current?.pause();
  const isPlaying = () =>
    typeRef.current === 'youtube'
      ? playerRef.current?.getPlayerState?.() === 1
      : videoRef.current && !videoRef.current.paused;

  /* --- Arrêt de la boucle --- */
  const stopLoop = useCallback((andPause = false) => {
    clearTimeout(timerRef.current);
    loopRef.current = { active: false, waiting: false, current: 0, total: 0 };
    setIsLooping(false);
    setProgress({ current: 0, total: 0 });
    if (andPause) pause();
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  /* --- Chargement automatique d'une URL YouTube --- */
  useEffect(() => {
    if (!videoUrl.trim()) {
      setError('');
      return;
    }
    const id = getVideoId(videoUrl);
    if (!id) {
      setError("Lien YouTube non reconnu. Collez l'adresse complète de la vidéo.");
      return;
    }
    setError('');
    stopLoop();
    setVideoType('youtube');
    typeRef.current = 'youtube';
    setReady(false);

    let cancelled = false;
    ensureYT().then(() => {
      if (cancelled) return;
      if (playerRef.current) {
        playerRef.current.cueVideoById(id);
        setReady(true);
      } else {
        const target = document.createElement('div');
        ytHostRef.current.appendChild(target);
        playerRef.current = new window.YT.Player(target, {
          videoId: id,
          width: '100%',
          playerVars: { playsinline: 1 },
          events: {
            onReady: () => setReady(true),
            onError: () => setError("Cette vidéo ne peut pas être lue ici."),
          },
        });
      }
    });
    return () => {
      cancelled = true;
    };
  }, [videoUrl, stopLoop]);

  /* --- Fichier local --- */
  const handleLocalVideoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    stopLoop(true);
    setVideoUrl('');
    setError('');
    playerRef.current?.pauseVideo?.();
    setVideoType('local');
    typeRef.current = 'local';
    videoRef.current.src = URL.createObjectURL(file);
    videoRef.current.load();
  };

  /* --- Boucle principale (toutes les 100 ms) --- */
  useEffect(() => {
    const id = setInterval(() => {
      if (!typeRef.current) return;
      const t = getTime();
      setNow(t);
      const d =
        typeRef.current === 'youtube'
          ? playerRef.current?.getDuration?.() ?? 0
          : videoRef.current?.duration || 0;
      if (d && Number.isFinite(d)) setDuration(d);

      const L = loopRef.current;
      if (!L.active || L.waiting || !isPlaying()) return;
      if (t < live.current.endTime) return;

      if (L.current >= L.total) {
        stopLoop(true);
        return;
      }
      L.current += 1;
      setProgress({ current: L.current, total: L.total });
      const wait = Number(live.current.pauseSec) * 1000;
      if (wait > 0) {
        pause();
        L.waiting = true;
        timerRef.current = setTimeout(() => {
          if (!loopRef.current.active) return;
          seekTo(live.current.startTime);
          play();
          loopRef.current.waiting = false;
        }, wait);
      } else {
        seekTo(live.current.startTime);
      }
    }, 100);
    return () => clearInterval(id);
  }, [stopLoop]);

  /* --- Vitesse --- */
  useEffect(() => {
    const r = Number(rate);
    if (typeRef.current === 'youtube') playerRef.current?.setPlaybackRate?.(r);
    if (videoRef.current) videoRef.current.playbackRate = r;
  }, [rate, ready, videoType]);

  /* --- Actions --- */
  const canPlay = videoType === 'local' || (videoType === 'youtube' && ready);

  const startLoop = () => {
    if (!canPlay) return;
    if (endTime <= startTime) {
      setError('La fin doit être après le début.');
      return;
    }
    setError('');
    stopLoop();
    const total = repeatCount === '∞' ? Infinity : Number(repeatCount);
    loopRef.current = { active: true, waiting: false, current: 1, total };
    setIsLooping(true);
    setProgress({ current: 1, total });
    seekTo(startTime);
    play();
  };

  const togglePlay = useCallback(() => {
    if (isPlaying()) pause();
    else play();
  }, []);

  const back5 = () => seekTo(Math.max(0, getTime() - 5));

  const testSegment = (from, to) => {
    if (!canPlay) return;
    stopLoop();
    seekTo(from);
    play();
    timerRef.current = setTimeout(pause, Math.max(0.3, to - from) * 1000 / Number(rate));
  };
  const testStart = () => testSegment(startTime, Math.min(startTime + 3, endTime));
  const testEnd = () => testSegment(Math.max(startTime, endTime - 3), endTime);

  /* --- Passages enregistrés --- */
  const persist = (list) => {
    setSaved(list);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    } catch {
      /* stockage indisponible */
    }
  };
  const savePassage = () => {
    if (videoType !== 'youtube' || !getVideoId(videoUrl)) {
      setError("Seules les vidéos YouTube peuvent être enregistrées.");
      return;
    }
    const name = passageName.trim() || `Passage ${formatTime(startTime)}`;
    persist([
      ...saved,
      { id: Date.now(), name, url: videoUrl, startTime, endTime, repeatCount, pauseSec, rate },
    ]);
    setPassageName('');
    setError('');
  };
  const openPassage = (p) => {
    stopLoop();
    setStartTime(p.startTime);
    setEndTime(p.endTime);
    setRepeatCount(p.repeatCount);
    setPauseSec(p.pauseSec);
    setRate(p.rate);
    setVideoUrl(p.url);
  };
  const deletePassage = (id) => persist(saved.filter((p) => p.id !== id));

  /* --- Raccourcis clavier --- */
  useEffect(() => {
    const onKey = (e) => {
      const tag = e.target.tagName;
      if (['INPUT', 'SELECT', 'TEXTAREA', 'BUTTON'].includes(tag)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        togglePlay();
      } else if (e.code === 'ArrowLeft') back5();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePlay]);

  /* --- Affichage --- */
  const pct = (t) => (duration ? Math.min(100, (t / duration) * 100) : 0);
  const repeatLabel =
    progress.total === Infinity ? `Répétition ${progress.current}` : `Répétition ${progress.current} sur ${progress.total}`;

  return (
    <div className="mx-auto max-w-md bg-[#eef3f2] p-4 pb-32 text-slate-900 sm:my-6 sm:rounded-2xl">
      <h1 className="mb-1 text-center text-3xl">استماع</h1>
      <p className="mb-5 text-center text-slate-600">Écouter un passage en boucle</p>

      {/* 1. Source */}
      <section className="mb-5">
        <label htmlFor="url" className="mb-2 block text-lg font-semibold">Lien YouTube</label>
        <input
          id="url"
          type="url"
          value={videoUrl}
          onChange={(e) => setVideoUrl(e.target.value)}
          placeholder="Collez le lien ici"
          className="w-full rounded-lg border border-teal-800/30 bg-white p-3 text-base"
        />
        <label htmlFor="file" className="mb-2 mt-4 block text-slate-700">
          ou un fichier audio / vidéo de votre appareil
        </label>
        <input
          id="file"
          type="file"
          accept="audio/*,video/*"
          onChange={handleLocalVideoChange}
          className="w-full rounded-lg border border-teal-800/30 bg-white p-2 text-base"
        />
        {error && (
          <p role="alert" className="mt-3 rounded-lg bg-red-100 p-3 text-red-900">{error}</p>
        )}
      </section>

      {/* Lecteur */}
      <div className="mb-3" style={{ display: videoType && !hideVideo ? 'block' : 'none' }}>
        <div ref={ytHostRef} style={{ display: videoType === 'youtube' ? 'block' : 'none' }} />
        <video
          ref={videoRef}
          controls
          playsInline
          className="w-full"
          style={{ display: videoType === 'local' ? 'block' : 'none' }}
        />
      </div>
      {videoType && (
        <label className="mb-4 flex items-center gap-2 text-slate-700">
          <input type="checkbox" checked={hideVideo} onChange={(e) => setHideVideo(e.target.checked)} />
          Masquer la vidéo (audio seulement)
        </label>
      )}

      {/* Barre de position en lecture seule */}
      <div className="mb-1 flex justify-between text-sm tabular-nums text-slate-600">
        <span>{formatTime(now)}</span>
        <span>{duration ? formatTime(duration) : ''}</span>
      </div>
      <div
        className="relative mb-2 h-3 overflow-hidden rounded-full bg-slate-300"
        role="progressbar"
        aria-label="Position de lecture"
        aria-valuemin={0}
        aria-valuemax={Math.round(duration)}
        aria-valuenow={Math.round(now)}
      >
        <div
          className="absolute inset-y-0 bg-teal-600/50"
          style={{ left: `${pct(startTime)}%`, width: `${Math.max(0, pct(endTime) - pct(startTime))}%` }}
        />
        <div className="absolute inset-y-0 w-1 bg-slate-900" style={{ left: `${pct(now)}%` }} />
      </div>
      <button className={`${btn} mb-6 w-full`} onClick={back5} disabled={!canPlay}>
        ↺ Reculer de 5 s
      </button>

      {/* 2. Passage */}
      <TimeAdjuster
        label="Début"
        markLabel="Début ici"
        testLabel="Tester le début"
        value={startTime}
        onChange={setStartTime}
        onMark={() => setStartTime(+getTime().toFixed(1))}
        onTest={testStart}
      />
      <TimeAdjuster
        label="Fin"
        markLabel="Fin ici"
        testLabel="Tester la fin"
        value={endTime}
        onChange={setEndTime}
        onMark={() => setEndTime(+getTime().toFixed(1))}
        onTest={testEnd}
      />

      {/* 3. Options */}
      <section className="mb-6 grid grid-cols-3 gap-3">
        <div>
          <label htmlFor="repeat" className="mb-1 block">Répétitions</label>
          <select id="repeat" value={repeatCount} onChange={(e) => setRepeatCount(e.target.value)}
            className="w-full rounded-lg border border-teal-800/30 bg-white p-3 text-base">
            {[...Array(20)].map((_, i) => <option key={i + 1} value={String(i + 1)}>{i + 1}</option>)}
            <option value="∞">∞</option>
          </select>
        </div>
        <div>
          <label htmlFor="pause" className="mb-1 block">Pause entre</label>
          <select id="pause" value={pauseSec} onChange={(e) => setPauseSec(e.target.value)}
            className="w-full rounded-lg border border-teal-800/30 bg-white p-3 text-base">
            {[0, 2, 5, 10].map((s) => <option key={s} value={String(s)}>{s} s</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="rate" className="mb-1 block">Vitesse</label>
          <select id="rate" value={rate} onChange={(e) => setRate(e.target.value)}
            className="w-full rounded-lg border border-teal-800/30 bg-white p-3 text-base">
            {['0.5', '0.75', '1', '1.25', '1.5'].map((r) => <option key={r} value={r}>{r.replace('.', ',')}×</option>)}
          </select>
        </div>
      </section>

      {/* 4. Passages enregistrés */}
      <section className="mb-6">
        <h2 className="mb-2 text-lg font-semibold">Mes passages</h2>
        <div className="flex gap-2">
          <input
            value={passageName}
            onChange={(e) => setPassageName(e.target.value)}
            placeholder="Nom (ex. Saffat 1–10)"
            aria-label="Nom du passage"
            className="min-w-0 flex-1 rounded-lg border border-teal-800/30 bg-white p-3 text-base"
          />
          <button className={btn} onClick={savePassage}>Enregistrer</button>
        </div>
        {saved.length === 0 ? (
          <p className="mt-3 text-slate-600">
            Réglez un passage, donnez-lui un nom et enregistrez-le pour le retrouver en un clic.
          </p>
        ) : (
          <ul className="mt-3 space-y-2">
            {saved.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <button className={`${btn} flex-1 text-left`} onClick={() => openPassage(p)}>
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 text-sm tabular-nums text-slate-600">
                    {formatTime(p.startTime)} – {formatTime(p.endTime)}
                  </span>
                </button>
                <button className={btn} onClick={() => deletePassage(p.id)} aria-label={`Supprimer ${p.name}`}>
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Barre fixe en bas */}
      <div className="fixed inset-x-0 bottom-0 border-t border-teal-800/20 bg-[#eef3f2] p-3">
        <div className="mx-auto max-w-md">
          {isLooping && (
            <p className="mb-2 text-center tabular-nums text-slate-700" aria-live="polite">
              {repeatLabel}
            </p>
          )}
          <div className="flex gap-2">
            <button
              onClick={togglePlay}
              disabled={!canPlay}
              className={`${btn} w-24 disabled:opacity-40`}
            >
              Lecture / Pause
            </button>
            {isLooping ? (
              <button
                onClick={() => stopLoop(true)}
                className="flex-1 rounded-lg bg-red-700 px-4 py-4 text-lg font-medium text-white active:bg-red-800"
              >
                Arrêter la boucle
              </button>
            ) : (
              <button
                onClick={startLoop}
                disabled={!canPlay}
                className="flex-1 rounded-lg bg-teal-800 px-4 py-4 text-lg font-medium text-white active:bg-teal-900 disabled:opacity-40"
              >
                Lancer la boucle
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
