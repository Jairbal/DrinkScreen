const http = require("http");
const fs = require("fs");
const crypto = require("crypto");
const path = require("path");
const { URL } = require("url");

const ROOT_DIR = __dirname;
const DIST_DIR = path.join(ROOT_DIR, "dist");
const ENV_PATH = path.join(ROOT_DIR, ".env");
const MEDIA_ORDER_PATH = path.join(ROOT_DIR, "media-order.json");
const MUSIC_QUEUE_PATH = path.join(ROOT_DIR, "music-queue.json");
const SPOTIFY_TOKEN_PATH = path.join(ROOT_DIR, ".spotify-token.json");
const SPOTIFY_SCOPES = [
  "user-read-playback-state",
  "user-read-currently-playing",
  "user-modify-playback-state",
].join(" ");
const REQUIRED_SPOTIFY_SCOPES = new Set(SPOTIFY_SCOPES.split(" "));
const DEFAULT_CONFIG = {
  host: "0.0.0.0",
  port: 8080,
  videoDirectory: "./videos",
  refreshSeconds: 30,
  transitionMs: 1200,
  imageDurationSeconds: 8,
  transitionStyle: "fade_black",
};
const VIDEO_EXTENSIONS = new Set([".mp4", ".webm", ".ogg", ".mov", ".m4v"]);
const IMAGE_EXTENSIONS = new Set([".jpg", ".jpeg", ".png", ".webp", ".gif"]);
let spotifyAppToken = null;
loadEnvFile();

function loadEnvFile() {
  if (!fs.existsSync(ENV_PATH)) {
    return;
  }

  const content = fs.readFileSync(ENV_PATH, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    let value = trimmed.slice(separatorIndex + 1).trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function readConfig() {
  const configPath = path.join(ROOT_DIR, "config.json");
  let fileConfig = {};

  if (fs.existsSync(configPath)) {
    try {
      fileConfig = JSON.parse(fs.readFileSync(configPath, "utf8"));
    } catch (error) {
      console.error("No se pudo leer config.json:", error.message);
    }
  }

  const config = { ...DEFAULT_CONFIG, ...fileConfig };
  config.port = Number(process.env.PORT || config.port || DEFAULT_CONFIG.port);
  config.host = process.env.HOST || config.host || DEFAULT_CONFIG.host;
  config.refreshSeconds = Number(
    process.env.REFRESH_SECONDS || config.refreshSeconds || DEFAULT_CONFIG.refreshSeconds
  );
  config.transitionMs = Number(
    process.env.TRANSITION_MS || config.transitionMs || DEFAULT_CONFIG.transitionMs
  );
  config.imageDurationSeconds = Number(
    process.env.IMAGE_DURATION_SECONDS ||
      config.imageDurationSeconds ||
      DEFAULT_CONFIG.imageDurationSeconds
  );
  config.transitionStyle =
    process.env.TRANSITION_STYLE || config.transitionStyle || DEFAULT_CONFIG.transitionStyle;

  const configuredVideoDirectory =
    process.env.VIDEO_DIR || config.videoDirectory || DEFAULT_CONFIG.videoDirectory;

  config.videoDirectory = path.isAbsolute(configuredVideoDirectory)
    ? configuredVideoDirectory
    : path.resolve(ROOT_DIR, configuredVideoDirectory);

  return config;
}

function sanitizeConfig(input = {}) {
  const baseConfig = readConfig();
  const nextConfig = {
    host: typeof input.host === "string" && input.host.trim() ? input.host.trim() : baseConfig.host,
    port: Number(input.port) || baseConfig.port,
    videoDirectory:
      typeof input.videoDirectory === "string" && input.videoDirectory.trim()
        ? input.videoDirectory.trim()
        : baseConfig.videoDirectory,
    refreshSeconds: Number(input.refreshSeconds) || baseConfig.refreshSeconds,
    transitionMs: Number(input.transitionMs) || baseConfig.transitionMs,
    imageDurationSeconds: Number(input.imageDurationSeconds) || baseConfig.imageDurationSeconds,
    transitionStyle:
      typeof input.transitionStyle === "string" && input.transitionStyle.trim()
        ? input.transitionStyle.trim()
        : baseConfig.transitionStyle,
  };

  return {
    host: nextConfig.host,
    port: Math.max(1, nextConfig.port),
    videoDirectory: nextConfig.videoDirectory,
    refreshSeconds: Math.max(5, nextConfig.refreshSeconds),
    transitionMs: Math.max(0, nextConfig.transitionMs),
    imageDurationSeconds: Math.max(1, nextConfig.imageDurationSeconds),
    transitionStyle: nextConfig.transitionStyle,
  };
}

function writeConfig(input) {
  const configPath = path.join(ROOT_DIR, "config.json");
  const nextConfig = sanitizeConfig(input);
  fs.writeFileSync(configPath, `${JSON.stringify(nextConfig, null, 2)}\n`, "utf8");
  return readConfig();
}

function getAdminCredentials() {
  return {
    username: process.env.ADMIN_USERNAME || "",
    password: process.env.ADMIN_PASSWORD || "",
    sessionSecret: process.env.SESSION_SECRET || "drinkscreen-dev-secret",
  };
}

function readMediaOrder() {
  if (!fs.existsSync(MEDIA_ORDER_PATH)) {
    return [];
  }

  try {
    const payload = JSON.parse(fs.readFileSync(MEDIA_ORDER_PATH, "utf8"));
    return Array.isArray(payload.orderedPaths) ? payload.orderedPaths : [];
  } catch (error) {
    return [];
  }
}

function getSpotifyCredentials(request) {
  const host = request?.headers?.host || `localhost:${readConfig().port}`;
  return {
    clientId: process.env.SPOTIFY_CLIENT_ID || "",
    clientSecret: process.env.SPOTIFY_CLIENT_SECRET || "",
    redirectUri:
      process.env.SPOTIFY_REDIRECT_URI || `http://${host}/spotify/callback`,
    deviceId: process.env.SPOTIFY_DEVICE_ID || "",
  };
}

function readSpotifyToken() {
  if (!fs.existsSync(SPOTIFY_TOKEN_PATH)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(SPOTIFY_TOKEN_PATH, "utf8"));
  } catch (error) {
    return null;
  }
}

function getSpotifyTokenScopes(token) {
  return new Set(String(token?.scope || "").split(/\s+/).filter(Boolean));
}

function getMissingSpotifyScopes(token) {
  const tokenScopes = getSpotifyTokenScopes(token);
  return Array.from(REQUIRED_SPOTIFY_SCOPES).filter((scope) => !tokenScopes.has(scope));
}

function writeSpotifyToken(token) {
  fs.writeFileSync(SPOTIFY_TOKEN_PATH, `${JSON.stringify(token, null, 2)}\n`, "utf8");
}

function clearSpotifyToken() {
  if (fs.existsSync(SPOTIFY_TOKEN_PATH)) {
    fs.unlinkSync(SPOTIFY_TOKEN_PATH);
  }
}

function encodeForm(payload) {
  return new URLSearchParams(payload).toString();
}

function createBasicAuth(clientId, clientSecret) {
  return Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
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
    const message =
      payload?.error?.message ||
      payload?.error_description ||
      payload?.raw ||
      "Spotify no pudo procesar la solicitud";
    const error = new Error(message);
    error.statusCode = response.status;
    throw error;
  }

  return payload;
}

