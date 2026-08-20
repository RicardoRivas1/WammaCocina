# TrazaCocina
### Sistema de control de insumos, consumos diarios y mermas

Prototipo funcional para restaurante de comida rápida/de autor. Este documento reúne el modelo de datos, la arquitectura de la lógica de inventario y los pasos para correr o desplegar el sistema.

## Arranque rápido

Este proyecto ya está armado y **verificado**: `npm install`, `npm run build` y `npm run lint` se ejecutaron sin errores antes de entregarlo.

```bash
npm install
npm run dev
```

Abre la URL que muestre la terminal (por defecto `http://localhost:5173`).

## Estructura del proyecto

```
trazacocina/
├── .gitignore
├── .oxlintrc.json
├── index.html
├── package.json
├── package-lock.json
├── vite.config.js        # Vite + plugin de React + plugin de Tailwind CSS v4
├── schema.sql             # Modelo de datos SQL
├── README.md               # Este documento
└── src/
    ├── main.jsx            # Punto de entrada (monta <App /> en #root)
    ├── index.css           # @import "tailwindcss";  (Tailwind v4, sin config extra)
    └── App.jsx             # El componente completo del sistema (antes "trazacocina.jsx")
```

**Lo que se ordenó respecto a lo que subiste:**
1. Los archivos de configuración que se subieron con guion bajo (`_gitignore`, `_oxlintrc.json`) se renombraron a sus nombres reales `.gitignore` y `.oxlintrc.json` — el guion bajo aparece porque los sistemas de subida de archivos suelen no aceptar nombres que empiezan con punto.
2. `vite_config.js` se renombró a `vite.config.js` por la misma razón.
3. `trazacocina.jsx` se movió a `src/App.jsx`, que es lo que `src/main.jsx` espera importar.
4. Se creó `src/main.jsx` (punto de entrada que faltaba) y `src/index.css` (con la importación de Tailwind).
5. En `vite.config.js` se agregó el plugin `@tailwindcss/vite`.
6. En `package.json` se agregaron las dependencias que el componente necesita y que no venían en tu `package.json`: `tailwindcss`, `@tailwindcss/vite` y `lucide-react`. Tailwind v4 no requiere `tailwind.config.js` ni PostCSS — sola una línea en `index.css`.

Archivos de este paquete:

| Archivo | Contenido |
|---|---|
| `src/App.jsx` | Componente React + Tailwind, funcional e interactivo (frontend del sistema) |
| `schema.sql` | Esquema SQL completo: tablas, índices, vistas y datos de ejemplo |
| `README.md` | Este documento |

---

## 1. Modelo de datos

### Diagrama de relación

```
insumos (1) ──< (N) entradas    "compras"
insumos (1) ──< (N) salidas     "ventas / recetas / mermas"
```

### SQL (ver `schema.sql` para el archivo completo con índices, vistas y datos de ejemplo)

