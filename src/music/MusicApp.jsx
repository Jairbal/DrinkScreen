import { useEffect, useMemo, useState } from "react";
import {
  addTrackToMusicQueue,
  fetchMusicQueue,
  fetchSpotifyStatus,
  searchSpotifyTracks,
  subscribeToServerEvents,
} from "../lib/api";

const HAS_REALTIME_BACKEND = Boolean(import.meta.env.VITE_API_BASE_URL);

function TrackArtwork({ track, className = "h-16 w-16" }) {
  if (track?.image) {
    return (
      <img
        src={track.image}
        alt=""
        className={`${className} flex-none rounded-xl bg-slate-900 object-cover`}
        loading="lazy"
      />
    );
  }

  return (
    <div
      className={`${className} flex flex-none items-center justify-center rounded-xl bg-emerald-400/10 text-sm font-bold text-emerald-200`}
    >
      ♪
    </div>
  );
}

function TrackRow({ track, actionLabel, pending, onAction }) {
  return (
    <article className="flex items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-3">
      <TrackArtwork track={track} />
      <div className="min-w-0 flex-1">
        <h3 className="truncate text-sm font-semibold text-white">{track.name}</h3>
        <p className="mt-1 truncate text-xs text-slate-400">{track.artists || "Spotify"}</p>
        {track.album ? <p className="mt-1 truncate text-xs text-slate-500">{track.album}</p> : null}
      </div>
      {onAction ? (
        <button
          type="button"
          onClick={() => onAction(track)}
          disabled={pending}
          className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-950 transition hover:bg-emerald-300 disabled:opacity-60"
        >
          {pending ? "..." : actionLabel}
        </button>
      ) : null}
    </article>
  );
}

function getFriendlySpotifyError(message) {
  if (/insufficient client scope/i.test(message || "")) {
    return "Spotify rechazo la solicitud por permisos insuficientes. Reconecta la cuenta desde el panel. Si pasa solo al buscar, pega el enlace de la cancion de Spotify para agregarla directo.";
  }

  return message;
}

function parseSpotifyTrackUri(value) {
  const input = value.trim();
  const uriMatch = /^spotify:track:([A-Za-z0-9]+)$/.exec(input);
  if (uriMatch) {
    return `spotify:track:${uriMatch[1]}`;
  }

  const urlMatch = /open\.spotify\.com\/track\/([A-Za-z0-9]+)/.exec(input);
  if (urlMatch) {
    return `spotify:track:${urlMatch[1]}`;
  }

  return "";
}

