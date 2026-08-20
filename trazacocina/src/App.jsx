import React, { useState, useMemo, useEffect } from "react";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  ClipboardList,
  History as HistoryIcon,
  Plus,
  AlertTriangle,
  CheckCircle2,
  DollarSign,
  Search,
  Info,
  Trash2,
} from "lucide-react";

/* ============================================================
   DOMINIO
   ============================================================ */

const UNIDADES = ["kg", "gr", "litros", "unidades"];

const TIPOS_SALIDA = [
  { value: "venta", label: "Venta del día" },
  { value: "receta", label: "Receta base / Preparación" },
  { value: "merma", label: "Merma / Desperdicio" },
];

const TIPO_SALIDA_ESTILO = {
  venta: "bg-emerald-50 text-emerald-700 border-emerald-200",
  receta: "bg-sky-50 text-sky-700 border-sky-200",
  merma: "bg-red-50 text-red-700 border-red-200",
};

const ESTADOS = {
  ok: {
    label: "OK",
    dot: "bg-emerald-500",
    text: "text-emerald-700",
    bg: "bg-emerald-50",
    border: "border-emerald-200",
  },
  bajo: {
    label: "Bajo",
    dot: "bg-amber-500",
    text: "text-amber-700",
    bg: "bg-amber-50",
    border: "border-amber-200",
  },
  critico: {
    label: "Crítico",
    dot: "bg-red-500",
    text: "text-red-700",
    bg: "bg-red-50",
    border: "border-red-200",
  },
  agotado: {
    label: "Agotado",
    dot: "bg-red-700",
    text: "text-red-800",
    bg: "bg-red-100",
    border: "border-red-300",
  },
};

