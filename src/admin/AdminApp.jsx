import { useEffect, useMemo, useState } from "react";
import {
  addTrackToMusicQueue,
  deleteVideo,
  deleteMusicQueueTrack,
  disconnectSpotify,
  fetchConfig,
  fetchHealth,
  fetchMusicQueue,
  fetchPlaylist,
  fetchSession,
  fetchSpotifyStatus,
  login,
  logout,
  playMusicTrackNow,
  playNextMusicQueueTrack,
  saveConfig,
  saveMusicQueueOrder,
  savePlaylistOrder,
  searchSpotifyTracks,
  uploadVideos,
} from "../lib/api";
import { formatBytes, formatDate } from "../lib/format";

const EMPTY_FORM = {
  host: "",
  port: 8080,
  videoDirectory: "",
  refreshSeconds: 30,
  transitionMs: 1200,
  imageDurationSeconds: 8,
  transitionStyle: "fade_black",
};

const TRANSITION_OPTIONS = [
  { value: "fade_black", label: "Fundido a negro", hint: "Mas estable para TVs basicos." },
  { value: "fade", label: "Fundido suave", hint: "Disuelve el contenido sin corte oscuro." },
  { value: "slide_left", label: "Deslizar lateral", hint: "Empuja el siguiente elemento desde la derecha." },
  { value: "zoom", label: "Zoom suave", hint: "Entrada con pequena escala y opacidad." },
];

function BrandLogo({ className = "h-24 w-24" }) {
  return (
    <img
      src="/branding/area51-logo-transparent.png"
      alt="Area 51"
      className={`${className} object-contain`}
    />
  );
}

function SectionTitle({ eyebrow, title, description }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-300/80">
        {eyebrow}
      </p>
      <h2 className="mt-3 text-2xl font-semibold text-white">{title}</h2>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">{description}</p>
    </div>
  );
}

function StatCard({ label, value, hint }) {
  return (
    <article className="rounded-[1.75rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl">
      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-300/80">
        {label}
      </p>
      <p className="mt-4 line-clamp-2 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-400">{hint}</p>
    </article>
  );
}

function MediaPreview({ item }) {
  if (item.type === "image") {
    return (
      <img
        src={item.url}
        alt={item.name}
        className="h-48 w-full rounded-[1.2rem] bg-black object-cover"
        loading="lazy"
      />
    );
  }

  return (
    <video
      src={item.url}
      className="h-48 w-full rounded-[1.2rem] bg-black object-cover"
      muted
      playsInline
      preload="metadata"
    />
  );
}