export default function MusicApp() {
  const [status, setStatus] = useState({ loading: true, configured: true, connected: false });
  const [query, setQuery] = useState("");
  const [results, setResults] = useState([]);
  const [queue, setQueue] = useState({ queue: [] });
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [pendingUri, setPendingUri] = useState("");
  const [searching, setSearching] = useState(false);

  const normalizedQuery = useMemo(() => query.trim(), [query]);
  const pastedTrackUri = useMemo(() => parseSpotifyTrackUri(query), [query]);

  useEffect(() => {
    let mounted = true;

    fetchSpotifyStatus()
      .then((payload) => {
        if (mounted) {
          setStatus({ loading: false, ...payload });
        }
      })
      .catch((requestError) => {
        if (mounted) {
          setStatus({ loading: false, configured: true, connected: false });
        }
      });

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    return subscribeToServerEvents((event) => {
      if (event.type !== "music-queue:update") {
        return;
      }

      if (event.payload?.ok) {
        setQueue({ queue: event.payload.queue || [] });
      } else if (event.payload?.message) {
        setError(getFriendlySpotifyError(event.payload.message));
      }
    }, { disabled: !HAS_REALTIME_BACKEND });
  }, []);

  useEffect(() => {
    if (HAS_REALTIME_BACKEND) {
      return undefined;
    }

    let cancelled = false;
    let timerId = null;

    async function refreshQueue() {
      try {
        const payload = await fetchMusicQueue();
        if (!cancelled) {
          setQueue({ queue: payload.queue || [] });
        }
      } catch (requestError) {
        if (!cancelled) {
          setError(getFriendlySpotifyError(requestError.message));
        }
      } finally {
        if (!cancelled) {
          timerId = window.setTimeout(refreshQueue, 5000);
        }
      }
    }

    refreshQueue();

    return () => {
      cancelled = true;
      if (timerId) {
        window.clearTimeout(timerId);
      }
    };
  }, []);

  useEffect(() => {
    setMessage("");
    setError("");

    if (normalizedQuery.length < 2 || !status.configured || pastedTrackUri) {
      setResults([]);
      setSearching(false);
      return undefined;
    }

    let active = true;
    setSearching(true);
    const timerId = window.setTimeout(async () => {
      try {
        const payload = await searchSpotifyTracks(normalizedQuery);
        if (active) {
          setResults(payload.tracks || []);
        }
      } catch (requestError) {
        if (active) {
          setError(getFriendlySpotifyError(requestError.message));
          setResults([]);
        }
      } finally {
        if (active) {
          setSearching(false);
        }
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timerId);
      setSearching(false);
    };
  }, [normalizedQuery, pastedTrackUri, status.configured]);

  async function handleAdd(track) {
    setPendingUri(track.uri);
    setMessage("");
    setError("");

    try {
      const payload = await addTrackToMusicQueue(track);
      setMessage(`Agregada a la lista: ${track.name}`);
      setQueue({ queue: payload.queue || [] });
      setQuery("");
      setResults([]);
      setSearching(false);
    } catch (requestError) {
      setError(getFriendlySpotifyError(requestError.message));
    } finally {
      setPendingUri("");
    }
  }

  async function handleAddPastedTrack() {
    if (!pastedTrackUri) {
      return;
    }

    setPendingUri(pastedTrackUri);
    setMessage("");
    setError("");

    try {
      const payload = await addTrackToMusicQueue({ uri: pastedTrackUri });
      setMessage("Cancion agregada a la lista.");
      setQuery("");
      setQueue({ queue: payload.queue || [] });
    } catch (requestError) {
      setError(getFriendlySpotifyError(requestError.message));
    } finally {
      setPendingUri("");
    }
  }

  return (
    <main className="min-h-screen bg-[#030712] px-4 py-6 text-white">
      <div className="mx-auto max-w-3xl">
        <header className="rounded-[2rem] border border-white/10 bg-[#07101f] p-6 shadow-soft">
          <div className="flex items-center gap-5">
            <img
              src="/branding/area51-logo-transparent.png"
              alt="Licoreria Area51"
              className="h-24 w-24 flex-none object-contain"
            />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-300/80">
                Licoreria Area51
              </p>
              <h1 className="mt-2 text-4xl font-semibold">Busca tu cancion</h1>
              <p className="mt-2 text-sm text-slate-400">
                Av. 10 de Agosto y Av. el Inca
              </p>
              <p className="mt-1 text-sm font-semibold text-emerald-200">
                Puedes realizar tus pedidos de licores a nuestro WhatsApp: +593 95 883 7927
              </p>
            </div>
          </div>
          <p className="mt-5 text-sm text-slate-400">
            Elige una cancion y agregala a la cola de reproduccion del local.
          </p>
        </header>

        {!status.loading && !status.configured ? (
          <section className="mt-5 rounded-[1.5rem] border border-amber-300/20 bg-amber-300/10 p-5 text-sm text-amber-100">
            Spotify todavia no esta configurado. Pide al administrador que agregue las credenciales en el servidor.
          </section>
        ) : null}

        <section className="mt-5 rounded-[2rem] border border-white/10 bg-[#07101f] p-5 shadow-soft">
          <label className="block">
            <span className="mb-2 block text-sm font-medium text-slate-300">
              Busca tu cancion
            </span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              disabled={!status.configured}
              placeholder="Nombre de cancion, artista o enlace de Spotify"
              className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400 disabled:opacity-60"
            />
          </label>

          {pastedTrackUri ? (
            <button
              type="button"
              onClick={handleAddPastedTrack}
              disabled={pendingUri === pastedTrackUri}
              className="mt-4 rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-emerald-300 disabled:opacity-60"
            >
              {pendingUri === pastedTrackUri ? "Agregando..." : "Agregar enlace a la lista"}
            </button>
          ) : null}

          {message ? <p className="mt-4 text-sm text-emerald-300">{message}</p> : null}
          {error ? <p className="mt-4 text-sm text-red-300">{error}</p> : null}

          {searching ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
              Buscando sugerencias...
            </div>
          ) : null}

          <div className="mt-5 space-y-3">
            {results.map((track) => (
              <TrackRow
                key={track.uri}
                track={track}
                actionLabel="Agregar"
                pending={pendingUri === track.uri}
                onAction={handleAdd}
              />
            ))}
          </div>

          {!searching && normalizedQuery.length >= 2 && !pastedTrackUri && !results.length && !error ? (
            <div className="mt-5 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
              No encontre coincidencias. Prueba con el artista o una parte del titulo.
            </div>
          ) : null}
        </section>

        <section className="mt-5 rounded-[2rem] border border-white/10 bg-[#07101f] p-5 shadow-soft">
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300/80">
            Lista actual
          </p>
          <div className="mt-4 space-y-3">
            {queue.queue.length ? (
              queue.queue.slice(0, 7).map((track, index) => (
                <TrackRow key={`${track.uri}-${index}`} track={track} />
              ))
            ) : (
              <p className="text-sm text-slate-400">Todavia no hay canciones pedidas.</p>
            )}
          </div>
        </section>

        <footer className="py-6 text-center text-xs text-slate-500">
          <p>Desarrollado por Jair Balcazar</p>
          <p className="mt-1">jairbalcazar.jb@gmail.com</p>
        </footer>
      </div>
    </main>
  );
}