async function exchangeSpotifyCode(request, code) {
  const credentials = getSpotifyCredentials(request);
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${createBasicAuth(credentials.clientId, credentials.clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encodeForm({
      grant_type: "authorization_code",
      code,
      redirect_uri: credentials.redirectUri,
    }),
  });
  const payload = await readSpotifyResponse(response);
  writeSpotifyToken({
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token,
    scope: payload.scope,
    expiresAt: Date.now() + Math.max(0, payload.expires_in - 60) * 1000,
  });
}

async function refreshSpotifyToken(request, token) {
  const credentials = getSpotifyCredentials(request);
  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${createBasicAuth(credentials.clientId, credentials.clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encodeForm({
      grant_type: "refresh_token",
      refresh_token: token.refreshToken,
    }),
  });
  const payload = await readSpotifyResponse(response);
  const nextToken = {
    ...token,
    accessToken: payload.access_token,
    refreshToken: payload.refresh_token || token.refreshToken,
    scope: payload.scope || token.scope,
    expiresAt: Date.now() + Math.max(0, payload.expires_in - 60) * 1000,
  };
  writeSpotifyToken(nextToken);
  return nextToken;
}

async function getSpotifyAccessToken(request) {
  const credentials = getSpotifyCredentials(request);
  if (!credentials.clientId || !credentials.clientSecret) {
    const error = new Error("Configura SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET en .env");
    error.statusCode = 500;
    throw error;
  }

  const token = readSpotifyToken();
  if (!token?.accessToken || !token?.refreshToken) {
    const error = new Error("Conecta DrinkScreen con Spotify desde el panel de administracion");
    error.statusCode = 401;
    throw error;
  }

  const missingScopes = getMissingSpotifyScopes(token);
  if (missingScopes.length) {
    const error = new Error(
      `Permisos de Spotify incompletos. Desconecta y vuelve a conectar la cuenta. Faltan: ${missingScopes.join(", ")}`
    );
    error.statusCode = 401;
    throw error;
  }

  if (Date.now() >= Number(token.expiresAt || 0)) {
    const refreshed = await refreshSpotifyToken(request, token);
    return refreshed.accessToken;
  }

  return token.accessToken;
}

async function spotifyApi(request, endpoint, options = {}) {
  const accessToken = await getSpotifyAccessToken(request);
  const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });
  return readSpotifyResponse(response);
}

async function getSpotifyAppAccessToken(request) {
  const credentials = getSpotifyCredentials(request);
  if (!credentials.clientId || !credentials.clientSecret) {
    const error = new Error("Configura SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET en .env");
    error.statusCode = 500;
    throw error;
  }

  if (spotifyAppToken?.accessToken && Date.now() < Number(spotifyAppToken.expiresAt || 0)) {
    return spotifyAppToken.accessToken;
  }

  const response = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${createBasicAuth(credentials.clientId, credentials.clientSecret)}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: encodeForm({
      grant_type: "client_credentials",
    }),
  });
  const payload = await readSpotifyResponse(response);
  spotifyAppToken = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + Math.max(0, payload.expires_in - 60) * 1000,
  };
  return spotifyAppToken.accessToken;
}