function MusicArtwork({ track, className = "h-12 w-12" }) {
  if (track?.image) {
    return (
      <img
        src={track.image}
        alt=""
        className={`${className} flex-none rounded-xl bg-black object-cover`}
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

function MusicQueuePanel({
  musicQueue,
  musicSearchQuery,
  musicSearchResults,
  musicSearching,
  musicActionPending,
  onMusicSearchChange,
  onAddMusicTrack,
  onPlayNextMusicTrack,
  onPlayMusicTrackNow,
  onMoveMusicTrack,
  onDeleteMusicTrack,
}) {
  return (
    <article className="rounded-[2rem] border border-white/10 bg-[#07101f] p-6 shadow-soft">
      <SectionTitle
        eyebrow="Musica"
        title="Pedidos de canciones"
        description="Agrega canciones y controla el orden que vera la pantalla principal."
      />

      <label className="mt-6 block">
        <span className="mb-2 block text-sm font-medium text-slate-300">Buscar cancion</span>
        <input
          value={musicSearchQuery}
          onChange={(event) => onMusicSearchChange(event.target.value)}
          placeholder="Nombre de cancion o artista"
          className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition placeholder:text-slate-500 focus:border-emerald-400"
        />
      </label>

      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          onClick={onPlayNextMusicTrack}
          disabled={!musicQueue.length || Boolean(musicActionPending)}
          className="rounded-full bg-emerald-400 px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-slate-950 transition hover:bg-emerald-300 disabled:opacity-50"
        >
          Reproducir siguiente
        </button>
      </div>

      {musicSearching ? (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-slate-300">
          Buscando sugerencias...
        </div>
      ) : null}

      {musicSearchResults.length ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {musicSearchResults.map((track) => (
            <div
              key={track.uri}
              className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/5 p-3"
            >
              <MusicArtwork track={track} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{track.name}</p>
                <p className="truncate text-xs text-slate-400">{track.artists}</p>
              </div>
              <button
                type="button"
                onClick={() => onAddMusicTrack(track)}
                disabled={musicActionPending === track.uri}
                className="rounded-full bg-emerald-400 px-3 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-950 transition hover:bg-emerald-300 disabled:opacity-60"
              >
                {musicActionPending === track.uri ? "..." : "Agregar"}
              </button>
            </div>
          ))}
        </div>
      ) : null}

      <div className="mt-6 space-y-3">
        {musicQueue.length ? (
          musicQueue.map((track, index) => (
            <div
              key={track.queueId}
              className="flex min-w-0 items-center gap-4 rounded-2xl border border-white/10 bg-white/5 p-3"
            >
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-black/40 text-sm font-semibold text-emerald-200">
                {index + 1}
              </div>
              <MusicArtwork track={track} />
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{track.name}</p>
                <p className="truncate text-xs text-slate-400">{track.artists || "Spotify"}</p>
              </div>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => onPlayMusicTrackNow(track)}
                  disabled={Boolean(musicActionPending)}
                  className="rounded-full bg-emerald-400 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-slate-950 transition hover:bg-emerald-300 disabled:opacity-40"
                >
                  Reproducir
                </button>
                <button
                  type="button"
                  onClick={() => onMoveMusicTrack(track.queueId, -1)}
                  disabled={index === 0 || Boolean(musicActionPending)}
                  className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-white/10 disabled:opacity-40"
                >
                  Subir
                </button>
                <button
                  type="button"
                  onClick={() => onMoveMusicTrack(track.queueId, 1)}
                  disabled={index === musicQueue.length - 1 || Boolean(musicActionPending)}
                  className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-white transition hover:bg-white/10 disabled:opacity-40"
                >
                  Bajar
                </button>
                <button
                  type="button"
                  onClick={() => onDeleteMusicTrack(track.queueId)}
                  disabled={musicActionPending === track.queueId}
                  className="rounded-full border border-red-400/30 bg-red-500/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.12em] text-red-200 transition hover:bg-red-500/20 disabled:opacity-40"
                >
                  Eliminar
                </button>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/5 p-6 text-center text-sm text-slate-400">
            Todavia no hay canciones en la lista.
          </div>
        )}
      </div>
    </article>
  );
}

function LoginView({ onLogin, pending, error }) {
  const [form, setForm] = useState({ username: "", password: "" });

  return (
    <main className="min-h-screen bg-[#030712] px-4 py-8 text-white">
      <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-6xl overflow-hidden rounded-[2rem] border border-white/10 bg-[#07101f] shadow-soft lg:grid-cols-[1.18fr_0.82fr]">
        <section className="relative overflow-hidden p-10 md:p-14">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(16,185,129,0.14),transparent_26%),radial-gradient(circle_at_78%_18%,rgba(255,255,255,0.06),transparent_16%),linear-gradient(180deg,#09111f_0%,#020617_100%)]" />
          <div className="relative z-10">
            <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
              <BrandLogo className="h-28 w-28 md:h-40 md:w-40" />
              <div>
                <p className="text-xs uppercase tracking-[0.4em] text-emerald-300/80">
                  Licoreria Area 51
                </p>
                <h1 className="font-display text-5xl uppercase leading-none md:text-7xl">
                  DrinkScreen
                </h1>
                <p className="mt-3 text-sm uppercase tracking-[0.28em] text-slate-400">
                  Panel de operacion visual
                </p>
              </div>
            </div>

            <p className="mt-10 max-w-xl text-lg text-slate-300">
              Controla la pantalla del local, carga nuevo contenido y ajusta la reproduccion desde una sola interfaz.
            </p>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-emerald-300/70">
                  Carga directa
                </p>
                <p className="mt-3 text-sm text-slate-300">
                  Sube imagenes y videos desde el panel sin mover archivos manualmente.
                </p>
              </div>
              <div className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5">
                <p className="text-xs uppercase tracking-[0.24em] text-emerald-300/70">
                  Senal local
                </p>
                <p className="mt-3 text-sm text-slate-300">
                  Disenado para operar rapido dentro de la red del establecimiento.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="flex items-center bg-white px-8 py-10 text-slate-900 md:px-10">
          <div className="w-full">
            <p className="text-xs font-semibold uppercase tracking-[0.35em] text-emerald-700">
              Acceso privado
            </p>
            <h2 className="mt-4 text-4xl font-semibold">Iniciar sesion</h2>

            <form
              className="mt-8 space-y-5"
              onSubmit={(event) => {
                event.preventDefault();
                onLogin(form);
              }}
            >
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Usuario</span>
                <input
                  type="text"
                  value={form.username}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, username: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-500"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-700">Contrasena</span>
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, password: event.target.value }))
                  }
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 outline-none transition focus:border-emerald-500"
                />
              </label>

              {error ? <p className="text-sm text-red-700">{error}</p> : null}

              <button
                type="submit"
                disabled={pending}
                className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-950 px-4 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-slate-800 disabled:opacity-60"
              >
                {pending ? "Validando..." : "Entrar al panel"}
              </button>
            </form>
          </div>
        </section>
      </div>
    </main>
  );
}