function uid(prefix) {
  return prefix + "-" + Math.random().toString(36).slice(2, 9);
}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function fmtMoney(n) {
  if (!isFinite(n)) return "$0.00";
  return (
    "$" +
    Number(n).toLocaleString("es-MX", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

function fmtCant(n) {
  return Number(n).toLocaleString("es-MX", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
}

function fmtFecha(f) {
  if (!f) return "—";
  const [y, m, d] = f.split("-");
  return `${d}/${m}/${y}`;
}

function estadoDeStock(stock, punto) {
  if (stock <= 0) return "agotado";
  if (stock <= punto * 0.5) return "critico";
  if (stock <= punto) return "bajo";
  return "ok";
}

/* ============================================================
   MOTOR DE COSTEO — Kardex por Promedio Ponderado
   ============================================================ */

function calcularKardex(insumos, entradas, salidas) {
  const estado = {};
  insumos.forEach((i) => {
    estado[i.id] = { stock: 0, valor: 0 };
  });

  const movimientos = [
    ...entradas.map((e) => ({ ...e, tipoMov: "entrada" })),
    ...salidas.map((s) => ({ ...s, tipoMov: "salida" })),
  ].sort((a, b) =>
    a.fecha === b.fecha ? a.ts - b.ts : a.fecha.localeCompare(b.fecha),
  );

  const filas = [];

  for (const mov of movimientos) {
    const e = estado[mov.insumoId];
    if (!e) continue;
    const costoPromedioAntes =
      e.stock > 0
        ? e.valor / e.stock
        : mov.tipoMov === "entrada"
          ? mov.costoUnitario
          : 0;

    if (mov.tipoMov === "entrada") {
      e.stock += mov.cantidad;
      e.valor += mov.cantidad * mov.costoUnitario;
    } else {
      const cant = Math.min(mov.cantidad, e.stock);
      e.valor -= cant * costoPromedioAntes;
      e.stock -= cant;
      if (e.stock < 0.001) e.stock = 0;
      if (e.valor < 0) e.valor = 0;
    }

    filas.push({
      ...mov,
      saldoStock: e.stock,
      costoPromedioResultante: e.stock > 0 ? e.valor / e.stock : 0,
    });
  }

  const resumen = {};
  insumos.forEach((i) => {
    const st = estado[i.id];
    resumen[i.id] = {
      stock: st.stock,
      costoPromedio: st.stock > 0 ? st.valor / st.stock : 0,
      valorTotal: st.valor,
    };
  });

  return { filas, resumen };
}

/* ============================================================
   DATOS SEMILLA
   ============================================================ */

const LUNES = "2026-08-17";
const MARTES = "2026-08-18";
const MIERCOLES = "2026-08-19";

const SEED_INSUMOS = [
  { id: "p-pollo", nombre: "Pechuga de Pollo", unidad: "kg", puntoReorden: 80 },
  { id: "p-papa", nombre: "Papa para Fritas", unidad: "kg", puntoReorden: 50 },
  {
    id: "p-aceite",
    nombre: "Aceite Vegetal",
    unidad: "litros",
    puntoReorden: 20,
  },
  { id: "p-queso", nombre: "Queso Mozzarella", unidad: "kg", puntoReorden: 25 },
  { id: "p-pan", nombre: "Pan Brioche", unidad: "unidades", puntoReorden: 60 },
  { id: "p-limon", nombre: "Limón", unidad: "kg", puntoReorden: 10 },
];

const SEED_ENTRADAS = [
  {
    id: "e1",
    insumoId: "p-pollo",
    fecha: LUNES,
    proveedor: "Distribuidora Avícola del Valle",
    cantidad: 300,
    costoUnitario: 95,
    costoTotal: 28500,
    nota: "Compra semanal",
    ts: 1,
  },
  {
    id: "e2",
    insumoId: "p-papa",
    fecha: LUNES,
    proveedor: "AgroFresh S.A.",
    cantidad: 180,
    costoUnitario: 18,
    costoTotal: 3240,
    nota: "",
    ts: 2,
  },
  {
    id: "e3",
    insumoId: "p-aceite",
    fecha: LUNES,
    proveedor: "Aceites del Sur",
    cantidad: 38,
    costoUnitario: 42,
    costoTotal: 1596,
    nota: "",
    ts: 3,
  },
  {
    id: "e4",
    insumoId: "p-queso",
    fecha: LUNES,
    proveedor: "Lácteos La Pradera",
    cantidad: 30,
    costoUnitario: 130,
    costoTotal: 3900,
    nota: "",
    ts: 4,
  },
  {
    id: "e5",
    insumoId: "p-pan",
    fecha: LUNES,
    proveedor: "Panadería Central",
    cantidad: 150,
    costoUnitario: 6.5,
    costoTotal: 975,
    nota: "",
    ts: 5,
  },
  {
    id: "e6",
    insumoId: "p-limon",
    fecha: LUNES,
    proveedor: "Frutas y Cítricos del Bajío",
    cantidad: 20,
    costoUnitario: 30,
    costoTotal: 600,
    nota: "",
    ts: 6,
  },
];

const SEED_SALIDAS = [
  {
    id: "s1",
    insumoId: "p-pollo",
    fecha: MARTES,
    cantidad: 15,
    tipo: "venta",
    nota: "Consumo cocina — servicio del día",
    ts: 7,
  },
  {
    id: "s2",
    insumoId: "p-papa",
    fecha: MARTES,
    cantidad: 60,
    tipo: "venta",
    nota: "Consumo cocina",
    ts: 8,
  },
  {
    id: "s3",
    insumoId: "p-queso",
    fecha: MARTES,
    cantidad: 24,
    tipo: "venta",
    nota: "Consumo cocina",
    ts: 9,
  },
  {
    id: "s4",
    insumoId: "p-pan",
    fecha: MARTES,
    cantidad: 102,
    tipo: "venta",
    nota: "Consumo cocina",
    ts: 10,
  },
  {
    id: "s5",
    insumoId: "p-pollo",
    fecha: MIERCOLES,
    cantidad: 50,
    tipo: "receta",
    nota: "Base para salsas y guarniciones",
    ts: 11,
  },
  {
    id: "s6",
    insumoId: "p-aceite",
    fecha: MIERCOLES,
    cantidad: 20,
    tipo: "receta",
    nota: "Fritura diaria",
    ts: 12,
  },
  {
    id: "s7",
    insumoId: "p-pan",
    fecha: MIERCOLES,
    cantidad: 8,
    tipo: "merma",
    nota: "Pan vencido — fuera de estándar de calidad",
    ts: 13,
  },
  {
    id: "s8",
    insumoId: "p-limon",
    fecha: MIERCOLES,
    cantidad: 20,
    tipo: "receta",
    nota: "Preparación de salsas cítricas de la semana",
    ts: 14,
  },
];

/* ============================================================
   PIEZAS DE UI REUTILIZABLES
   ============================================================ */

function Badge({ estado }) {
  const cfg = ESTADOS[estado];
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text} ${cfg.border}`}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
      {cfg.label}
    </span>
  );
}

function StockBar({ stock, punto, estado }) {
  const escala = Math.max(punto * 2, stock, 1);
  const pct = Math.min(100, (stock / escala) * 100);
  const cfg = ESTADOS[estado];
  return (
    <div className="h-1.5 w-full rounded-full bg-slate-100">
      <div
        className={`h-1.5 rounded-full ${cfg.dot}`}
        style={{ width: pct + "%" }}
      />
    </div>
  );
}

function KpiCard({ icon: Icon, label, value, sub, tone }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-slate-500">
          {label}
        </span>
        <div className={`rounded-lg p-1.5 ${tone}`}>
          <Icon className="h-4 w-4" />
        </div>
      </div>
      <p className="mt-2 text-2xl font-semibold tabular-nums text-slate-900">
        {value}
      </p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

function TabButton({ active, onClick, icon: Icon, children }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors ${
        active
          ? "bg-emerald-800 text-white"
          : "text-slate-600 hover:bg-slate-100"
      }`}
    >
      <Icon className="h-4 w-4" />
      {children}
    </button>
  );
}

function EmptyState({ text }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center">
      <Info className="h-5 w-5 text-slate-300" />
      <p className="text-sm text-slate-400">{text}</p>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </span>
      {children}
    </label>
  );
}