async function spotifyAppApi(request, endpoint, options = {}) {
  const accessToken = await getSpotifyAppAccessToken(request);
  const response = await fetch(`https://api.spotify.com/v1${endpoint}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(options.headers || {}),
    },
  });
  return readSpotifyResponse(response);
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
      : item.show?.name || "",
    album: item.album?.name || "",
    image: serializeSpotifyImage(item.album?.images || item.images || []),
    durationMs: item.duration_ms || 0,
    explicit: Boolean(item.explicit),
    externalUrl: item.external_urls?.spotify || "",
  };
}

async function sendSpotifyError(response, error) {
  sendJson(response, error.statusCode || 500, {
    ok: false,
    message: error.message || "Error de Spotify",
  });
}

function writeMediaOrder(orderedPaths) {
  fs.writeFileSync(
    MEDIA_ORDER_PATH,
    `${JSON.stringify({ orderedPaths }, null, 2)}\n`,
    "utf8"
  );
}

function readMusicQueue() {
  if (!fs.existsSync(MUSIC_QUEUE_PATH)) {
    return [];
  }

  try {
    const payload = JSON.parse(fs.readFileSync(MUSIC_QUEUE_PATH, "utf8"));
    return Array.isArray(payload.queue) ? payload.queue : [];
  } catch (error) {
    return [];
  }
}

function writeMusicQueue(queue) {
  fs.writeFileSync(MUSIC_QUEUE_PATH, `${JSON.stringify({ queue }, null, 2)}\n`, "utf8");
}

function sanitizeMusicTrack(input = {}) {
  const uri = typeof input.uri === "string" ? input.uri : "";
  if (!/^spotify:track:[A-Za-z0-9]+$/.test(uri)) {
    return null;
  }

  return {
    queueId: crypto.randomUUID(),
    addedAt: new Date().toISOString(),
    id: typeof input.id === "string" ? input.id : uri.split(":").pop(),
    uri,
    name: typeof input.name === "string" && input.name.trim() ? input.name.trim() : "Cancion de Spotify",
    artists: typeof input.artists === "string" ? input.artists.trim() : "",
    album: typeof input.album === "string" ? input.album.trim() : "",
    image: typeof input.image === "string" ? input.image : "",
    durationMs: Number(input.durationMs) || 0,
    externalUrl: typeof input.externalUrl === "string" ? input.externalUrl : "",
  };
}

function parseSpotifyTrackUri(value) {
  const input = String(value || "").trim();
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

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".html": "text/html; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".mp4": "video/mp4",
    ".webm": "video/webm",
    ".ogg": "video/ogg",
    ".mov": "video/quicktime",
    ".m4v": "video/x-m4v",
  };

  return contentTypes[extension] || "application/octet-stream";
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    ...extraHeaders,
  });
  response.end(JSON.stringify(payload));
}

function sendHtml(response, html) {
  response.writeHead(200, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-cache",
  });
  response.end(html);
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => {
      chunks.push(chunk);
    });

    request.on("end", () => {
      try {
        const rawBody = Buffer.concat(chunks).toString("utf8");
        resolve(rawBody ? JSON.parse(rawBody) : {});
      } catch (error) {
        reject(error);
      }
    });

    request.on("error", reject);
  });
}

function readRawBody(request) {
  return new Promise((resolve, reject) => {
    const chunks = [];

    request.on("data", (chunk) => {
      chunks.push(chunk);
    });

    request.on("end", () => {
      resolve(Buffer.concat(chunks));
    });

    request.on("error", reject);
  });
}

function sendFile(response, filePath) {
  fs.readFile(filePath, (error, content) => {
    if (error) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Archivo no encontrado");
      return;
    }

    response.writeHead(200, {
      "Content-Type": getContentType(filePath),
      "Cache-Control": "no-cache",
    });
    response.end(content);
  });
}

function safeJoin(rootDir, requestedPath) {
  const normalized = path
    .normalize(requestedPath)
    .replace(/^([/\\])+/, "")
    .replace(/^(\.\.(\/|\\|$))+/, "");
  const resolved = path.resolve(rootDir, normalized);
  const relative = path.relative(rootDir, resolved);

  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    return null;
  }

  return resolved;
}

function sanitizeUploadName(filename) {
  const cleanName = path.basename(filename).replace(/[<>:"/\\|?*\x00-\x1f]/g, "_");
  return cleanName || `media-${Date.now()}.bin`;
}

function isSupportedMediaFile(filename) {
  const extension = path.extname(filename).toLowerCase();
  return VIDEO_EXTENSIONS.has(extension) || IMAGE_EXTENSIONS.has(extension);
}

function resolveUniqueUploadPath(directory, filename) {
  const parsed = path.parse(filename);
  let candidate = path.join(directory, filename);
  let counter = 1;

  while (fs.existsSync(candidate)) {
    candidate = path.join(directory, `${parsed.name}-${counter}${parsed.ext}`);
    counter += 1;
  }

  return candidate;
}

function parseMultipartFiles(buffer, contentTypeHeader) {
  const boundaryMatch = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(contentTypeHeader || "");
  if (!boundaryMatch) {
    throw new Error("Boundary no encontrado");
  }

  const boundary = boundaryMatch[1] || boundaryMatch[2];
  const bodyText = buffer.toString("latin1");
  const rawParts = bodyText.split(`--${boundary}`);
  const files = [];

  for (const rawPart of rawParts) {
    const trimmed = rawPart.trim();
    if (!trimmed || trimmed === "--") {
      continue;
    }

    const partBuffer = Buffer.from(rawPart, "latin1");
    const headerEnd = partBuffer.indexOf(Buffer.from("\r\n\r\n"));
    if (headerEnd === -1) {
      continue;
    }

    const headerText = partBuffer.subarray(0, headerEnd).toString("utf8");
    const disposition = /filename="([^"]*)"/i.exec(headerText);
    if (!disposition || !disposition[1]) {
      continue;
    }

    let fileContent = partBuffer.subarray(headerEnd + 4);
    if (fileContent.subarray(fileContent.length - 2).toString("latin1") === "\r\n") {
      fileContent = fileContent.subarray(0, fileContent.length - 2);
    }

    files.push({
      filename: sanitizeUploadName(disposition[1]),
      content: fileContent,
    });
  }

  return files;
}

function parseCookies(request) {
  const header = request.headers.cookie || "";
  return header
    .split(";")
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((accumulator, part) => {
      const separatorIndex = part.indexOf("=");
      if (separatorIndex === -1) {
        return accumulator;
      }

      const key = part.slice(0, separatorIndex);
      const value = part.slice(separatorIndex + 1);
      accumulator[key] = decodeURIComponent(value);
      return accumulator;
    }, {});
}

function createSession(username) {
  const issuedAt = Date.now().toString();
  const { sessionSecret } = getAdminCredentials();
  const payload = `${username}.${issuedAt}`;
  const signature = crypto.createHmac("sha256", sessionSecret).update(payload).digest("hex");

  return `${username}.${issuedAt}.${signature}`;
}

function validateSession(request) {
  const cookies = parseCookies(request);
  const raw = cookies.drinkscreen_session;
  if (!raw) {
    return null;
  }

  const [username, issuedAt, signature] = raw.split(".");
  if (!username || !issuedAt || !signature) {
    return null;
  }

  const { sessionSecret } = getAdminCredentials();
  const payload = `${username}.${issuedAt}`;
  const expected = crypto.createHmac("sha256", sessionSecret).update(payload).digest("hex");
  if (expected !== signature) {
    return null;
  }

  return {
    username,
    createdAt: Number(issuedAt),
  };
}

function destroySession(request) {
  return;
}

function requireAuth(request, response) {
  const session = validateSession(request);
  if (!session) {
    sendJson(response, 401, {
      ok: false,
      message: "No autorizado",
    });
    return null;
  }
  return session;
}

function getIndexHtml() {
  const filePath = path.join(DIST_DIR, "index.html");
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf8");
  }

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>DrinkScreen</title></head><body style="font-family:Segoe UI,sans-serif;padding:24px;background:#020617;color:#fff"><h1>Frontend sin compilar</h1><p>Ejecuta <code>npm install</code>, luego <code>npm run build</code> y después <code>npm start</code>.</p></body></html>`;
}

function getAdminHtml() {
  const filePath = path.join(DIST_DIR, "admin.html");
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf8");
  }

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>DrinkScreen Admin</title></head><body style="font-family:Segoe UI,sans-serif;padding:24px;background:#fff7ed;color:#111827"><h1>Panel sin compilar</h1><p>Ejecuta <code>npm install</code>, luego <code>npm run build</code> y después <code>npm start</code>.</p></body></html>`;
}

function getMusicHtml() {
  const filePath = path.join(DIST_DIR, "music.html");
  if (fs.existsSync(filePath)) {
    return fs.readFileSync(filePath, "utf8");
  }

  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>DrinkScreen Music</title></head><body style="font-family:Segoe UI,sans-serif;padding:24px;background:#020617;color:#fff"><h1>Pagina de musica sin compilar</h1><p>Ejecuta <code>npm run build</code> y despues <code>npm start</code>.</p></body></html>`;
}

