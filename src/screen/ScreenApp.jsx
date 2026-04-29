import { useEffect, useRef, useState } from "react";
import { subscribeToServerEvents } from "../lib/api";

const DEFAULT_SETTINGS = {
  refreshSeconds: 30,
  transitionMs: 1200,
  imageDurationSeconds: 8,
  transitionStyle: "fade_black",
};

export default function ScreenApp() {
  const [playlist, setPlaylist] = useState([]);
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [status, setStatus] = useState({
    title: "Buscando contenido...",
    text: "Agrega imagenes o videos a la carpeta configurada para iniciar la senal.",
    visible: true,
  });
  const [resumeVisible, setResumeVisible] = useState(false);
  const [transitionPhase, setTransitionPhase] = useState("idle");
  const [activeItem, setActiveItem] = useState(null);
  const [spotifyQueue, setSpotifyQueue] = useState({
    queue: [],
    connected: false,
  });
  const [nowPlaying, setNowPlaying] = useState(null);
  const videoRef = useRef(null);
  const imageRef = useRef(null);
  const imageTimerRef = useRef(null);
  const playlistRef = useRef([]);
  const currentIndexRef = useRef(0);
  const settingsRef = useRef(DEFAULT_SETTINGS);
  const transitionLockRef = useRef(false);
  const activeItemRef = useRef(null);

  useEffect(() => {
    playlistRef.current = playlist;
  }, [playlist]);

  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);

  useEffect(() => {
    activeItemRef.current = activeItem;
  }, [activeItem]);

  useEffect(() => {
    const unsubscribe = subscribeToServerEvents(
      (event) => {
        if (event.type === "playlist:update") {
          applyPlaylistPayload(event.payload || {});
        }

        if (event.type === "music-queue:update") {
          setSpotifyQueue({
            queue: event.payload?.queue || [],
            connected: Boolean(event.payload?.ok),
          });
        }

        if (event.type === "spotify-playback:update") {
          setNowPlaying(event.payload?.currentlyPlaying || null);
          setSpotifyQueue({
            queue: event.payload?.queue || [],
            connected: Boolean(event.payload?.connected),
          });
        }
      },
      {
        onClose: () => {
          setSpotifyQueue((current) => ({ ...current, connected: false }));
          setStatus((current) =>
            activeItemRef.current
              ? current
              : {
                  title: "Reconectando...",
                  text: "La pantalla esta esperando eventos del servidor.",
                  visible: true,
                }
          );
        },
      }
    );

    return () => {
      unsubscribe();
      stopPlayback();
    };
  }, []);

  async function applyPlaylistPayload(payload) {
    const nextPlaylist = (payload.videos || []).map((video) => ({
      ...video,
      url: `${video.url}?v=${encodeURIComponent(video.path)}&updated=${encodeURIComponent(
        video.modifiedAt || ""
      )}`,
    }));

    setPlaylist(nextPlaylist);
    setSettings(payload.settings || DEFAULT_SETTINGS);

    if (!nextPlaylist.length) {
      stopPlayback();
      setStatus({
        title: "No hay contenido disponible",
        text: "Copia imagenes o videos en la carpeta configurada y la pantalla se actualizara sola.",
        visible: true,
      });
      return;
    }

    const activeStillExists =
      activeItemRef.current &&
      nextPlaylist.some((item) => item.path === activeItemRef.current.path);

    if (!activeStillExists) {
      currentIndexRef.current = 0;
      await playItemAt(0, nextPlaylist);
    }
  }

  function stopPlayback() {
    const video = videoRef.current;
    const image = imageRef.current;
    if (imageTimerRef.current) {
      window.clearTimeout(imageTimerRef.current);
      imageTimerRef.current = null;
    }
    if (!video) {
      if (image) {
        image.removeAttribute("src");
      }
      setActiveItem(null);
      activeItemRef.current = null;
      return;
    }

    video.pause();
    video.removeAttribute("src");
    video.load();
    if (image) {
      image.removeAttribute("src");
    }
    setActiveItem(null);
    activeItemRef.current = null;
  }

  function nextIndex(list, currentIndex) {
    if (!list.length) {
      return 0;
    }
    return (currentIndex + 1) % list.length;
  }

  async function safePlay(video) {
    if (!video) {
      return false;
    }

    try {
      await video.play();
      setResumeVisible(false);
      return true;
    } catch (error) {
      setResumeVisible(true);
      setStatus({
        title: "Autoplay bloqueado",
        text: "Si el televisor lo requiere, presiona el botón una sola vez para arrancar la reproducción.",
        visible: true,
      });
      return false;
    }
  }

  async function playItemAt(index, sourceList = playlistRef.current) {
    const video = videoRef.current;
    const item = sourceList[index];

    if (!video || !item) {
      return false;
    }

    currentIndexRef.current = index;
    setActiveItem(item);
    activeItemRef.current = item;
    if (imageTimerRef.current) {
      window.clearTimeout(imageTimerRef.current);
      imageTimerRef.current = null;
    }

    video.src = item.url;
    video.load();

    if (item.type === "image") {
      video.pause();
      video.removeAttribute("src");
      video.load();
      if (imageRef.current) {
        imageRef.current.src = item.url;
      }
      setResumeVisible(false);
      setStatus((current) => ({ ...current, visible: false }));
      imageTimerRef.current = window.setTimeout(() => {
        transitionToNext();
      }, (settingsRef.current.imageDurationSeconds || 8) * 1000);
      return true;
    }

    if (imageRef.current) {
      imageRef.current.removeAttribute("src");
    }
    const started = await safePlay(video);
    if (!started) {
      return false;
    }
    setStatus((current) => ({ ...current, visible: false }));
    return true;
  }

  async function transitionToNext() {
    const activePlaylist = playlistRef.current;
    if (!activePlaylist.length || transitionLockRef.current) {
      return;
    }

    transitionLockRef.current = true;
    setTransitionPhase("exit");

    const next = nextIndex(activePlaylist, currentIndexRef.current);
    const halfTransition = Math.max(180, Math.floor((settingsRef.current.transitionMs || 1200) / 2));

    window.setTimeout(async () => {
      const started = await playItemAt(next, activePlaylist);
      setTransitionPhase("enter");
      window.setTimeout(() => {
        setTransitionPhase("idle");
        transitionLockRef.current = false;

        if (!started) {
          setStatus((current) => ({ ...current, visible: true }));
        }
      }, halfTransition);
    }, halfTransition);
  }

  async function handleResume() {
    const currentItem = playlistRef.current[currentIndexRef.current];
    const started =
      currentItem?.type === "image" ? true : await safePlay(videoRef.current);
    if (started) {
      setStatus((current) => ({ ...current, visible: false }));
    }
  }

  function getStageClasses() {
    const style = settings.transitionStyle || "fade_black";

    if (style === "slide_left") {
      if (transitionPhase === "exit") {
        return "opacity-0 -translate-x-16";
      }
      if (transitionPhase === "enter") {
        return "opacity-0 translate-x-16";
      }
      return "opacity-100 translate-x-0";
    }

    if (style === "zoom") {
      if (transitionPhase === "exit") {
        return "opacity-0 scale-[1.04]";
      }
      if (transitionPhase === "enter") {
        return "opacity-0 scale-[0.96]";
      }
      return "opacity-100 scale-100";
    }

    if (transitionPhase === "idle") {
      return "opacity-100";
    }

    return "opacity-0";
  }

  const halfTransition = Math.max(180, Math.floor((settings.transitionMs || 1200) / 2));
  const showBlackOverlay =
    (settings.transitionStyle || "fade_black") === "fade_black" && transitionPhase !== "idle";

  return (
    <main className="relative h-screen w-screen overflow-hidden bg-screen-stage text-white">
      <div
        className={`absolute inset-0 transform-gpu transition-all ease-out ${getStageClasses()}`}
        style={{ transitionDuration: `${halfTransition}ms` }}
      >
        <video
          ref={videoRef}
          autoPlay
          preload="auto"
          playsInline
          muted
          className={`absolute inset-0 h-full w-full bg-black object-contain ${
            activeItem?.type === "video" ? "block" : "hidden"
          }`}
          onEnded={transitionToNext}
          onError={() => {
            setStatus({
              title: "Un archivo no pudo abrirse",
              text: "DrinkScreen intentara continuar con el siguiente elemento.",
              visible: true,
            });
            window.setTimeout(() => transitionToNext(), 500);
          }}
        />
        <img
          ref={imageRef}
          alt=""
          className={`absolute inset-0 h-full w-full bg-black object-contain ${
            activeItem?.type === "image" ? "block" : "hidden"
          }`}
        />
      </div>

      <div
        className={`pointer-events-none absolute inset-0 bg-black transition-opacity ${
          showBlackOverlay ? "opacity-100" : "opacity-0"
        }`}
        style={{ transitionDuration: `${halfTransition}ms` }}
      />

      <div
        className={`absolute inset-0 flex items-center justify-center bg-slate-950/75 px-6 transition-opacity ${
          status.visible ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      >
        <div className="w-full max-w-3xl rounded-[2rem] border border-white/10 bg-slate-950/60 p-8 shadow-soft backdrop-blur-xl">
          <p className="mb-3 text-xs uppercase tracking-[0.35em] text-emerald-300">DrinkScreen</p>
          <h1 className="font-display text-5xl uppercase leading-none md:text-7xl">
            {status.title}
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-300 md:text-xl">{status.text}</p>
          <p className="mt-8 text-sm uppercase tracking-[0.28em] text-slate-400">
            Playlist activa: {playlist.length} elemento{playlist.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      {resumeVisible ? (
        <button
          type="button"
          onClick={handleResume}
          className="absolute bottom-8 left-1/2 -translate-x-1/2 rounded-full bg-emerald-300 px-6 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-950 shadow-soft"
        >
          Iniciar reproducción
        </button>
      ) : null}

      {spotifyQueue.connected && spotifyQueue.queue.length ? (
        <aside className="absolute bottom-0 left-0 top-0 w-[min(34rem,42vw)] bg-gradient-to-r from-black/90 via-black/70 to-transparent px-7 py-8">
          <div className="flex h-full flex-col">
            <div className="min-h-0 flex-1">
              <p className="mb-4 text-sm font-semibold uppercase tracking-[0.22em] text-emerald-300/90">
                En cola
              </p>
              <div className="space-y-3 overflow-hidden">
                {spotifyQueue.queue.slice(0, 7).map((track, index) => (
                  <div
                    key={`${track.uri}-${index}`}
                    className="relative flex min-w-0 gap-4 border-t border-white/10 pt-3"
                  >
                    <div className="relative h-12 w-12 flex-none overflow-hidden rounded-xl bg-emerald-300/10">
                      {track.image ? (
                        <img
                          src={track.image}
                          alt=""
                          className="h-full w-full object-cover opacity-55"
                          loading="lazy"
                        />
                      ) : null}
                      <span className="absolute inset-0 flex items-center justify-center bg-black/35 text-lg font-semibold text-emerald-100">
                        {index + 1}
                      </span>
                    </div>
                    <div className="min-w-0">
                      <p className="line-clamp-1 text-2xl font-semibold text-white">{track.name}</p>
                      <p className="mt-1 line-clamp-1 text-lg text-slate-300">{track.artists}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </aside>
      ) : null}

      {nowPlaying ? (
        <aside className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent px-8 pb-7 pt-16">
          <div className="ml-[min(34rem,42vw)] flex min-w-0 items-center gap-5">
            {nowPlaying.image ? (
              <img
                src={nowPlaying.image}
                alt=""
                className="h-20 w-20 flex-none rounded-xl object-cover opacity-70 shadow-soft"
              />
            ) : null}
            <div className="min-w-0">
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-300/90">
                Sonando ahora
              </p>
              <p className="mt-1 truncate text-4xl font-semibold leading-tight text-white">
                {nowPlaying.name}
              </p>
              <p className="truncate text-2xl text-slate-200">{nowPlaying.artists}</p>
            </div>
          </div>
        </aside>
      ) : null}
    </main>
  );
}