function OrderList({
  playlist,
  dragPath,
  dragOverPath,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMove,
  savePending,
}) {
  return (
    <div className="mt-6 space-y-3">
      {playlist.length ? (
        playlist.map((item, index) => {
          const isDragging = dragPath === item.path;
          const isTarget = dragOverPath === item.path && dragPath !== item.path;

          return (
            <div
              key={item.path}
              draggable
              onDragStart={(event) => onDragStart(event, item.path)}
              onDragOver={(event) => onDragOver(event, item.path)}
              onDrop={(event) => onDrop(event, item.path)}
              onDragEnd={onDragEnd}
              className={`flex items-center gap-4 rounded-[1.35rem] border px-4 py-3 transition ${
                isDragging
                  ? "border-emerald-300/60 bg-emerald-300/10"
                  : isTarget
                    ? "border-emerald-300/40 bg-white/10"
                    : "border-white/10 bg-white/5"
              }`}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-black/40 text-xs font-semibold uppercase tracking-[0.18em] text-emerald-200">
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold text-white">{item.name}</p>
                <p className="mt-1 truncate text-xs uppercase tracking-[0.18em] text-slate-400">
                  {item.type === "image" ? "Imagen" : "Video"}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onMove(item.path, -1)}
                  disabled={savePending || index === 0}
                  className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/10 disabled:opacity-40"
                >
                  Subir
                </button>
                <button
                  type="button"
                  onClick={() => onMove(item.path, 1)}
                  disabled={savePending || index === playlist.length - 1}
                  className="rounded-full border border-white/10 px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/10 disabled:opacity-40"
                >
                  Bajar
                </button>
              </div>
            </div>
          );
        })
      ) : (
        <div className="rounded-[1.5rem] border border-dashed border-white/10 bg-white/5 p-6 text-center text-sm text-slate-400">
          Todavia no hay elementos para ordenar.
        </div>
      )}
    </div>
  );
}

