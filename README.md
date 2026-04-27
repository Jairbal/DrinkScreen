# DrinkScreen

Sistema web para senalizacion local en TV dentro de la red del negocio. La reproduccion publica queda en `/` y el panel protegido queda en `/admin`.

## Stack

- Backend propio en Node.js para streaming, configuracion y autenticacion.
- Frontend en React + Vite.
- Estilos con Tailwind CSS.

## Variables de entorno

Crea un archivo `.env` basado en `.env.example`:

```env
ADMIN_USERNAME=admin
ADMIN_PASSWORD=changeme
SESSION_SECRET=una-clave-larga-y-segura
SPOTIFY_CLIENT_ID=tu-client-id
SPOTIFY_CLIENT_SECRET=tu-client-secret
SPOTIFY_REDIRECT_URI=http://127.0.0.1:8080/spotify/callback
```

## Configuracion del reproductor

Edita `config.json`:

```json
{
  "host": "0.0.0.0",
  "port": 8080,
  "videoDirectory": "./videos",
  "refreshSeconds": 30,
  "transitionMs": 1200,
  "imageDurationSeconds": 8,
  "transitionStyle": "fade_black"
}
```

## Instalacion

Requiere Node.js 18 o superior.

```bash
npm install
npm run build
npm start
```

## URLs

- TV: `http://IP_DE_TU_PC:8080/`
- Administracion local: `http://localhost:8080/admin`
- Pedidos de musica: `http://IP_DE_TU_PC:8080/music`

En desarrollo con `npm run dev`, Vite usa `http://127.0.0.1:5173`. Mantén `npm start` corriendo en otra terminal para la API, y usa estas URLs:

- TV dev: `http://127.0.0.1:5173/`
- Admin dev: `http://127.0.0.1:5173/admin.html`
- Pedidos dev: `http://127.0.0.1:5173/music.html`

## Spotify

DrinkScreen muestra una lista local de pedidos encima de la pantalla `/` y permite que clientes agreguen canciones desde `/music`. Desde `/admin` puedes enviar la siguiente cancion a Spotify o reproducir una cancion inmediatamente.

1. Crea una app en <https://developer.spotify.com/dashboard>.
2. En la app de Spotify, agrega el Redirect URI exacto de tu `.env`, por ejemplo `http://127.0.0.1:8080/spotify/callback`.
3. Copia `Client ID` y `Client Secret` a `SPOTIFY_CLIENT_ID` y `SPOTIFY_CLIENT_SECRET`.
4. Ejecuta `npm run build` y `npm start`.
5. Abre `/admin` y pulsa `Conectar Spotify` si quieres usar las funciones directas del reproductor de Spotify.
6. La lista visible de pedidos se controla desde DrinkScreen. Spotify no permite eliminar ni reordenar su cola interna desde la Web API.

La pantalla consulta la cola cada 5 segundos. Spotify no envia eventos de cola en tiempo real por Web API, asi que esta es una sincronizacion casi inmediata desde el servidor local.

La pagina `/music` permite buscar canciones y agregarlas a la lista local de pedidos. Solo `/admin` puede cambiar el orden o eliminar canciones.

Si estas usando Vite en el puerto `5173`, usa este Redirect URI en `.env` y en Spotify:

```env
SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173/spotify/callback
```

## Panel de administracion

- Login protegido con credenciales leidas desde `.env`.
- Subida directa de imagenes y videos desde el navegador.
- Orden manual del playlist arrastrando y soltando, o con botones para subir y bajar.
- Eliminacion de contenido existente desde la biblioteca.
- Edicion de configuracion del reproductor sin abrir archivos manualmente.
- Seleccion de transiciones: `fade_black`, `fade`, `slide_left`, `zoom`.

## Scripts

- `npm run dev`: entorno frontend con Vite.
- `npm run build`: compila la interfaz React.
- `npm start`: inicia el servidor de produccion.

## Arranque automatico en Windows

Si quieres que DrinkScreen se ejecute automaticamente despues de cada reinicio de Windows:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-autostart.ps1 -AtStartup
```

Si prefieres levantarlo solo cuando inicies sesion:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\install-autostart.ps1
```

Para quitarlo:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\uninstall-autostart.ps1
```

## Endpoints principales

- `/api/videos`: playlist publico para la pantalla.
- `/api/videos/upload`: carga de imagenes y videos desde el panel.
- `/api/videos/delete`: eliminacion de contenido desde el panel.
- `/api/playlist/order`: guardado del orden manual del playlist.
- `/api/health`: estado del servidor.
- `/api/auth/login`: login del panel.
- `/api/auth/logout`: cierre de sesion.
- `/api/auth/session`: estado de autenticacion.
- `/api/config`: lectura y guardado de configuracion.
- `/api/spotify/status`: estado de configuracion/conexion.
- `/api/spotify/queue`: lectura de cola y agregado de canciones.
- `/api/spotify/search`: busqueda de canciones para la pagina publica.
- `/api/music-queue`: lista local de pedidos musicales.
- `/api/music-queue/order`: orden de pedidos, protegido por admin.
- `/api/music-queue/delete`: eliminacion de pedidos, protegido por admin.

## Notas

- El servidor soporta `Range` para reproducir videos grandes con mas fluidez.
- La misma carpeta puede contener videos e imagenes.
- Formatos de imagen recomendados: `png`, `jpg`, `jpeg`, `webp`.
- Formatos recomendados: `mp4` y `webm`.
- El orden manual se persiste en `media-order.json`.
- Si `dist/` no existe, el servidor mostrara un aviso para ejecutar `npm run build`.