function listMedia(videoDirectory) {
  if (!fs.existsSync(videoDirectory)) {
    return [];
  }

  const results = [];

  function walk(currentDir) {
    const entries = fs.readdirSync(currentDir, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(currentDir, entry.name);

      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }

      const extension = path.extname(entry.name).toLowerCase();
      const isVideo = VIDEO_EXTENSIONS.has(extension);
      const isImage = IMAGE_EXTENSIONS.has(extension);
      if (!isVideo && !isImage) {
        continue;
      }

      const stats = fs.statSync(absolutePath);
      const relativePath = path.relative(videoDirectory, absolutePath).split(path.sep).join("/");
      results.push({
        name: entry.name,
        path: relativePath,
        url: `/media/${encodeURIComponent(relativePath).replace(/%2F/g, "/")}`,
        size: stats.size,
        modifiedAt: stats.mtime.toISOString(),
        type: isVideo ? "video" : "image",
      });
    }
  }

  walk(videoDirectory);
  const preferredOrder = readMediaOrder();
  const orderMap = new Map(preferredOrder.map((item, index) => [item, index]));
  results.sort((left, right) => {
    const leftIndex = orderMap.has(left.path) ? orderMap.get(left.path) : Number.MAX_SAFE_INTEGER;
    const rightIndex = orderMap.has(right.path) ? orderMap.get(right.path) : Number.MAX_SAFE_INTEGER;

    if (leftIndex !== rightIndex) {
      return leftIndex - rightIndex;
    }

    return left.path.localeCompare(right.path, "es");
  });
  return results;
}

