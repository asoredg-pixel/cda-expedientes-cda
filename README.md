# cda-expedientes

Sistema de Seguimiento de Trámites CDA Guaviare

## Respaldo de Firestore (Admin SDK)

Script para exportar a JSON las colecciones `usuarios`, `sistema/global` y `departamentos`.

### Requisitos

1. [Node.js](https://nodejs.org/) instalado
2. Clave de cuenta de servicio de Firebase Admin (JSON) con acceso de lectura a Firestore
3. Variable de entorno `GOOGLE_APPLICATION_CREDENTIALS` apuntando a ese archivo

### Instalación

```bash
npm install
```

### Sitio en GitHub Pages

URL pública: `https://asoredg-pixel.github.io/cda-expedientes-cda/`

El despliegue se hace con GitHub Actions (workflow `.github/workflows/deploy-pages.yml`) al hacer push a `main`.

**Primera vez o si la web no actualiza:**

1. En GitHub: **Settings → Pages → Build and deployment**
2. **Source:** seleccione **GitHub Actions** (no “Deploy from a branch”)
3. Si antes usaba despliegue por rama, desactívelo: solo debe quedar **GitHub Actions** como origen
4. Haga push a `main` y espere que termine el workflow **Deploy GitHub Pages** (debe quedar en verde)
5. Abra la app y verifique en Radicación el texto **· v20260702r** (o la versión actual de `SST_BUILD_ID` en `js/constants.js`)

**Si llegan correos “Deploy GitHub Pages: All jobs have failed”:**

- Suele deberse a tener **dos despliegues a la vez** (GitHub Actions + rama `main`) o a que Pages no está en modo Actions.
- En **Settings → Pages**, confirme **Source: GitHub Actions**.
- En **Actions**, el workflow que debe quedar verde es **Deploy GitHub Pages**; puede ignorar o desactivar el antiguo **pages build and deployment** una vez migrado.
- La anotación *“Deployment failed, try again later”* es del paso `deploy-pages`; la advertencia de Node.js 20 no es la causa del fallo.

Si no aparece la versión nueva, el navegador o GitHub Pages aún sirven archivos viejos: use Ctrl+Shift+R o espere 2–5 minutos tras el deploy.

### Matriz PQRSD → Google Sheets (una sola vez en Google Cloud)

Si al radicar aparece *"Google Sheets API has not been used in project…"*:

1. Entre con cuenta administradora del proyecto Firebase (**cda-tramites**).
2. Abra: [Habilitar Google Sheets API](https://console.cloud.google.com/apis/library/sheets.googleapis.com?project=215089141263)
3. Pulse **Habilitar** / **Enable** y espere 2–5 minutos.
4. En la app: **Correos → Reconectar** Gmail (cuenta institucional) y radique de prueba.

La hoja se crea en la carpeta Drive PQRSD: `https://drive.google.com/drive/folders/16nxEPrSheDDG5NWtWHCdgBbjg0-UL8sS` (pestaña **CONSOLIDADO PQRSD**, datos desde fila 16).

### Ejecución

**Windows (PowerShell):**

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\ruta\a\tu-clave-servicio.json"
node backup-firestore.js
```

**Linux / macOS:**

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/ruta/a/tu-clave-servicio.json"
node backup-firestore.js
```

También puedes usar el script npm:

```bash
npm run backup
```

### Salida

Se crean archivos en la carpeta `backups/` (ignorada por git), por ejemplo:

- `backups/2025-06-22_143045_usuarios.json`
- `backups/2025-06-22_143045_sistema.json`
- `backups/2025-06-22_143045_departamentos.json`

Al terminar, el script muestra en consola cuántos documentos exportó por colección.

Opcional: `FIREBASE_PROJECT_ID` (por defecto `cda-tramites`).
