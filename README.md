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
