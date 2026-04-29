async function readJson(response) {
  const payload = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(payload?.message || `La API no respondio correctamente (${response.status})`);
  }
  if (!payload) {
    throw new Error("La API no devolvio una respuesta valida. Revisa que el servidor este iniciado.");
  }
  return payload;
}

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "";
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || "";
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || "";
const MUSIC_QUEUE_TABLE = import.meta.env.VITE_SUPABASE_MUSIC_QUEUE_TABLE || "music_queue";

function apiUrl(path) {
  return `${API_BASE_URL}${path}`;
}

function websocketUrl(path) {
  const baseUrl = API_BASE_URL
    ? new URL(API_BASE_URL, window.location.origin)
    : new URL(window.location.origin);
  baseUrl.protocol = baseUrl.protocol === "https:" ? "wss:" : "ws:";
  baseUrl.pathname = path;
  baseUrl.search = "";
  baseUrl.hash = "";
  return baseUrl.toString();
}

function hasSupabaseRequestInbox() {
  const isPublicMusicPage =
    window.location.pathname === "/music" || window.location.pathname === "/music.html";
  return Boolean(isPublicMusicPage && !API_BASE_URL && SUPABASE_URL && SUPABASE_ANON_KEY);
}

function supabaseUrl(path) {
  return `${SUPABASE_URL.replace(/\/+$/, "")}/rest/v1/${path}`;
}

function supabaseHeaders(extra = {}) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    ...extra,
  };
}

function toQueueTrack(row) {
  return {
    queueId: row.queue_id,
    addedAt: row.added_at,
    id: row.spotify_id,
    uri: row.uri,
    name: row.name,
    artists: row.artists,
    album: row.album,
    image: row.image,
    durationMs: row.duration_ms || 0,
    externalUrl: row.external_url || "",
  };
}

function toQueueRow(track) {
  const now = new Date().toISOString();
  return {
    queue_id: track.queueId || crypto.randomUUID(),
    added_at: track.addedAt || now,
    spotify_id: track.id || track.uri?.split(":").pop() || "",
    uri: track.uri,
    name: track.name || "Cancion de Spotify",
    artists: track.artists || "",
    album: track.album || "",
    image: track.image || "",
    duration_ms: Number(track.durationMs) || 0,
    external_url: track.externalUrl || "",
    position: Date.now(),
  };
}

export function subscribeToServerEvents(onEvent, options = {}) {
  if (options.disabled) {
    return () => {};
  }

  let socket = null;
  let closedByClient = false;
  let reconnectTimer = null;
  let reconnectDelay = 700;

  function connect() {
    socket = new WebSocket(websocketUrl("/ws"));

    socket.addEventListener("open", () => {
      reconnectDelay = 700;
      options.onOpen?.();
    });

    socket.addEventListener("message", (event) => {
      try {
        onEvent(JSON.parse(event.data));
      } catch (error) {
        // Ignore malformed realtime messages and keep the socket alive.
      }
    });

    socket.addEventListener("close", () => {
      options.onClose?.();
      if (closedByClient) {
        return;
      }

      reconnectTimer = window.setTimeout(connect, reconnectDelay);
      reconnectDelay = Math.min(reconnectDelay * 1.6, 5000);
    });
  }

  connect();

  return () => {
    closedByClient = true;
    if (reconnectTimer) {
      window.clearTimeout(reconnectTimer);
    }
    if (socket) {
      socket.close();
    }
  };
}

export async function fetchPlaylist() {
  return readJson(await fetch(apiUrl("/api/videos"), { cache: "no-store" }));
}

export async function fetchHealth() {
  return readJson(await fetch(apiUrl("/api/health"), { cache: "no-store" }));
}

export async function fetchConfig() {
  return readJson(
    await fetch(apiUrl("/api/config"), { cache: "no-store", credentials: "include" })
  );
}

export async function saveConfig(payload) {
  return readJson(
    await fetch(apiUrl("/api/config"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    })
  );
}