function DashboardView({
  configForm,
  onFormChange,
  onRefresh,
  onSave,
  onLogout,
  onUpload,
  onDelete,
  onDragStart,
  onDragOver,
  onDrop,
  onDragEnd,
  onMoveItem,
  saving,
  uploadPending,
  deletePendingPath,
  saveOrderPending,
  dragPath,
  dragOverPath,
  message,
  messageType,
  playlist,
  health,
  spotifyStatus,
  musicQueue,
  musicSearchQuery,
  musicSearchResults,
  musicSearching,
  musicActionPending,
  onDisconnectSpotify,
  onMusicSearchChange,
  onAddMusicTrack,
  onPlayNextMusicTrack,
  onPlayMusicTrackNow,
  onMoveMusicTrack,
  onDeleteMusicTrack,
}) {
  const totalBytes = useMemo(
    () => playlist.reduce((sum, item) => sum + (item.size || 0), 0),
    [playlist]
  );
  const currentTransition =
    TRANSITION_OPTIONS.find((option) => option.value === configForm.transitionStyle) ||
    TRANSITION_OPTIONS[0];

  const isViteDevServer = window.location.port === "5173";
  const appOrigin = isViteDevServer
    ? window.location.origin
    : `${window.location.protocol}//${window.location.hostname}:${configForm.port || 8080}`;
  const tvUrl = `${appOrigin}/`;

  return (
    <main className="min-h-screen bg-[#030712] px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="overflow-hidden rounded-[2rem] border border-white/10 bg-[#07101f] shadow-soft">
          <div className="grid gap-8 p-8 lg:grid-cols-[1.2fr_0.8fr] lg:p-10">
            <div>
              <div className="flex flex-col items-start gap-6 md:flex-row md:items-center">
                <BrandLogo className="h-24 w-24 md:h-36 md:w-36" />
                <div>
                  <p className="text-xs uppercase tracking-[0.4em] text-emerald-300/80">
                    Licoreria Area 51
                  </p>
                  <h1 className="font-display text-5xl uppercase leading-none md:text-7xl">
                    DrinkScreen
                  </h1>
                  <p className="mt-3 text-sm uppercase tracking-[0.28em] text-slate-400">
                    Centro de senal y contenido
                  </p>
                </div>
              </div>

              <p className="mt-8 max-w-3xl text-base text-slate-300 md:text-lg">
                Centro de operacion para la pantalla del local. Desde aqui puedes subir contenido,
                reordenar el playlist y ajustar la transicion que vera el televisor.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <a
                  href="/"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-400/15"
                >
                  Abrir pantalla TV
                </a>
                <a
                  href="/music"
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-emerald-200 transition hover:bg-emerald-400/15"
                >
                  Abrir pedidos
                </a>
                <button
                  type="button"
                  onClick={onRefresh}
                  className="rounded-full border border-white/10 bg-white/5 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-white transition hover:bg-white/10"
                >
                  Actualizar
                </button>
                <button
                  type="button"
                  onClick={onLogout}
                  className="rounded-full border border-white/10 bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-slate-200"
                >
                  Cerrar sesion
                </button>
              </div>
            </div>

            <div className="rounded-[1.75rem] border border-white/10 bg-white/5 p-6">
              <SectionTitle
                eyebrow="Senal"
                title="URL del televisor"
                description="Abre esta direccion en el navegador del TV dentro de la misma red."
              />
              <div className="mt-6 rounded-[1.5rem] border border-emerald-400/20 bg-black/30 p-4">
                <p className="break-all text-lg font-semibold text-emerald-200">{tvUrl}</p>
              </div>
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                <StatCard label="Estado" value={health?.ok ? "Online" : "Offline"} hint="Servidor local" />
                <StatCard label="Playlist" value={playlist.length} hint="Elementos disponibles" />
              </div>
              <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-black/30 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-300/80">
                  Spotify
                </p>
                <p className="mt-2 text-sm text-slate-300">
                  {spotifyStatus?.connected
                    ? "Cuenta conectada para cola musical."
                    : spotifyStatus?.needsReconnect
                      ? `Permisos incompletos. Vuelve a conectar Spotify.`
                      : spotifyStatus?.configured
                      ? "Credenciales listas. Falta conectar la cuenta."
                      : "Faltan credenciales en .env."}
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <a
                    href="/spotify/login"
                    className="rounded-full bg-emerald-400 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-950 transition hover:bg-emerald-300"
                  >
                    Conectar Spotify
                  </a>
                  {spotifyStatus?.connected ? (
                    <button
                      type="button"
                      onClick={onDisconnectSpotify}
                      className="rounded-full border border-white/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-white transition hover:bg-white/10"
                    >
                      Desconectar
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          </div>
        </header>

        <section className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Peso total" value={formatBytes(totalBytes)} hint="Biblioteca actual" />
          <StatCard label="Refresh" value={`${configForm.refreshSeconds}s`} hint="Lectura de carpeta" />
          <StatCard label="Transicion" value={currentTransition.label} hint={currentTransition.hint} />
          <StatCard
            label="Imagenes"
            value={`${configForm.imageDurationSeconds}s`}
            hint="Tiempo visible por foto"
          />
        </section>

        <section className="mt-6">
          <MusicQueuePanel
            musicQueue={musicQueue}
            musicSearchQuery={musicSearchQuery}
            musicSearchResults={musicSearchResults}
            musicSearching={musicSearching}
            musicActionPending={musicActionPending}
            onMusicSearchChange={onMusicSearchChange}
            onAddMusicTrack={onAddMusicTrack}
            onPlayNextMusicTrack={onPlayNextMusicTrack}
            onPlayMusicTrackNow={onPlayMusicTrackNow}
            onMoveMusicTrack={onMoveMusicTrack}
            onDeleteMusicTrack={onDeleteMusicTrack}
          />
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <article className="rounded-[2rem] border border-white/10 bg-[#07101f] p-6 shadow-soft">
            <SectionTitle
              eyebrow="Carga de contenido"
              title="Subir imagenes y videos"
              description="Selecciona uno o varios archivos y el sistema los guardara en la carpeta configurada."
            />

            <form className="mt-6 space-y-4" onSubmit={onUpload}>
              <label className="flex min-h-44 cursor-pointer flex-col items-center justify-center rounded-[1.75rem] border border-dashed border-emerald-400/30 bg-white/5 p-6 text-center transition hover:bg-white/10">
                <BrandLogo className="mb-4 h-20 w-20 opacity-90" />
                <span className="text-sm font-semibold uppercase tracking-[0.24em] text-emerald-300/80">
                  Zona de carga
                </span>
                <span className="mt-3 max-w-sm text-sm text-slate-400">
                  Haz clic para elegir imagenes o videos. Se permiten cargas multiples en una sola operacion.
                </span>
                <input
                  id="video-upload"
                  name="videos"
                  type="file"
                  accept="image/*,video/*"
                  multiple
                  className="hidden"
                />
              </label>

              <button
                type="submit"
                disabled={uploadPending}
                className="rounded-full bg-emerald-400 px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-emerald-300 disabled:opacity-60"
              >
                {uploadPending ? "Subiendo..." : "Subir archivos"}
              </button>
            </form>
          </article>

          <article className="rounded-[2rem] border border-white/10 bg-[#07101f] p-6 shadow-soft">
            <SectionTitle
              eyebrow="Configuracion"
              title="Ajustes de reproduccion"
              description="Modifica puerto, carpeta observada, velocidad y estilo visual de la senal."
            />

            <form className="mt-6 grid gap-4 md:grid-cols-2" onSubmit={onSave}>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Host</span>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
                  value={configForm.host}
                  onChange={(event) => onFormChange("host", event.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Puerto</span>
                <input
                  type="number"
                  min="1"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
                  value={configForm.port}
                  onChange={(event) => onFormChange("port", Number(event.target.value))}
                />
              </label>
              <label className="block md:col-span-2">
                <span className="mb-2 block text-sm font-medium text-slate-300">Ruta de contenido</span>
                <input
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
                  value={configForm.videoDirectory}
                  onChange={(event) => onFormChange("videoDirectory", event.target.value)}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Refresh (segundos)</span>
                <input
                  type="number"
                  min="5"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
                  value={configForm.refreshSeconds}
                  onChange={(event) => onFormChange("refreshSeconds", Number(event.target.value))}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">Transicion (ms)</span>
                <input
                  type="number"
                  min="0"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
                  value={configForm.transitionMs}
                  onChange={(event) => onFormChange("transitionMs", Number(event.target.value))}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  Duracion de imagen (segundos)
                </span>
                <input
                  type="number"
                  min="1"
                  className="w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
                  value={configForm.imageDurationSeconds}
                  onChange={(event) => onFormChange("imageDurationSeconds", Number(event.target.value))}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-sm font-medium text-slate-300">
                  Tipo de transicion
                </span>
                <select
                  className="w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-white outline-none transition focus:border-emerald-400"
                  value={configForm.transitionStyle}
                  onChange={(event) => onFormChange("transitionStyle", event.target.value)}
                >
                  {TRANSITION_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <div className="md:col-span-2 rounded-[1.35rem] border border-white/10 bg-white/5 p-4 text-sm text-slate-400">
                <p className="font-semibold uppercase tracking-[0.2em] text-emerald-300/80">
                  Vista actual
                </p>
                <p className="mt-2 text-white">{currentTransition.label}</p>
                <p className="mt-1">{currentTransition.hint}</p>
              </div>
              <div className="flex flex-wrap items-center gap-4 pt-2 md:col-span-2">
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-full bg-white px-5 py-3 text-sm font-semibold uppercase tracking-[0.18em] text-slate-950 transition hover:bg-slate-200 disabled:opacity-60"
                >
                  {saving ? "Guardando..." : "Guardar cambios"}
                </button>
                {message ? (
                  <p
                    className={`text-sm ${
                      messageType === "success"
                        ? "text-emerald-300"
                        : messageType === "error"
                          ? "text-red-300"
                          : "text-slate-400"
                    }`}
                  >
                    {message}
                  </p>
                ) : null}
              </div>
            </form>
          </article>
        </section>

        <section className="mt-6 grid gap-6 xl:grid-cols-[0.78fr_1.22fr]">
          <article className="rounded-[2rem] border border-white/10 bg-[#07101f] p-6 shadow-soft">
            <SectionTitle
              eyebrow="Orden del playlist"
              title="Arrastra para reordenar"
              description="El primer elemento sera el primero en mostrarse. El orden se guarda automaticamente."
            />
            <OrderList
              playlist={playlist}
              dragPath={dragPath}
              dragOverPath={dragOverPath}
              onDragStart={onDragStart}
              onDragOver={onDragOver}
              onDrop={onDrop}
              onDragEnd={onDragEnd}
              onMove={onMoveItem}
              savePending={saveOrderPending}
            />
            <div className="mt-4 rounded-[1.35rem] border border-dashed border-white/10 bg-white/5 p-4 text-xs uppercase tracking-[0.18em] text-slate-400">
              Tambien puedes usar los botones Subir y Bajar si prefieres no arrastrar.
            </div>
          </article>

          <article className="rounded-[2rem] border border-white/10 bg-[#07101f] p-6 shadow-soft">
            <SectionTitle
              eyebrow="Biblioteca"
              title="Contenido disponible"
              description="Consulta imagenes y videos activos, con vista previa y opcion de eliminarlos."
            />

            <div className="mt-6 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
              {playlist.length ? (
                playlist.map((item, index) => (
                  <article
                    key={item.path}
                    className="rounded-[1.5rem] border border-white/10 bg-white/5 p-5"
                  >
                    <MediaPreview item={item} />
                    <div className="mt-4 flex items-center justify-between gap-3">
                      <p className="text-xs uppercase tracking-[0.24em] text-emerald-300/70">
                        Posicion {index + 1}
                      </p>
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                        {item.type === "image" ? "Imagen" : "Video"}
                      </p>
                    </div>
                    <h3 className="mt-4 line-clamp-2 text-lg font-semibold text-white">{item.name}</h3>
                    <p className="mt-2 break-all text-sm text-slate-400">{item.path}</p>
                    <div className="mt-5 flex items-center justify-between text-sm text-slate-400">
                      <span>{formatBytes(item.size || 0)}</span>
                      <span>{formatDate(item.modifiedAt)}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onDelete(item.path)}
                      disabled={deletePendingPath === item.path}
                      className="mt-5 rounded-full border border-red-400/30 bg-red-500/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.18em] text-red-200 transition hover:bg-red-500/20 disabled:opacity-60"
                    >
                      {deletePendingPath === item.path ? "Eliminando..." : "Eliminar"}
                    </button>
                  </article>
                ))
              ) : (
                <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-white/5 p-8 text-center text-slate-400 md:col-span-2 2xl:col-span-3">
                  No se encontraron imagenes ni videos en la carpeta configurada.
                </div>
              )}
            </div>
          </article>
        </section>
      </div>
    </main>
  );
}

export default function AdminApp() {
  const [session, setSession] = useState({ loading: true, authenticated: false });
  const [loginPending, setLoginPending] = useState(false);
  const [loginError, setLoginError] = useState("");
  const [dashboardError, setDashboardError] = useState("");
  const [saving, setSaving] = useState(false);
  const [uploadPending, setUploadPending] = useState(false);
  const [deletePendingPath, setDeletePendingPath] = useState("");
  const [saveOrderPending, setSaveOrderPending] = useState(false);
  const [dragPath, setDragPath] = useState("");
  const [dragOverPath, setDragOverPath] = useState("");
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState("info");
  const [health, setHealth] = useState(null);
  const [playlist, setPlaylist] = useState([]);
  const [spotifyStatus, setSpotifyStatus] = useState(null);
  const [musicQueue, setMusicQueue] = useState([]);
  const [musicSearchQuery, setMusicSearchQuery] = useState("");
  const [musicSearchResults, setMusicSearchResults] = useState([]);
  const [musicSearching, setMusicSearching] = useState(false);
  const [musicActionPending, setMusicActionPending] = useState("");
  const [configForm, setConfigForm] = useState(EMPTY_FORM);

  async function loadDashboard() {
    const [healthPayload, playlistPayload, configPayload, spotifyPayload, musicQueuePayload] = await Promise.all([
      fetchHealth(),
      fetchPlaylist(),
      fetchConfig(),
      fetchSpotifyStatus(),
      fetchMusicQueue(),
    ]);
    setHealth(healthPayload);
    setPlaylist(playlistPayload.videos || []);
    setSpotifyStatus(spotifyPayload);
    setMusicQueue(musicQueuePayload.queue || []);
    setConfigForm((current) => ({ ...current, ...(configPayload.config || EMPTY_FORM) }));
  }

  useEffect(() => {
    let active = true;
    const query = musicSearchQuery.trim();

    if (query.length < 2) {
      setMusicSearchResults([]);
      setMusicSearching(false);
      return undefined;
    }

    setMusicSearching(true);
    const timerId = window.setTimeout(async () => {
      try {
        const payload = await searchSpotifyTracks(query);
        if (active) {
          setMusicSearchResults(payload.tracks || []);
        }
      } catch (error) {
        if (active) {
          setMessage(error.message);
          setMessageType("error");
          setMusicSearchResults([]);
        }
      } finally {
        if (active) {
          setMusicSearching(false);
        }
      }
    }, 350);

    return () => {
      active = false;
      window.clearTimeout(timerId);
      setMusicSearching(false);
    };
  }, [musicSearchQuery]);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      try {
        const payload = await fetchSession();
        if (!mounted) {
          return;
        }

        if (payload.authenticated) {
          setSession({ loading: false, authenticated: true });
          try {
            await loadDashboard();
          } catch (error) {
            if (mounted) {
              setDashboardError(error.message);
            }
          }
        } else {
          setSession({ loading: false, authenticated: false });
        }
      } catch (error) {
        if (mounted) {
          setSession({ loading: false, authenticated: false });
        }
      }
    }

    bootstrap();

    return () => {
      mounted = false;
    };
  }, []);

  async function handleLogin(form) {
    setLoginPending(true);
    setLoginError("");

    try {
      await login(form);
      setSession({ loading: false, authenticated: true });
      await loadDashboard();
    } catch (error) {
      setLoginError(error.message);
    } finally {
      setLoginPending(false);
    }
  }

  async function handleLogout() {
    await logout();
    setSession({ loading: false, authenticated: false });
  }

  async function handleRefresh() {
    try {
      setDashboardError("");
      setMessage("");
      setMessageType("info");
      await loadDashboard();
    } catch (error) {
      setDashboardError(error.message);
    }
  }

  async function handleSave(event) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    setMessageType("info");

    try {
      const payload = await saveConfig(configForm);
      setConfigForm((current) => ({ ...current, ...(payload.config || EMPTY_FORM) }));
      setMessage("Configuracion guardada.");
      setMessageType("success");
      await loadDashboard();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setSaving(false);
    }
  }

  async function handleUpload(event) {
    event.preventDefault();
    const formElement = event.currentTarget;
    const input = formElement.elements.namedItem("videos");
    const files = input?.files;

    if (!files || !files.length) {
      setMessage("Selecciona al menos un archivo antes de subir.");
      setMessageType("error");
      return;
    }

    const formData = new FormData();
    Array.from(files).forEach((file) => {
      formData.append("videos", file);
    });

    setUploadPending(true);
    setMessage("");
    setMessageType("info");

    try {
      const payload = await uploadVideos(formData);
      setMessage(`Carga completada: ${payload.saved.join(", ")}`);
      setMessageType("success");
      formElement.reset();
      await loadDashboard();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setUploadPending(false);
    }
  }

  async function handleDelete(videoPath) {
    setDeletePendingPath(videoPath);
    setMessage("");
    setMessageType("info");

    try {
      await deleteVideo(videoPath);
      setMessage(`Archivo eliminado: ${videoPath}`);
      setMessageType("success");
      await loadDashboard();
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setDeletePendingPath("");
    }
  }

  async function persistPlaylistOrder(nextPlaylist, successMessage = "Orden del playlist guardado.") {
    setSaveOrderPending(true);
    setMessage("");
    setMessageType("info");

    try {
      await savePlaylistOrder(nextPlaylist.map((item) => item.path));
      setPlaylist(nextPlaylist);
      setMessage(successMessage);
      setMessageType("success");
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
      await loadDashboard();
    } finally {
      setSaveOrderPending(false);
      setDragPath("");
      setDragOverPath("");
    }
  }

  function moveItem(list, fromIndex, toIndex) {
    if (
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= list.length ||
      toIndex >= list.length ||
      fromIndex === toIndex
    ) {
      return list;
    }

    const next = [...list];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
  }

  function handleDragStart(event, path) {
    if (saveOrderPending) {
      return;
    }
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", path);
    setDragPath(path);
    setDragOverPath(path);
  }

  function handleDragOver(event, path) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    if (!dragPath || dragPath === path) {
      return;
    }
    setDragOverPath(path);
  }

  async function handleDrop(event, targetPath) {
    event.preventDefault();
    if (!dragPath || dragPath === targetPath) {
      setDragPath("");
      setDragOverPath("");
      return;
    }

    const fromIndex = playlist.findIndex((item) => item.path === dragPath);
    const toIndex = playlist.findIndex((item) => item.path === targetPath);
    const nextPlaylist = moveItem(playlist, fromIndex, toIndex);
    setPlaylist(nextPlaylist);
    await persistPlaylistOrder(nextPlaylist, "Orden actualizado.");
  }

  function handleDragEnd() {
    setDragPath("");
    setDragOverPath("");
  }

  async function handleMoveItem(path, direction) {
    const currentIndex = playlist.findIndex((item) => item.path === path);
    const nextPlaylist = moveItem(playlist, currentIndex, currentIndex + direction);
    if (nextPlaylist === playlist) {
      return;
    }
    setPlaylist(nextPlaylist);
    await persistPlaylistOrder(nextPlaylist, "Orden actualizado.");
  }

  function handleFormChange(field, value) {
    setConfigForm((current) => ({ ...current, [field]: value }));
  }

  async function handleDisconnectSpotify() {
    try {
      await disconnectSpotify();
      await loadDashboard();
      setMessage("Spotify desconectado.");
      setMessageType("success");
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    }
  }

  async function handleAddMusicTrack(track) {
    setMusicActionPending(track.uri);
    setMessage("");
    setMessageType("info");

    try {
      const payload = await addTrackToMusicQueue(track);
      setMusicQueue(payload.queue || []);
      setMusicSearchQuery("");
      setMusicSearchResults([]);
      setMessage(`Cancion agregada: ${track.name}`);
      setMessageType("success");
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setMusicActionPending("");
    }
  }

  async function persistMusicQueue(nextQueue) {
    setMusicActionPending("music-order");
    setMessage("");
    setMessageType("info");

    try {
      const payload = await saveMusicQueueOrder(nextQueue.map((track) => track.queueId));
      setMusicQueue(payload.queue || []);
      setMessage("Orden de canciones actualizado.");
      setMessageType("success");
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
      await loadDashboard();
    } finally {
      setMusicActionPending("");
    }
  }

  async function handleMoveMusicTrack(queueId, direction) {
    const currentIndex = musicQueue.findIndex((track) => track.queueId === queueId);
    const nextQueue = moveItem(musicQueue, currentIndex, currentIndex + direction);
    if (nextQueue === musicQueue) {
      return;
    }
    setMusicQueue(nextQueue);
    await persistMusicQueue(nextQueue);
  }

  async function handleDeleteMusicTrack(queueId) {
    setMusicActionPending(queueId);
    setMessage("");
    setMessageType("info");

    try {
      const payload = await deleteMusicQueueTrack(queueId);
      setMusicQueue(payload.queue || []);
      setMessage("Cancion eliminada de la lista.");
      setMessageType("success");
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setMusicActionPending("");
    }
  }

  async function handlePlayNextMusicTrack() {
    setMusicActionPending("play-next");
    setMessage("");
    setMessageType("info");

    try {
      const payload = await playNextMusicQueueTrack();
      setMusicQueue(payload.queue || []);
      setMessage(`Reproduciendo siguiente: ${payload.track?.name || "cancion"}`);
      setMessageType("success");
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setMusicActionPending("");
    }
  }

  async function handlePlayMusicTrackNow(track) {
    setMusicActionPending(track.queueId || track.uri);
    setMessage("");
    setMessageType("info");

    try {
      await playMusicTrackNow(track.uri);
      const payload = await deleteMusicQueueTrack(track.queueId);
      setMusicQueue(payload.queue || []);
      setMessage(`Reproduciendo ahora: ${track.name}`);
      setMessageType("success");
    } catch (error) {
      setMessage(error.message);
      setMessageType("error");
    } finally {
      setMusicActionPending("");
    }
  }

  if (session.loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#030712]">
        <div className="rounded-full border border-white/10 bg-white/5 px-6 py-3 text-sm font-semibold uppercase tracking-[0.24em] text-emerald-300 shadow-soft">
          Cargando panel...
        </div>
      </main>
    );
  }

  if (!session.authenticated) {
    return <LoginView onLogin={handleLogin} pending={loginPending} error={loginError} />;
  }

  return (
    <>
      {dashboardError ? (
        <div className="fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-red-700 px-5 py-3 text-sm font-medium text-white shadow-soft">
          {dashboardError}
        </div>
      ) : null}
      <DashboardView
        configForm={configForm}
        onFormChange={handleFormChange}
        onRefresh={handleRefresh}
        onSave={handleSave}
        onLogout={handleLogout}
        onUpload={handleUpload}
        onDelete={handleDelete}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDrop={handleDrop}
        onDragEnd={handleDragEnd}
        onMoveItem={handleMoveItem}
        saving={saving}
        uploadPending={uploadPending}
        deletePendingPath={deletePendingPath}
        saveOrderPending={saveOrderPending}
        dragPath={dragPath}
        dragOverPath={dragOverPath}
        message={message}
        messageType={messageType}
        playlist={playlist}
        health={health}
        spotifyStatus={spotifyStatus}
        musicQueue={musicQueue}
        musicSearchQuery={musicSearchQuery}
        musicSearchResults={musicSearchResults}
        musicSearching={musicSearching}
        musicActionPending={musicActionPending}
        onDisconnectSpotify={handleDisconnectSpotify}
        onMusicSearchChange={setMusicSearchQuery}
        onAddMusicTrack={handleAddMusicTrack}
        onPlayNextMusicTrack={handlePlayNextMusicTrack}
        onPlayMusicTrackNow={handlePlayMusicTrackNow}
        onMoveMusicTrack={handleMoveMusicTrack}
        onDeleteMusicTrack={handleDeleteMusicTrack}
      />
    </>
  );
}
