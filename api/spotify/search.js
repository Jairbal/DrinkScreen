function sendJson(response, statusCode, payload) {
  response.status(statusCode).json(payload);
}

function serializeSpotifyImage(images = []) {
  return images.find((image) => image?.url)?.url || "";
}

function serializeSpotifyItem(item) {
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    uri: item.uri,
    name: item.name,
    type: item.type,
    artists: Array.isArray(item.artists)
      ? item.artists.map((artist) => artist.name).join(", ")
      : "",
    album: item.album?.name || "",
    image: serializeSpotifyImage(item.album?.images || []),
    durationMs: item.duration_ms || 0,
    explicit: Boolean(item.explicit),
    externalUrl: item.external_urls?.spotify || "",
  };
}

async function readSpotifyResponse(response) {
  const text = await response.text();
  let payload = {};

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch (error) {
      payload = { raw: text };
    }
  }

  if (!response.ok) {
    throw new Error(
      payload?.error?.message ||
        payload?.error_description ||
        payload?.raw ||
        "Spotify no pudo procesar la solicitud"
    );
  }

  return payload;
}

async function getAppAccessToken() {
  const clientId = process.env.SPOTIFY_CLIENT_ID || "";
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET || "";

  if (!clientId || !clientSecret) {
    throw new Error("Faltan SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET");
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString("base64")}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({ grant_type: "client_credentials" }).toString(),
  });

  const payload = await readSpotifyResponse(response);
  return payload.access_token;
}

module.exports = async function handler(request, response) {
  if (request.method !== "GET") {
    sendJson(response, 405, { ok: false, message: "Metodo no permitido" });
    return;
  }

  const query = String(request.query.q || "").trim();
  if (query.length < 2) {
    sendJson(response, 400, {
      ok: false,
      message: "Escribe al menos 2 caracteres para buscar",
    });
    return;
  }

  try {
    const accessToken = await getAppAccessToken();
    const params = new URLSearchParams({
      q: query.slice(0, 80),
      type: "track",
      limit: "8",
    });
    const spotifyResponse = await fetch(
      `https://api.spotify.com/v1/search?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );
    const payload = await readSpotifyResponse(spotifyResponse);
    sendJson(response, 200, {
      ok: true,
      tracks: (payload.tracks?.items || []).map(serializeSpotifyItem).filter(Boolean),
    });
  } catch (error) {
    sendJson(response, 500, {
      ok: false,
      message: error.message || "No se pudo buscar en Spotify",
    });
  }
};