const inputCls =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600";

/* ============================================================
   TAB: DASHBOARD
   ============================================================ */

function DashboardTab({ insumos, resumen }) {
  const [busqueda, setBusqueda] = useState("");

  const filas = insumos
    .map((i) => {
      const r = resumen[i.id] || { stock: 0, costoPromedio: 0, valorTotal: 0 };
      return { ...i, ...r, estado: estadoDeStock(r.stock, i.puntoReorden) };
    })
    .filter((i) => i.nombre.toLowerCase().includes(busqueda.toLowerCase()));

  const valorTotalInventario = insumos.reduce(
    (acc, i) => acc + (resumen[i.id]?.valorTotal || 0),
    0,
  );
  const enAlerta = insumos.filter((i) => {
    const st = resumen[i.id]?.stock || 0;
    const e = estadoDeStock(st, i.puntoReorden);
    return e !== "ok";
  }).length;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <KpiCard
          icon={DollarSign}
          label="Valor de inventario"
          value={fmtMoney(valorTotalInventario)}
          sub="Costo promedio ponderado"
          tone="bg-emerald-50 text-emerald-700"
        />
        <KpiCard
          icon={AlertTriangle}
          label="Insumos en alerta"
          value={enAlerta}
          sub="Bajo, crítico o agotado"
          tone="bg-amber-50 text-amber-700"
        />
        <KpiCard
          icon={Package}
          label="Insumos monitoreados"
          value={insumos.length}
          sub="Configurados en el sistema"
          tone="bg-slate-100 text-slate-700"
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200 p-4">
          <h3 className="text-sm font-semibold text-slate-900">
            Stock en tiempo real
          </h3>
          <div className="relative w-56">
            <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar insumo…"
              className="w-full rounded-lg border border-slate-300 bg-white py-1.5 pl-8 pr-3 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
            />
          </div>
        </div>

        {filas.length === 0 ? (
          <EmptyState text="No hay insumos que coincidan con la búsqueda." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Insumo</th>
                  <th className="px-4 py-2.5 font-medium">Stock actual</th>
                  <th className="px-4 py-2.5 font-medium">Nivel</th>
                  <th className="px-4 py-2.5 font-medium">Punto de reorden</th>
                  <th className="px-4 py-2.5 font-medium">Costo promedio</th>
                  <th className="px-4 py-2.5 font-medium">Valor en stock</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filas.map((f) => (
                  <tr
                    key={f.id}
                    className={ESTADOS[f.estado].bg + " bg-opacity-30"}
                  >
                    <td className="px-4 py-3 font-medium text-slate-800">
                      {f.nombre}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {fmtCant(f.stock)} {f.unidad}
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-28">
                        <StockBar
                          stock={f.stock}
                          punto={f.puntoReorden}
                          estado={f.estado}
                        />
                      </div>
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-500">
                      {fmtCant(f.puntoReorden)} {f.unidad}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {fmtMoney(f.costoPromedio)}
                    </td>
                    <td className="px-4 py-3 tabular-nums text-slate-700">
                      {fmtMoney(f.valorTotal)}
                    </td>
                    <td className="px-4 py-3">
                      <Badge estado={f.estado} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

/* ============================================================
   TAB: INSUMOS
   ============================================================ */

function InsumosTab({
  insumos,
  resumen,
  onAddInsumo,
  onUpdatePunto,
  onDeleteInsumo,
}) {
  const [nombre, setNombre] = useState("");
  const [unidad, setUnidad] = useState("kg");
  const [punto, setPunto] = useState("");
  const [error, setError] = useState("");

  function submit(e) {
    e.preventDefault();
    if (!nombre.trim()) return setError("Indica el nombre del insumo.");
    if (!punto || Number(punto) <= 0)
      return setError("El punto de reorden debe ser mayor a 0.");
    onAddInsumo({ nombre: nombre.trim(), unidad, puntoReorden: Number(punto) });
    setNombre("");
    setPunto("");
    setError("");
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-3 text-sm font-semibold text-slate-900">
            Nuevo insumo
          </h3>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Nombre del insumo">
              <input
                className={inputCls}
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Ej. Camarón"
              />
            </Field>
            <Field label="Unidad de medida">
              <select
                className={inputCls}
                value={unidad}
                onChange={(e) => setUnidad(e.target.value)}
              >
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>
                    {u}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Punto de reorden (alerta de stock bajo)">
              <input
                className={inputCls}
                type="number"
                min="0"
                step="0.01"
                value={punto}
                onChange={(e) => setPunto(e.target.value)}
                placeholder="Ej. 25"
              />
            </Field>
            {error && (
              <p className="text-xs font-medium text-red-600">{error}</p>
            )}
            <button
              type="submit"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-900"
            >
              <Plus className="h-4 w-4" />
              Agregar insumo
            </button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Insumos configurados
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-4 py-2.5 font-medium">Nombre</th>
                  <th className="px-4 py-2.5 font-medium">Unidad</th>
                  <th className="px-4 py-2.5 font-medium">Stock actual</th>
                  <th className="px-4 py-2.5 font-medium">Punto de reorden</th>
                  <th className="px-4 py-2.5 font-medium">Estado</th>
                  <th className="px-4 py-2.5 font-medium text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {insumos.map((i) => {
                  const st = resumen[i.id]?.stock || 0;
                  const estado = estadoDeStock(st, i.puntoReorden);
                  return (
                    <tr key={i.id}>
                      <td className="px-4 py-2.5 font-medium text-slate-800">
                        {i.nombre}
                      </td>
                      <td className="px-4 py-2.5 text-slate-500">{i.unidad}</td>
                      <td className="px-4 py-2.5 tabular-nums text-slate-700">
                        {fmtCant(st)}
                      </td>
                      <td className="px-4 py-2.5">
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue={i.puntoReorden}
                          onBlur={(e) => {
                            const v = Number(e.target.value);
                            if (v > 0) onUpdatePunto(i.id, v);
                          }}
                          className="w-24 rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-emerald-600 focus:ring-1 focus:ring-emerald-600"
                        />
                      </td>
                      <td className="px-4 py-2.5">
                        <Badge estado={estado} />
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <button
                          onClick={() => onDeleteInsumo(i.id)}
                          title="Eliminar insumo"
                          className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   TAB: COMPRAS (ENTRADAS)
   ============================================================ */

function ComprasTab({ insumos, entradas, onAddEntrada, onDeleteEntrada }) {
  const [insumoId, setInsumoId] = useState(insumos[0]?.id || "");
  const [fecha, setFecha] = useState(hoyISO());
  const [proveedor, setProveedor] = useState("");
  const [cantidad, setCantidad] = useState("");
  const [costoUnitario, setCostoUnitario] = useState("");
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");

  const insumoSel = insumos.find((i) => i.id === insumoId);
  const costoTotal = (Number(cantidad) || 0) * (Number(costoUnitario) || 0);

  function submit(e) {
    e.preventDefault();
    if (!insumoId) return setError("Selecciona un insumo.");
    if (!fecha) return setError("Indica la fecha de la compra.");
    if (!cantidad || Number(cantidad) <= 0)
      return setError("La cantidad debe ser mayor a 0.");
    if (!costoUnitario || Number(costoUnitario) < 0)
      return setError("Indica el costo unitario de compra.");

    onAddEntrada({
      insumoId,
      fecha,
      proveedor: proveedor.trim() || "Sin especificar",
      cantidad: Number(cantidad),
      costoUnitario: Number(costoUnitario),
      nota: nota.trim(),
    });

    setProveedor("");
    setCantidad("");
    setCostoUnitario("");
    setNota("");
    setError("");
  }

  const recientes = [...entradas].sort((a, b) => b.ts - a.ts).slice(0, 8);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-1 text-sm font-semibold text-slate-900">
            Registrar entrada
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            Compra / recepción de mercancía.
          </p>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Insumo">
              <select
                className={inputCls}
                value={insumoId}
                onChange={(e) => setInsumoId(e.target.value)}
              >
                {insumos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre} ({i.unidad})
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fecha">
                <input
                  className={inputCls}
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </Field>
              <Field label="Cantidad">
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  step="0.01"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder={insumoSel ? insumoSel.unidad : ""}
                />
              </Field>
            </div>
            <Field label="Proveedor">
              <input
                className={inputCls}
                value={proveedor}
                onChange={(e) => setProveedor(e.target.value)}
                placeholder="Ej. Distribuidora Avícola del Valle"
              />
            </Field>
            <Field label="Costo unitario de compra">
              <input
                className={inputCls}
                type="number"
                min="0"
                step="0.01"
                value={costoUnitario}
                onChange={(e) => setCostoUnitario(e.target.value)}
                placeholder="$/unidad"
              />
            </Field>
            <Field label="Nota (opcional)">
              <input
                className={inputCls}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Referencia de factura, lote, etc."
              />
            </Field>

            <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
              <span className="text-slate-500">Costo total de la compra</span>
              <span className="font-semibold tabular-nums text-slate-800">
                {fmtMoney(costoTotal)}
              </span>
            </div>

            {error && (
              <p className="text-xs font-medium text-red-600">{error}</p>
            )}

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-900"
            >
              <Plus className="h-4 w-4" />
              Registrar entrada
            </button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Compras recientes
            </h3>
          </div>
          {recientes.length === 0 ? (
            <EmptyState text="Aún no se han registrado compras." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5 font-medium">Fecha</th>
                    <th className="px-4 py-2.5 font-medium">Insumo</th>
                    <th className="px-4 py-2.5 font-medium">Proveedor</th>
                    <th className="px-4 py-2.5 font-medium">Cantidad</th>
                    <th className="px-4 py-2.5 font-medium">Costo unit.</th>
                    <th className="px-4 py-2.5 font-medium">Total</th>
                    <th className="px-4 py-2.5 font-medium text-right">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recientes.map((e) => {
                    const ins = insumos.find((i) => i.id === e.insumoId);
                    return (
                      <tr key={e.id}>
                        <td className="px-4 py-2.5 text-slate-600">
                          {fmtFecha(e.fecha)}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-800">
                          {ins ? ins.nombre : e.insumoId}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">
                          {e.proveedor}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-emerald-700">
                          +{fmtCant(e.cantidad)} {ins?.unidad}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-slate-600">
                          {fmtMoney(e.costoUnitario)}
                        </td>
                        <td className="px-4 py-2.5 tabular-nums font-medium text-slate-800">
                          {fmtMoney(e.costoTotal)}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => onDeleteEntrada(e.id)}
                            title="Eliminar entrada"
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   TAB: CONSUMOS (SALIDAS)
   ============================================================ */

function ConsumosTab({
  insumos,
  salidas,
  resumen,
  onAddSalida,
  onDeleteSalida,
}) {
  const [insumoId, setInsumoId] = useState(insumos[0]?.id || "");
  const [fecha, setFecha] = useState(hoyISO());
  const [cantidad, setCantidad] = useState("");
  const [tipo, setTipo] = useState("venta");
  const [nota, setNota] = useState("");
  const [error, setError] = useState("");

  const insumoSel = insumos.find((i) => i.id === insumoId);
  const disponible = resumen[insumoId]?.stock || 0;

  function submit(e) {
    e.preventDefault();
    if (!insumoId) return setError("Selecciona un insumo.");
    if (!fecha) return setError("Indica la fecha del consumo.");
    const cant = Number(cantidad);
    if (!cant || cant <= 0) return setError("La cantidad debe ser mayor a 0.");
    if (cant > disponible) {
      return setError(
        `Stock insuficiente: disponible ${fmtCant(disponible)} ${insumoSel?.unidad}.`,
      );
    }

    onAddSalida({ insumoId, fecha, cantidad: cant, tipo, nota: nota.trim() });
    setCantidad("");
    setNota("");
    setError("");
  }

  const recientes = [...salidas].sort((a, b) => b.ts - a.ts).slice(0, 8);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <div className="lg:col-span-1">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <h3 className="mb-1 text-sm font-semibold text-slate-900">
            Registrar salida
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            Consumo de cocina, venta o merma.
          </p>
          <form onSubmit={submit} className="space-y-3">
            <Field label="Insumo">
              <select
                className={inputCls}
                value={insumoId}
                onChange={(e) => setInsumoId(e.target.value)}
              >
                {insumos.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.nombre} ({i.unidad})
                  </option>
                ))}
              </select>
            </Field>
            <p className="text-xs text-slate-500">
              Disponible:{" "}
              <span className="font-medium tabular-nums text-slate-700">
                {fmtCant(disponible)} {insumoSel?.unidad}
              </span>
            </p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Fecha">
                <input
                  className={inputCls}
                  type="date"
                  value={fecha}
                  onChange={(e) => setFecha(e.target.value)}
                />
              </Field>
              <Field label="Cantidad">
                <input
                  className={inputCls}
                  type="number"
                  min="0"
                  step="0.01"
                  value={cantidad}
                  onChange={(e) => setCantidad(e.target.value)}
                  placeholder={insumoSel?.unidad}
                />
              </Field>
            </div>
            <Field label="Tipo de salida">
              <select
                className={inputCls}
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
              >
                {TIPOS_SALIDA.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nota (opcional)">
              <input
                className={inputCls}
                value={nota}
                onChange={(e) => setNota(e.target.value)}
                placeholder="Detalle del consumo o motivo de la merma"
              />
            </Field>

            {error && (
              <p className="text-xs font-medium text-red-600">{error}</p>
            )}

            <button
              type="submit"
              className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-800 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-900"
            >
              <Plus className="h-4 w-4" />
              Registrar salida
            </button>
          </form>
        </div>
      </div>

      <div className="lg:col-span-2">
        <div className="rounded-xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 p-4">
            <h3 className="text-sm font-semibold text-slate-900">
              Consumos recientes
            </h3>
          </div>
          {recientes.length === 0 ? (
            <EmptyState text="Aún no se han registrado salidas." />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="px-4 py-2.5 font-medium">Fecha</th>
                    <th className="px-4 py-2.5 font-medium">Insumo</th>
                    <th className="px-4 py-2.5 font-medium">Tipo</th>
                    <th className="px-4 py-2.5 font-medium">Cantidad</th>
                    <th className="px-4 py-2.5 font-medium">Nota</th>
                    <th className="px-4 py-2.5 font-medium text-right">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recientes.map((s) => {
                    const ins = insumos.find((i) => i.id === s.insumoId);
                    const t = TIPOS_SALIDA.find((x) => x.value === s.tipo);
                    return (
                      <tr key={s.id}>
                        <td className="px-4 py-2.5 text-slate-600">
                          {fmtFecha(s.fecha)}
                        </td>
                        <td className="px-4 py-2.5 font-medium text-slate-800">
                          {ins ? ins.nombre : s.insumoId}
                        </td>
                        <td className="px-4 py-2.5">
                          <span
                            className={`rounded-full border px-2 py-0.5 text-xs font-medium ${TIPO_SALIDA_ESTILO[s.tipo]}`}
                          >
                            {t?.label}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 tabular-nums text-red-600">
                          -{fmtCant(s.cantidad)} {ins?.unidad}
                        </td>
                        <td className="px-4 py-2.5 text-slate-500">
                          {s.nota || "—"}
                        </td>
                        <td className="px-4 py-2.5 text-right">
                          <button
                            onClick={() => onDeleteSalida(s.id)}
                            title="Eliminar salida"
                            className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600 transition-colors"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

/* ============================================================
   TAB: HISTORIAL / KARDEX
   ============================================================ */

function HistorialTab({ insumos, filas }) {
  const [insumoFiltro, setInsumoFiltro] = useState("todos");
  const [tipoFiltro, setTipoFiltro] = useState("todos");

  const ordenadas = [...filas].sort((a, b) =>
    a.fecha === b.fecha ? b.ts - a.ts : b.fecha.localeCompare(a.fecha),
  );

  const visibles = ordenadas.filter((f) => {
    if (insumoFiltro !== "todos" && f.insumoId !== insumoFiltro) return false;
    if (tipoFiltro === "entradas" && f.tipoMov !== "entrada") return false;
    if (tipoFiltro === "salidas" && f.tipoMov !== "salida") return false;
    return true;
  });

  return (
    <div className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 p-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">
            Kardex de movimientos
          </h3>
          <p className="text-xs text-slate-500">
            Trazabilidad completa de cada unidad que entra o sale del
            inventario.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
            value={insumoFiltro}
            onChange={(e) => setInsumoFiltro(e.target.value)}
          >
            <option value="todos">Todos los insumos</option>
            {insumos.map((i) => (
              <option key={i.id} value={i.id}>
                {i.nombre}
              </option>
            ))}
          </select>
          <select
            className="rounded-lg border border-slate-300 px-2.5 py-1.5 text-sm"
            value={tipoFiltro}
            onChange={(e) => setTipoFiltro(e.target.value)}
          >
            <option value="todos">Entradas y salidas</option>
            <option value="entradas">Solo entradas</option>
            <option value="salidas">Solo salidas</option>
          </select>
        </div>
      </div>

      {visibles.length === 0 ? (
        <EmptyState text="No hay movimientos que coincidan con el filtro." />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="px-4 py-2.5 font-medium">Fecha</th>
                <th className="px-4 py-2.5 font-medium">Insumo</th>
                <th className="px-4 py-2.5 font-medium">Movimiento</th>
                <th className="px-4 py-2.5 font-medium">Detalle</th>
                <th className="px-4 py-2.5 font-medium">Cantidad</th>
                <th className="px-4 py-2.5 font-medium">Saldo resultante</th>
                <th className="px-4 py-2.5 font-medium">
                  Costo prom. resultante
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibles.map((f) => {
                const ins = insumos.find((i) => i.id === f.insumoId);
                const esEntrada = f.tipoMov === "entrada";
                const t = !esEntrada
                  ? TIPOS_SALIDA.find((x) => x.value === f.tipo)
                  : null;
                return (
                  <tr key={f.tipoMov + "-" + f.id}>
                    <td className="px-4 py-2.5 text-slate-600">
                      {fmtFecha(f.fecha)}
                    </td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">
                      {ins ? ins.nombre : f.insumoId}
                    </td>
                    <td className="px-4 py-2.5">
                      {esEntrada ? (
                        <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
                          Entrada · Compra
                        </span>
                      ) : (
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${TIPO_SALIDA_ESTILO[f.tipo]}`}
                        >
                          Salida · {t?.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-slate-500">
                      {esEntrada ? f.proveedor : f.nota || "—"}
                    </td>
                    <td
                      className={`px-4 py-2.5 tabular-nums font-medium ${esEntrada ? "text-emerald-700" : "text-red-600"}`}
                    >
                      {esEntrada ? "+" : "-"}
                      {fmtCant(f.cantidad)} {ins?.unidad}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-700">
                      {fmtCant(f.saldoStock)} {ins?.unidad}
                    </td>
                    <td className="px-4 py-2.5 tabular-nums text-slate-500">
                      {fmtMoney(f.costoPromedioResultante)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

/* ============================================================
   APP
   ============================================================ */

export default function App() {
  // 1. Inicializar estados desde localStorage (si existen) o con datos SEED
  const [insumos, setInsumos] = useState(() => {
    const saved = localStorage.getItem("wamma_insumos");
    return saved ? JSON.parse(saved) : SEED_INSUMOS;
  });

  const [entradas, setEntradas] = useState(() => {
    const saved = localStorage.getItem("wamma_entradas");
    return saved ? JSON.parse(saved) : SEED_ENTRADAS;
  });

  const [salidas, setSalidas] = useState(() => {
    const saved = localStorage.getItem("wamma_salidas");
    return saved ? JSON.parse(saved) : SEED_SALIDAS;
  });

  const [tab, setTab] = useState("dashboard");
  const [toast, setToast] = useState(null);

  // 2. Guardar automáticamente cada vez que cambie alguna lista
  useEffect(() => {
    localStorage.setItem("wamma_insumos", JSON.stringify(insumos));
  }, [insumos]);

  useEffect(() => {
    localStorage.setItem("wamma_entradas", JSON.stringify(entradas));
  }, [entradas]);

  useEffect(() => {
    localStorage.setItem("wamma_salidas", JSON.stringify(salidas));
  }, [salidas]);

  const { filas, resumen } = useMemo(
    () => calcularKardex(insumos, entradas, salidas),
    [insumos, entradas, salidas],
  );

  function notify(msg, type) {
    setToast({ msg, type });
    window.setTimeout(() => setToast(null), 3000);
  }

  function handleAddInsumo(payload) {
    const nuevo = { id: uid("p"), ...payload };
    setInsumos((prev) => [...prev, nuevo]);
    notify(`Insumo "${payload.nombre}" agregado.`, "ok");
  }

  function handleDeleteInsumo(id) {
    const ins = insumos.find((i) => i.id === id);
    setInsumos((prev) => prev.filter((i) => i.id !== id));
    setEntradas((prev) => prev.filter((e) => e.insumoId !== id));
    setSalidas((prev) => prev.filter((s) => s.insumoId !== id));
    notify(`Insumo "${ins?.nombre || ""}" eliminado.`, "ok");
  }

  function handleUpdatePunto(id, punto) {
    setInsumos((prev) =>
      prev.map((i) => (i.id === id ? { ...i, puntoReorden: punto } : i)),
    );
  }

  function handleAddEntrada(payload) {
    const nueva = {
      id: uid("e"),
      ...payload,
      costoTotal: payload.cantidad * payload.costoUnitario,
      ts: Date.now(),
    };
    setEntradas((prev) => [...prev, nueva]);
    const ins = insumos.find((i) => i.id === payload.insumoId);
    notify(
      `Entrada registrada: +${fmtCant(payload.cantidad)} ${ins?.unidad} de ${ins?.nombre}.`,
      "ok",
    );
  }

  function handleDeleteEntrada(id) {
    setEntradas((prev) => prev.filter((e) => e.id !== id));
    notify("Entrada de compra eliminada.", "ok");
  }

  function handleAddSalida(payload) {
    const nueva = { id: uid("s"), ...payload, ts: Date.now() };
    setSalidas((prev) => [...prev, nueva]);
    const ins = insumos.find((i) => i.id === payload.insumoId);
    notify(
      `Salida registrada: -${fmtCant(payload.cantidad)} ${ins?.unidad} de ${ins?.nombre}.`,
      "ok",
    );
  }

  function handleDeleteSalida(id) {
    setSalidas((prev) => prev.filter((s) => s.id !== id));
    notify("Salida de consumo eliminada.", "ok");
  }

  const tabs = [
    { id: "dashboard", label: "Dashboard", icon: LayoutDashboard },
    { id: "insumos", label: "Insumos", icon: Package },
    { id: "compras", label: "Compras", icon: ShoppingCart },
    { id: "consumos", label: "Consumos", icon: ClipboardList },
    { id: "historial", label: "Kardex", icon: HistoryIcon },
  ];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-800 text-white">
              <ClipboardList className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight text-slate-900">
                WammaCocina
              </h1>
              <p className="text-xs leading-tight text-slate-500">
                Control de insumos, consumos y mermas
              </p>
            </div>
          </div>
          <div className="hidden items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium text-emerald-700 sm:flex">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Kardex por costo promedio ponderado
          </div>
        </div>
        <nav className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-5 pb-3">
          {tabs.map((t) => (
            <TabButton
              key={t.id}
              active={tab === t.id}
              onClick={() => setTab(t.id)}
              icon={t.icon}
            >
              {t.label}
            </TabButton>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-6xl px-5 py-6">
        {tab === "dashboard" && (
          <DashboardTab insumos={insumos} resumen={resumen} />
        )}
        {tab === "insumos" && (
          <InsumosTab
            insumos={insumos}
            resumen={resumen}
            onAddInsumo={handleAddInsumo}
            onUpdatePunto={handleUpdatePunto}
            onDeleteInsumo={handleDeleteInsumo}
          />
        )}
        {tab === "compras" && (
          <ComprasTab
            insumos={insumos}
            entradas={entradas}
            onAddEntrada={handleAddEntrada}
            onDeleteEntrada={handleDeleteEntrada}
          />
        )}
        {tab === "consumos" && (
          <ConsumosTab
            insumos={insumos}
            salidas={salidas}
            resumen={resumen}
            onAddSalida={handleAddSalida}
            onDeleteSalida={handleDeleteSalida}
          />
        )}
        {tab === "historial" && (
          <HistorialTab insumos={insumos} filas={filas} />
        )}
      </main>

      {toast && (
        <div className="fixed bottom-5 right-5 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-800 shadow-lg">
          {toast.msg}
        </div>
      )}
    </div>
  );
}