function streamVideo(request, response, filePath) {
  fs.stat(filePath, (statError, stats) => {
    if (statError || !stats.isFile()) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Video no encontrado");
      return;
    }

    const contentType = getContentType(filePath);
    const rangeHeader = request.headers.range;

    if (!rangeHeader) {
      response.writeHead(200, {
        "Content-Type": contentType,
        "Content-Length": stats.size,
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-cache",
      });
      fs.createReadStream(filePath).pipe(response);
      return;
    }

    const matches = /bytes=(\d*)-(\d*)/.exec(rangeHeader);
    if (!matches) {
      response.writeHead(416, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Rango inválido");
      return;
    }

    const start = matches[1] ? Number(matches[1]) : 0;
    const end = matches[2] ? Number(matches[2]) : stats.size - 1;

    if (start >= stats.size || end >= stats.size || start > end) {
      response.writeHead(416, {
        "Content-Range": `bytes */${stats.size}`,
        "Content-Type": "text/plain; charset=utf-8",
      });
      response.end("Rango fuera de límites");
      return;
    }

    response.writeHead(206, {
      "Content-Type": contentType,
      "Content-Length": end - start + 1,
      "Content-Range": `bytes ${start}-${end}/${stats.size}`,
      "Accept-Ranges": "bytes",
      "Cache-Control": "no-cache",
    });

    fs.createReadStream(filePath, { start, end }).pipe(response);
  });
}