```sql
CREATE TABLE insumos (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(120) NOT NULL,
    unidad_medida   VARCHAR(20)  NOT NULL CHECK (unidad_medida IN ('kg','gr','litros','unidades')),
    punto_reorden   DECIMAL(12,3) NOT NULL DEFAULT 0 CHECK (punto_reorden >= 0),
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE entradas (
    id              SERIAL PRIMARY KEY,
    insumo_id       INTEGER NOT NULL REFERENCES insumos(id),
    fecha           DATE NOT NULL,
    proveedor       VARCHAR(150),
    cantidad        DECIMAL(12,3) NOT NULL CHECK (cantidad > 0),
    costo_unitario  DECIMAL(12,4) NOT NULL CHECK (costo_unitario >= 0),
    costo_total     DECIMAL(14,2) GENERATED ALWAYS AS (cantidad * costo_unitario) STORED,
    nota            VARCHAR(255),
    registrado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE salidas (
    id              SERIAL PRIMARY KEY,
    insumo_id       INTEGER NOT NULL REFERENCES insumos(id),
    fecha           DATE NOT NULL,
    cantidad        DECIMAL(12,3) NOT NULL CHECK (cantidad > 0),
    tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('venta','receta','merma')),
    nota            VARCHAR(255),
    registrado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

### JSON (para API REST o almacenamiento documental)

```json
{
  "Insumo": {
    "id": "string",
    "nombre": "string",
    "unidad_medida": "kg | gr | litros | unidades",
    "punto_reorden": "number",
    "activo": "boolean"
  },
  "Entrada": {
    "id": "string",
    "insumo_id": "string",
    "fecha": "YYYY-MM-DD",
    "proveedor": "string",
    "cantidad": "number",
    "costo_unitario": "number",
    "costo_total": "number",
    "nota": "string"
  },
  "Salida": {
    "id": "string",
    "insumo_id": "string",
    "fecha": "YYYY-MM-DD",
    "cantidad": "number",
    "tipo": "venta | receta | merma",
    "nota": "string"
  }
}
```

---

## 2. Arquitectura de la lógica de inventario

**El stock nunca se guarda como un campo suelto que se suma/resta manualmente.** Se deriva de un motor de costeo tipo **Kardex por promedio ponderado**, implementado en `calcularKardex()` dentro de `trazacocina.jsx`:

1. Se combinan todas las `entradas` y `salidas` de un insumo en una sola lista.
2. Se ordenan cronológicamente (por `fecha`, y por marca de tiempo de registro en caso de empate el mismo día).
3. Se procesan una por una:
   - **Entrada:** `stock += cantidad`, `valor_total += cantidad × costo_unitario`.
   - **Salida:** se descuenta al **costo promedio vigente en ese momento** (no al costo de la última compra), y `stock -= cantidad`.
4. El costo promedio resultante en cualquier punto es `valor_total / stock`.

Esto es lo que garantiza trazabilidad real: cada fila del Kardex muestra el saldo y el costo promedio *tal como quedaron después de ese movimiento exacto*, y es auditable en cualquier momento.

**Validación de salidas:** antes de registrar un consumo, el sistema compara la cantidad solicitada contra el stock disponible calculado por el Kardex. Si no alcanza, bloquea la operación y muestra el disponible real — nunca permite stock negativo.

**Verificado con el caso de uso solicitado:**

| Día | Movimiento | Cantidad | Saldo |
|---|---|---|---|
| Lunes | Entrada (compra) | +300 kg | 300 kg |
| Martes | Salida (consumo cocina) | −15 kg | 285 kg |
| Miércoles | Salida (consumo cocina) | −50 kg | **235 kg** ✔ |

---

## 3. Checklist de requerimientos

| Requerimiento | Dónde está resuelto |
|---|---|
| Gestión de insumos y unidades (kg, gr, litros, unidades) + punto de reorden | Pestaña **Insumos** |
| Módulo de compras: fecha, proveedor, cantidad, costo | Pestaña **Compras** |
| Módulo de consumo diario: venta / receta / merma | Pestaña **Consumos**, con validación de stock disponible |
| Dashboard en tiempo real con semáforo (verde/amarillo/rojo) y costo promedio | Pestaña **Dashboard** |
| Historial cronológico auditable | Pestaña **Kardex**, filtrable por insumo y tipo |

Semáforo de estado (configurable en `estadoDeStock()`):
- 🟢 **OK** — stock > punto de reorden
- 🟡 **Bajo** — stock ≤ punto de reorden, pero > 50% de ese umbral
- 🔴 **Crítico** — stock ≤ 50% del punto de reorden
- 🔴 **Agotado** — stock = 0

---

## 4. Pasos de ejecución

### Opción A — Probarlo tal cual (ya interactivo en el chat)
El componente ya está renderizado como artefacto interactivo; no requiere instalación. El estado vive en memoria del navegador durante la sesión.

### Opción B — Correrlo localmente como app React

```bash
npm create vite@latest trazacocina -- --template react
cd trazacocina
npm install
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
npm install lucide-react
```

En `tailwind.config.js`:
```js
content: ["./index.html", "./src/**/*.{js,jsx}"]
```

En `src/index.css`:
```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Copia el contenido de `trazacocina.jsx` a `src/App.jsx` y ejecuta:
```bash
npm run dev
```

### Opción C — Llevarlo a producción con persistencia real

1. Levanta `schema.sql` en PostgreSQL (o adáptalo a SQLite/MySQL siguiendo las notas al final de ese archivo).
2. Crea endpoints REST: `POST /insumos`, `POST /entradas`, `POST /salidas`, `GET /kardex`, `GET /stock`.
3. En `trazacocina.jsx`, reemplaza los handlers `handleAddInsumo`, `handleAddEntrada` y `handleAddSalida` por llamadas `fetch()` a esos endpoints.
4. Decide dónde vive el cálculo del Kardex:
   - **Frontend** (como está ahora): simple, funciona bien si el volumen de movimientos por insumo es manejable.
   - **Backend**: recomendable si vas a tener años de histórico o múltiples sucursales — expón `GET /kardex/:insumoId` que devuelva saldo y costo promedio ya calculados.

### Alternativa: Python + Streamlit + SQLite
Si el equipo de cocina va a correr esto desde una laptop local sin desplegar nada, puedo entregar la misma lógica de Kardex en Streamlit con persistencia real en SQLite (a diferencia del prototipo React, esa versión sí persiste entre sesiones sin backend adicional). Solo pide esa variante y la preparo con el mismo modelo de datos.
