-- =============================================================
-- TrazaCocina — Esquema de base de datos
-- Sistema de control de insumos, consumos diarios y mermas
-- Compatible con PostgreSQL. Notas para SQLite/MySQL al final.
-- =============================================================

-- ---------------------------------------------------------------
-- Tabla: insumos
-- Catálogo de ingredientes con su unidad de medida y punto de
-- reorden (umbral que dispara la alerta de stock bajo).
-- ---------------------------------------------------------------
CREATE TABLE insumos (
    id              SERIAL PRIMARY KEY,
    nombre          VARCHAR(120) NOT NULL,
    unidad_medida   VARCHAR(20)  NOT NULL CHECK (unidad_medida IN ('kg','gr','litros','unidades')),
    punto_reorden   DECIMAL(12,3) NOT NULL DEFAULT 0 CHECK (punto_reorden >= 0),
    activo          BOOLEAN NOT NULL DEFAULT TRUE,
    creado_en       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------
-- Tabla: entradas
-- Registro de compras / recepción de mercancía (módulo de
-- Compras). costo_total queda materializado para reportes
-- rápidos, pero el costo promedio ponderado del inventario se
-- calcula procesando entradas y salidas en orden cronológico
-- (ver nota de "Costeo" al final de este archivo).
-- ---------------------------------------------------------------
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

-- ---------------------------------------------------------------
-- Tabla: salidas
-- Registro de consumo diario (módulo de Consumos): ventas,
-- preparación de recetas base o mermas/desperdicio.
-- ---------------------------------------------------------------
CREATE TABLE salidas (
    id              SERIAL PRIMARY KEY,
    insumo_id       INTEGER NOT NULL REFERENCES insumos(id),
    fecha           DATE NOT NULL,
    cantidad        DECIMAL(12,3) NOT NULL CHECK (cantidad > 0),
    tipo            VARCHAR(20) NOT NULL CHECK (tipo IN ('venta','receta','merma')),
    nota            VARCHAR(255),
    registrado_en   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_entradas_insumo_fecha ON entradas(insumo_id, fecha);
CREATE INDEX idx_salidas_insumo_fecha  ON salidas(insumo_id, fecha);

-- ---------------------------------------------------------------
-- Vista de apoyo: stock físico actual (sin costo promedio).
-- Útil para reportes rápidos de cantidades; el costo promedio
-- ponderado por insumo requiere procesar movimientos en orden
-- cronológico (implementado en la capa de aplicación en el
-- prototipo, o vía función/procedimiento almacenado en producción).
-- ---------------------------------------------------------------
CREATE VIEW stock_actual AS
SELECT
    i.id,
    i.nombre,
    i.unidad_medida,
    i.punto_reorden,
    COALESCE((SELECT SUM(e.cantidad) FROM entradas e WHERE e.insumo_id = i.id), 0)
      - COALESCE((SELECT SUM(s.cantidad) FROM salidas s WHERE s.insumo_id = i.id), 0) AS stock,
    CASE
        WHEN COALESCE((SELECT SUM(e.cantidad) FROM entradas e WHERE e.insumo_id = i.id), 0)
           - COALESCE((SELECT SUM(s.cantidad) FROM salidas s WHERE s.insumo_id = i.id), 0) <= 0
          THEN 'agotado'
        WHEN COALESCE((SELECT SUM(e.cantidad) FROM entradas e WHERE e.insumo_id = i.id), 0)
           - COALESCE((SELECT SUM(s.cantidad) FROM salidas s WHERE s.insumo_id = i.id), 0) <= i.punto_reorden * 0.5
          THEN 'critico'
        WHEN COALESCE((SELECT SUM(e.cantidad) FROM entradas e WHERE e.insumo_id = i.id), 0)
           - COALESCE((SELECT SUM(s.cantidad) FROM salidas s WHERE s.insumo_id = i.id), 0) <= i.punto_reorden
          THEN 'bajo'
        ELSE 'ok'
    END AS estado
FROM insumos i;

-- ---------------------------------------------------------------
-- Vista de apoyo: historial cronológico unificado (Kardex crudo,
-- sin saldo acumulado — el saldo se calcula en la aplicación
-- porque requiere procesamiento secuencial fila a fila).
-- ---------------------------------------------------------------
CREATE VIEW historial_movimientos AS
SELECT
    'entrada'        AS tipo_movimiento,
    e.id,
    e.insumo_id,
    e.fecha,
    e.cantidad,
    e.costo_unitario,
    e.proveedor       AS detalle,
    e.registrado_en
FROM entradas e
UNION ALL
SELECT
    'salida'          AS tipo_movimiento,
    s.id,
    s.insumo_id,
    s.fecha,
    s.cantidad,
    NULL              AS costo_unitario,
    s.tipo || ' — ' || COALESCE(s.nota, '') AS detalle,
    s.registrado_en
FROM salidas s
ORDER BY fecha, registrado_en;

-- =============================================================
-- Datos de ejemplo — reproducen el caso de uso solicitado
-- =============================================================
INSERT INTO insumos (nombre, unidad_medida, punto_reorden) VALUES
    ('Pechuga de Pollo', 'kg', 80);

-- Lunes: entrada de 300 kg
INSERT INTO entradas (insumo_id, fecha, proveedor, cantidad, costo_unitario)
VALUES (1, '2026-08-17', 'Distribuidora Avícola del Valle', 300, 95);

-- Martes: salida de 15 kg -> saldo 285 kg
INSERT INTO salidas (insumo_id, fecha, cantidad, tipo, nota)
VALUES (1, '2026-08-18', 15, 'venta', 'Consumo cocina — servicio del día');

-- Miércoles: salida de 50 kg -> saldo 235 kg
INSERT INTO salidas (insumo_id, fecha, cantidad, tipo, nota)
VALUES (1, '2026-08-19', 50, 'receta', 'Base para salsas y guarniciones');

-- Verificación rápida del saldo (debe devolver 235):
-- SELECT stock FROM stock_actual WHERE id = 1;

-- =============================================================
-- Notas de portabilidad
-- =============================================================
-- SQLite:
--   - Reemplazar SERIAL por INTEGER PRIMARY KEY AUTOINCREMENT.
--   - SQLite no soporta CHECK con subconsultas correlacionadas en
--     vistas tan bien como Postgres; las vistas anteriores funcionan
--     pero conviene probarlas o resolver el estado en la aplicación
--     (como hace el prototipo React).
--
-- MySQL:
--   - Reemplazar SERIAL por INT AUTO_INCREMENT PRIMARY KEY.
--   - GENERATED ALWAYS AS (...) STORED es compatible desde MySQL 5.7+.
--
-- Costeo (importante):
--   El costo promedio ponderado por insumo NO es una columna: se
--   recalcula procesando entradas y salidas en orden cronológico
--   (fecha, luego registrado_en). Esta es la misma lógica implementada
--   en la función calcularKardex() del prototipo React. En producción
--   se puede materializar en una tabla `saldos_diarios` actualizada
--   por un job o trigger si el volumen de movimientos lo justifica.