function createServer() {
  return http.createServer((request, response) => {
    const config = readConfig();
    const requestUrl = new URL(request.url, `http://${request.headers.host || "localhost"}`);
    const pathname = decodeURIComponent(requestUrl.pathname);

    if (pathname === "/api/videos") {
      const playlist = listMedia(config.videoDirectory);
      sendJson(response, 200, {
        videos: playlist,
        settings: {
          refreshSeconds: config.refreshSeconds,
          transitionMs: config.transitionMs,
          imageDurationSeconds: config.imageDurationSeconds,
          transitionStyle: config.transitionStyle,
        },
      });
      return;
    }

    if (pathname === "/api/health") {
      sendJson(response, 200, {
        ok: true,
        videoDirectory: config.videoDirectory,
        distReady: fs.existsSync(path.join(DIST_DIR, "index.html")),
      });
      return;
    }

    if (pathname === "/api/auth/session" && request.method === "GET") {
      const session = validateSession(request);
      sendJson(response, 200, {
        authenticated: Boolean(session),
        username: session?.username || null,
      });
      return;
    }

    if (pathname === "/api/auth/login" && request.method === "POST") {
      readRequestBody(request)
        .then((body) => {
          const credentials = getAdminCredentials();
          if (!credentials.username || !credentials.password) {
            sendJson(response, 500, {
              ok: false,
              message: "Configura ADMIN_USERNAME y ADMIN_PASSWORD en el archivo .env",
            });
            return;
          }

          if (body.username !== credentials.username || body.password !== credentials.password) {
            sendJson(response, 401, {
              ok: false,
              message: "Credenciales inválidas",
            });
            return;
          }

          const sessionValue = createSession(credentials.username);
          sendJson(
            response,
            200,
            { ok: true },
            {
              "Set-Cookie": `drinkscreen_session=${encodeURIComponent(
                sessionValue
              )}; HttpOnly; Path=/; SameSite=Lax`,
            }
          );
        })
        .catch(() => {
          sendJson(response, 400, {
            ok: false,
            message: "No se pudo procesar el inicio de sesión",
          });
        });
      return;
    }

    if (pathname === "/api/auth/logout" && request.method === "POST") {
      destroySession(request);
      sendJson(
        response,
        200,
        { ok: true },
        {
          "Set-Cookie": "drinkscreen_session=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax",
        }
      );
      return;
    }

    if (pathname === "/api/config" && request.method === "GET") {
      if (!requireAuth(request, response)) {
        return;
      }

      sendJson(response, 200, {
        config: {
          host: config.host,
          port: config.port,
          videoDirectory: config.videoDirectory,
          refreshSeconds: config.refreshSeconds,
          transitionMs: config.transitionMs,
          imageDurationSeconds: config.imageDurationSeconds,
          transitionStyle: config.transitionStyle,
        },
      });
      return;
    }

    if (pathname === "/api/config" && request.method === "POST") {
      if (!requireAuth(request, response)) {
        return;
      }

      readRequestBody(request)
        .then((body) => {
          const nextConfig = writeConfig(body);
          sendJson(response, 200, {
            ok: true,
            config: {
              host: nextConfig.host,
              port: nextConfig.port,
              videoDirectory: nextConfig.videoDirectory,
              refreshSeconds: nextConfig.refreshSeconds,
              transitionMs: nextConfig.transitionMs,
              imageDurationSeconds: nextConfig.imageDurationSeconds,
              transitionStyle: nextConfig.transitionStyle,
            },
          });
        })
        .catch(() => {
          sendJson(response, 400, {
            ok: false,
            message: "No se pudo guardar la configuración",
          });
        });
      return;
    }

    if (pathname === "/api/videos/upload" && request.method === "POST") {
      if (!requireAuth(request, response)) {
        return;
      }

      readRawBody(request)
        .then((buffer) => {
          const files = parseMultipartFiles(buffer, request.headers["content-type"]);
          if (!files.length) {
            sendJson(response, 400, {
              ok: false,
              message: "No se recibieron archivos",
            });
            return;
          }

          fs.mkdirSync(config.videoDirectory, { recursive: true });
          const saved = [];

          for (const file of files) {
            if (!isSupportedMediaFile(file.filename)) {
              continue;
            }

            const destination = resolveUniqueUploadPath(config.videoDirectory, file.filename);
            fs.writeFileSync(destination, file.content);
            saved.push(path.basename(destination));
          }

          if (!saved.length) {
            sendJson(response, 400, {
              ok: false,
              message: "Los archivos seleccionados no tienen un formato soportado",
            });
            return;
          }

          sendJson(response, 200, {
            ok: true,
            saved,
          });
        })
        .catch(() => {
          sendJson(response, 400, {
            ok: false,
            message: "No se pudieron procesar los archivos enviados",
          });
        });
      return;
    }

    if (pathname === "/api/videos/delete" && request.method === "POST") {
      if (!requireAuth(request, response)) {
        return;
      }

      readRequestBody(request)
        .then((body) => {
          const filePath = safeJoin(config.videoDirectory, body.path || "");
          if (!filePath || !fs.existsSync(filePath)) {
            sendJson(response, 404, {
              ok: false,
              message: "Archivo no encontrado",
            });
            return;
          }

          fs.unlinkSync(filePath);
          const orderedPaths = readMediaOrder().filter((item) => item !== body.path);
          writeMediaOrder(orderedPaths);
          sendJson(response, 200, { ok: true });
        })
        .catch(() => {
          sendJson(response, 400, {
            ok: false,
            message: "No se pudo eliminar el archivo",
          });
        });
      return;
    }

    if (pathname === "/api/playlist/order" && request.method === "POST") {
      if (!requireAuth(request, response)) {
        return;
      }

      readRequestBody(request)
        .then((body) => {
          const currentMedia = listMedia(config.videoDirectory);
          const validPaths = new Set(currentMedia.map((item) => item.path));
          const proposed = Array.isArray(body.orderedPaths) ? body.orderedPaths : [];

          const orderedPaths = proposed.filter((item) => validPaths.has(item));
          for (const mediaItem of currentMedia) {
            if (!orderedPaths.includes(mediaItem.path)) {
              orderedPaths.push(mediaItem.path);
            }
          }

          writeMediaOrder(orderedPaths);
          sendJson(response, 200, {
            ok: true,
            orderedPaths,
          });
        })
        .catch(() => {
          sendJson(response, 400, {
            ok: false,
            message: "No se pudo guardar el orden del playlist",
          });
        });
      return;
    }

    if (pathname === "/api/music-queue" && request.method === "GET") {
      sendJson(response, 200, {
        ok: true,
        queue: readMusicQueue(),
      });
      return;
    }

    if (pathname === "/api/music-queue" && request.method === "POST") {
      readRequestBody(request)
        .then((body) => {
          const track = sanitizeMusicTrack(body.track || body);
          if (!track) {
            sendJson(response, 400, {
              ok: false,
              message: "Selecciona una cancion valida de Spotify",
            });
            return;
          }

          const queue = readMusicQueue();
          queue.push(track);
          writeMusicQueue(queue);
          sendJson(response, 200, {
            ok: true,
            track,
            queue,
          });
        })
        .catch(() => {
          sendJson(response, 400, {
            ok: false,
            message: "No se pudo agregar la cancion",
          });
        });
      return;
    }

    if (pathname === "/api/music-queue/order" && request.method === "POST") {
      if (!requireAuth(request, response)) {
        return;
      }

      readRequestBody(request)
        .then((body) => {
          const orderedIds = Array.isArray(body.orderedIds) ? body.orderedIds : [];
          const queue = readMusicQueue();
          const queueById = new Map(queue.map((track) => [track.queueId, track]));
          const nextQueue = orderedIds
            .map((queueId) => queueById.get(queueId))
            .filter(Boolean);

          for (const track of queue) {
            if (!nextQueue.includes(track)) {
              nextQueue.push(track);
            }
          }

          writeMusicQueue(nextQueue);
          sendJson(response, 200, {
            ok: true,
            queue: nextQueue,
          });
        })
        .catch(() => {
          sendJson(response, 400, {
            ok: false,
            message: "No se pudo guardar el orden de la cola musical",
          });
        });
      return;
    }

    if (pathname === "/api/music-queue/delete" && request.method === "POST") {
      if (!requireAuth(request, response)) {
        return;
      }

      readRequestBody(request)
        .then((body) => {
          const queueId = typeof body.queueId === "string" ? body.queueId : "";
          const nextQueue = readMusicQueue().filter((track) => track.queueId !== queueId);
          writeMusicQueue(nextQueue);
          sendJson(response, 200, {
            ok: true,
            queue: nextQueue,
          });
        })
        .catch(() => {
          sendJson(response, 400, {
            ok: false,
            message: "No se pudo eliminar la cancion",
          });
        });
      return;
    }

    if (pathname === "/api/music-queue/play-next" && request.method === "POST") {
      if (!requireAuth(request, response)) {
        return;
      }

      const queue = readMusicQueue();
      const nextTrack = queue[0];
      if (!nextTrack) {
        sendJson(response, 400, {
          ok: false,
          message: "No hay canciones en la lista",
        });
        return;
      }

      const credentials = getSpotifyCredentials(request);
      const endpoint = credentials.deviceId
        ? `/me/player/play?device_id=${encodeURIComponent(credentials.deviceId)}`
        : "/me/player/play";

      spotifyApi(request, endpoint, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ uris: [nextTrack.uri] }),
      })
        .then(() => {
          const nextQueue = queue.slice(1);
          writeMusicQueue(nextQueue);
          sendJson(response, 200, {
            ok: true,
            track: nextTrack,
            queue: nextQueue,
          });
        })
        .catch((error) => sendSpotifyError(response, error));
      return;
    }

    if (pathname === "/api/music-queue/play-now" && request.method === "POST") {
      if (!requireAuth(request, response)) {
        return;
      }

      readRequestBody(request)
        .then(async (body) => {
          const uri = parseSpotifyTrackUri(body.uri);
          if (!uri) {
            sendJson(response, 400, {
              ok: false,
              message: "Selecciona una cancion valida de Spotify",
            });
            return;
          }

          const credentials = getSpotifyCredentials(request);
          const endpoint = credentials.deviceId
            ? `/me/player/play?device_id=${encodeURIComponent(credentials.deviceId)}`
            : "/me/player/play";

          await spotifyApi(request, endpoint, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ uris: [uri] }),
          });

          sendJson(response, 200, { ok: true });
        })
        .catch((error) => sendSpotifyError(response, error));
      return;
    }

    if (pathname === "/api/spotify/status" && request.method === "GET") {
      const credentials = getSpotifyCredentials(request);
      const token = readSpotifyToken();
      const missingScopes = getMissingSpotifyScopes(token);
      sendJson(response, 200, {
        configured: Boolean(credentials.clientId && credentials.clientSecret),
        connected: Boolean(token?.refreshToken && !missingScopes.length),
        needsReconnect: Boolean(token?.refreshToken && missingScopes.length),
        missingScopes,
        scopes: Array.from(getSpotifyTokenScopes(token)),
        authUrl: "/spotify/login",
      });
      return;
    }

    if (pathname === "/api/spotify/disconnect" && request.method === "POST") {
      if (!requireAuth(request, response)) {
        return;
      }

      clearSpotifyToken();
      sendJson(response, 200, { ok: true });
      return;
    }

    if (pathname === "/api/spotify/queue" && request.method === "GET") {
      spotifyApi(request, "/me/player/queue")
        .then((payload) => {
          sendJson(response, 200, {
            ok: true,
            currentlyPlaying: serializeSpotifyItem(payload.currently_playing),
            queue: Array.isArray(payload.queue)
              ? payload.queue.slice(0, 12).map(serializeSpotifyItem).filter(Boolean)
              : [],
          });
        })
        .catch((error) => sendSpotifyError(response, error));
      return;
    }

    if (pathname === "/api/spotify/search" && request.method === "GET") {
      const query = (requestUrl.searchParams.get("q") || "").trim();
      if (query.length < 2) {
        sendJson(response, 400, {
          ok: false,
          message: "Escribe al menos 2 caracteres para buscar",
        });
        return;
      }

      const params = new URLSearchParams({
        q: query.slice(0, 80),
        type: "track",
        limit: "8",
      });

      const searchEndpoint = `/search?${params.toString()}`;
      spotifyAppApi(request, searchEndpoint)
        .catch(() => spotifyApi(request, searchEndpoint))
        .then((payload) => {
          sendJson(response, 200, {
            ok: true,
            tracks: (payload.tracks?.items || []).map(serializeSpotifyItem).filter(Boolean),
          });
        })
        .catch((error) => {
          sendJson(response, error.statusCode || 500, {
            ok: false,
            message:
              "Spotify rechazo la busqueda. Revisa que tu app tenga Web API habilitado, que el usuario conectado este agregado como tester y que la cuenta sea Premium.",
          });
        });
      return;
    }

    if (pathname === "/api/spotify/queue" && request.method === "POST") {
      readRequestBody(request)
        .then(async (body) => {
          const uri = typeof body.uri === "string" ? body.uri : "";
          if (!/^spotify:track:[A-Za-z0-9]+$/.test(uri)) {
            sendJson(response, 400, {
              ok: false,
              message: "Selecciona una cancion valida de Spotify",
            });
            return;
          }

          const credentials = getSpotifyCredentials(request);
          const params = new URLSearchParams({ uri });
          if (credentials.deviceId) {
            params.set("device_id", credentials.deviceId);
          }

          await spotifyApi(request, `/me/player/queue?${params.toString()}`, {
            method: "POST",
          });
          sendJson(response, 200, { ok: true });
        })
        .catch((error) => sendSpotifyError(response, error));
      return;
    }

    if (pathname === "/spotify/login" && request.method === "GET") {
      const credentials = getSpotifyCredentials(request);
      if (!credentials.clientId || !credentials.clientSecret) {
        sendHtml(
          response,
          "<h1>Spotify no configurado</h1><p>Agrega SPOTIFY_CLIENT_ID y SPOTIFY_CLIENT_SECRET en .env.</p>"
        );
        return;
      }

      const state = crypto.randomBytes(16).toString("hex");
      const stateSignature = crypto
        .createHmac("sha256", getAdminCredentials().sessionSecret)
        .update(state)
        .digest("hex");
      const params = new URLSearchParams({
        response_type: "code",
        client_id: credentials.clientId,
        scope: SPOTIFY_SCOPES,
        redirect_uri: credentials.redirectUri,
        state,
        show_dialog: "true",
      });
      response.writeHead(302, {
        Location: `https://accounts.spotify.com/authorize?${params.toString()}`,
        "Set-Cookie": [
          `spotify_oauth_state=${state}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`,
          `spotify_oauth_sig=${stateSignature}; HttpOnly; Path=/; Max-Age=600; SameSite=Lax`,
        ],
      });
      response.end();
      return;
    }

    if (pathname === "/spotify/callback" && request.method === "GET") {
      const code = requestUrl.searchParams.get("code");
      const state = requestUrl.searchParams.get("state");
      const cookies = parseCookies(request);
      const expectedSignature = state
        ? crypto
            .createHmac("sha256", getAdminCredentials().sessionSecret)
            .update(state)
            .digest("hex")
        : "";
      const hasValidCookieState =
        Boolean(state && cookies.spotify_oauth_state && state === cookies.spotify_oauth_state) ||
        Boolean(state && cookies.spotify_oauth_sig && cookies.spotify_oauth_sig === expectedSignature);

      if (!code || !state || !hasValidCookieState) {
        sendHtml(response, "<h1>No se pudo conectar Spotify</h1><p>Estado OAuth invalido.</p>");
        return;
      }

      exchangeSpotifyCode(request, code)
        .then(() => {
          response.writeHead(200, {
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-cache",
            "Set-Cookie": [
              "spotify_oauth_state=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax",
              "spotify_oauth_sig=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax",
            ],
          });
          response.end(
            '<!doctype html><html lang="es"><body style="font-family:Segoe UI,sans-serif;background:#020617;color:white;padding:32px"><h1>Spotify conectado</h1><p>Ya puedes cerrar esta pestaña y volver a DrinkScreen.</p><p><a style="color:#6ee7b7" href="/admin">Volver al panel</a></p></body></html>'
          );
        })
        .catch((error) => {
          sendHtml(
            response,
            `<!doctype html><html lang="es"><body style="font-family:Segoe UI,sans-serif;background:#020617;color:white;padding:32px"><h1>No se pudo conectar Spotify</h1><p>${escapeHtml(error.message)}</p></body></html>`
          );
        });
      return;
    }

    if (pathname.startsWith("/media/")) {
      const relativePath = pathname.slice("/media/".length);
      const filePath = safeJoin(config.videoDirectory, relativePath);

      if (!filePath) {
        response.writeHead(403, { "Content-Type": "text/plain; charset=utf-8" });
        response.end("Ruta bloqueada");
        return;
      }

      streamVideo(request, response, filePath);
      return;
    }

    if (pathname === "/") {
      sendHtml(response, getIndexHtml());
      return;
    }

    if (pathname === "/admin") {
      sendHtml(response, getAdminHtml());
      return;
    }

    if (pathname === "/music") {
      sendHtml(response, getMusicHtml());
      return;
    }

    const filePath = safeJoin(DIST_DIR, pathname.replace(/^\/+/, ""));
    if (!filePath || !fs.existsSync(filePath)) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Archivo no encontrado");
      return;
    }

    sendFile(response, filePath);
  });
}

const config = readConfig();
const server = createServer();

server.listen(config.port, config.host, () => {
  console.log(`DrinkScreen disponible en http://localhost:${config.port}`);
  console.log(`Videos desde: ${config.videoDirectory}`);
});