export async function fetchSession() {
  return readJson(
    await fetch(apiUrl("/api/auth/session"), { cache: "no-store", credentials: "include" })
  );
}

export async function login(payload) {
  return readJson(
    await fetch(apiUrl("/api/auth/login"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    })
  );
}

export async function logout() {
  return readJson(
    await fetch(apiUrl("/api/auth/logout"), {
      method: "POST",
      credentials: "include",
    })
  );
}

export async function uploadVideos(formData) {
  return readJson(
    await fetch(apiUrl("/api/videos/upload"), {
      method: "POST",
      body: formData,
      credentials: "include",
    })
  );
}

export async function deleteVideo(videoPath) {
  return readJson(
    await fetch(apiUrl("/api/videos/delete"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: videoPath }),
      credentials: "include",
    })
  );
}

export async function savePlaylistOrder(orderedPaths) {
  return readJson(
    await fetch(apiUrl("/api/playlist/order"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedPaths }),
      credentials: "include",
    })
  );
}

export async function fetchSpotifyStatus() {
  return readJson(await fetch(apiUrl("/api/spotify/status"), { cache: "no-store" }));
}

export async function fetchSpotifyQueue() {
  return readJson(await fetch(apiUrl("/api/spotify/queue"), { cache: "no-store" }));
}

export async function searchSpotifyTracks(query) {
  return readJson(
    await fetch(apiUrl(`/api/spotify/search?q=${encodeURIComponent(query)}`), {
      cache: "no-store",
    })
  );
}

export async function addSpotifyTrackToQueue(uri) {
  return readJson(
    await fetch(apiUrl("/api/spotify/queue"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uri }),
    })
  );
}

export async function fetchMusicQueue() {
  if (hasSupabaseRequestInbox()) {
    const rows = await readJson(
      await fetch(supabaseUrl(`${MUSIC_QUEUE_TABLE}?select=*&order=position.asc,added_at.asc`), {
        cache: "no-store",
        headers: supabaseHeaders(),
      })
    );
    return { ok: true, queue: rows.map(toQueueTrack), source: "supabase-request-inbox" };
  }

  return readJson(await fetch(apiUrl("/api/music-queue"), { cache: "no-store" }));
}

export async function addTrackToMusicQueue(track) {
  if (hasSupabaseRequestInbox()) {
    const row = toQueueRow(track);
    await readJson(
      await fetch(supabaseUrl(MUSIC_QUEUE_TABLE), {
        method: "POST",
        headers: supabaseHeaders({
          "Content-Type": "application/json",
          Prefer: "return=representation",
        }),
        body: JSON.stringify(row),
      })
    );
    return fetchMusicQueue();
  }

  return readJson(
    await fetch(apiUrl("/api/music-queue"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track }),
    })
  );
}

export async function saveMusicQueueOrder(orderedIds) {
  return readJson(
    await fetch(apiUrl("/api/music-queue/order"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
      credentials: "include",
    })
  );
}

export async function deleteMusicQueueTrack(queueId) {
  return readJson(
    await fetch(apiUrl("/api/music-queue/delete"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queueId }),
      credentials: "include",
    })
  );
}

export async function playNextMusicQueueTrack() {
  return readJson(
    await fetch(apiUrl("/api/music-queue/play-next"), {
      method: "POST",
      credentials: "include",
    })
  );
}

export async function playMusicTrackNow(uri) {
  return readJson(
    await fetch(apiUrl("/api/music-queue/play-now"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uri }),
      credentials: "include",
    })
  );
}

export async function skipCurrentSpotifyTrack() {
  return readJson(
    await fetch(apiUrl("/api/spotify/skip"), {
      method: "POST",
      credentials: "include",
    })
  );
}

export async function disconnectSpotify() {
  return readJson(
    await fetch(apiUrl("/api/spotify/disconnect"), {
      method: "POST",
      credentials: "include",
    })
  );
}
