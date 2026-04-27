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

export async function fetchPlaylist() {
  return readJson(await fetch("/api/videos", { cache: "no-store" }));
}

export async function fetchHealth() {
  return readJson(await fetch("/api/health", { cache: "no-store" }));
}

export async function fetchConfig() {
  return readJson(
    await fetch("/api/config", { cache: "no-store", credentials: "include" })
  );
}

export async function saveConfig(payload) {
  return readJson(
    await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    })
  );
}

export async function fetchSession() {
  return readJson(
    await fetch("/api/auth/session", { cache: "no-store", credentials: "include" })
  );
}

export async function login(payload) {
  return readJson(
    await fetch("/api/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      credentials: "include",
    })
  );
}

export async function logout() {
  return readJson(
    await fetch("/api/auth/logout", {
      method: "POST",
      credentials: "include",
    })
  );
}

export async function uploadVideos(formData) {
  return readJson(
    await fetch("/api/videos/upload", {
      method: "POST",
      body: formData,
      credentials: "include",
    })
  );
}

export async function deleteVideo(videoPath) {
  return readJson(
    await fetch("/api/videos/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path: videoPath }),
      credentials: "include",
    })
  );
}

export async function savePlaylistOrder(orderedPaths) {
  return readJson(
    await fetch("/api/playlist/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedPaths }),
      credentials: "include",
    })
  );
}

export async function fetchSpotifyStatus() {
  return readJson(await fetch("/api/spotify/status", { cache: "no-store" }));
}

export async function fetchSpotifyQueue() {
  return readJson(await fetch("/api/spotify/queue", { cache: "no-store" }));
}

export async function searchSpotifyTracks(query) {
  return readJson(
    await fetch(`/api/spotify/search?q=${encodeURIComponent(query)}`, {
      cache: "no-store",
    })
  );
}

export async function addSpotifyTrackToQueue(uri) {
  return readJson(
    await fetch("/api/spotify/queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uri }),
    })
  );
}

export async function fetchMusicQueue() {
  return readJson(await fetch("/api/music-queue", { cache: "no-store" }));
}

export async function addTrackToMusicQueue(track) {
  return readJson(
    await fetch("/api/music-queue", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ track }),
    })
  );
}

export async function saveMusicQueueOrder(orderedIds) {
  return readJson(
    await fetch("/api/music-queue/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderedIds }),
      credentials: "include",
    })
  );
}

export async function deleteMusicQueueTrack(queueId) {
  return readJson(
    await fetch("/api/music-queue/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ queueId }),
      credentials: "include",
    })
  );
}

export async function playNextMusicQueueTrack() {
  return readJson(
    await fetch("/api/music-queue/play-next", {
      method: "POST",
      credentials: "include",
    })
  );
}

export async function playMusicTrackNow(uri) {
  return readJson(
    await fetch("/api/music-queue/play-now", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ uri }),
      credentials: "include",
    })
  );
}

export async function disconnectSpotify() {
  return readJson(
    await fetch("/api/spotify/disconnect", {
      method: "POST",
      credentials: "include",
    })
  );
}
