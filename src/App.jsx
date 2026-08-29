import React, { useState, useEffect, useMemo } from "react";
import {
  Package, Wrench, Users, Receipt, Building2, Search, Plus, X, Trash2, Pencil,
  Calendar, Phone, Mail, MapPin, CreditCard, Printer, Tag, ChevronDown, ChevronRight,
  ChevronLeft, AlertCircle, CircleDot, AlertTriangle, FileText, CheckCircle2, Clock,
  Bell, ArrowUpCircle, ArrowDownCircle, ShieldAlert, Loader2, User, Link2, RefreshCw, LogOut, Mail as MailIcon, Lock,
} from "lucide-react";
import { supabase } from "./supabaseClient";

// ---------- Helpers ----------
function uid() { return Math.random().toString(36).slice(2, 10); }
function todayISO() { return new Date().toISOString().slice(0, 10); }
function fmtDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = iso.split("-");
  return `${d}/${m}/${y}`;
}
function fmtMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 2 });
}
function diffDias(iso) {
  const hoy = new Date(todayISO());
  const f = new Date(iso);
  return Math.round((f - hoy) / 86400000);
}
async function fetchDolarOficial() {
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/oficial");
    const json = await res.json();
    if (json && json.venta) return { valor: json.venta, fecha: json.fechaActualizacion || todayISO() };
  } catch (e) {}
  return null;
}
function precioVentaDe(producto, dolarVenta, categorias) {
  const costo = Number(producto?.costoUSD) || 0;
  const categoria = categorias?.find((c) => c.id === producto?.categoriaId);
  const margen = categoria ? (Number(categoria.margen) || 0) : (Number(producto?.margen) || 0);
  return costo * (Number(dolarVenta) || 0) * (1 + margen / 100);
}
// Agrupa ítems de una venta por descripción, apilando los N° de serie de cada uno (para factura/remito)
function agruparItemsVenta(items) {
  const grupos = [];
  const mapa = {};
  items.forEach((it) => {
    if (it.numeroSerie) {
      const key = `serie:${it.descripcion}`;
      if (!mapa[key]) {
        const g = { id: key, descripcion: it.descripcion, series: [], cantidad: 0, precioUnitario: it.precioUnitario, subtotal: 0 };
        mapa[key] = g;
        grupos.push(g);
      }
      mapa[key].series.push(it.numeroSerie);
      mapa[key].cantidad += Number(it.cantidad) || 0;
      mapa[key].subtotal += (Number(it.cantidad) || 0) * (Number(it.precioUnitario) || 0);
    } else {
      grupos.push({ id: it.id, descripcion: it.descripcion, series: [], cantidad: Number(it.cantidad) || 0, precioUnitario: it.precioUnitario, subtotal: (Number(it.cantidad) || 0) * (Number(it.precioUnitario) || 0) });
    }
  });
  return grupos;
}

const ESTADOS_UNIDAD = [
  { value: "disponible", label: "Disponible", color: "#0F6B5C", bg: "#E7F2EF" },
  { value: "vendido", label: "Vendido", color: "#6B6560", bg: "#EEEBE6" },
  { value: "reparacion", label: "En reparación", color: "#C9822C", bg: "#FBF0E1" },
  { value: "baja", label: "Dado de baja", color: "#B23A3A", bg: "#FBEAEA" },
];
function unidadInfo(v) { return ESTADOS_UNIDAD.find((e) => e.value === v) || ESTADOS_UNIDAD[0]; }

const ESTADOS_ORDEN = [
  { value: "reparacion", label: "En reparación", color: "#C9822C", bg: "#FBF0E1" },
  { value: "reparado", label: "Reparado", color: "#0F6B5C", bg: "#E7F2EF" },
  { value: "entregado", label: "Entregado", color: "#6B6560", bg: "#EEEBE6" },
];
function ordenInfo(v) { return ESTADOS_ORDEN.find((e) => e.value === v) || ESTADOS_ORDEN[0]; }

const CONDICIONES_IVA = [
  { value: "consumidor_final", label: "Consumidor Final", factura: "B" },
  { value: "responsable_inscripto", label: "Responsable Inscripto", factura: "A" },
  { value: "monotributista", label: "Monotributista", factura: "C" },
  { value: "exento", label: "Exento", factura: "C" },
];

const EMPTY = { contactos: [], movimientos: [], servicios: [], productos: [], unidades: [], ordenes: [], ventas: [], categorias: [], dolarVenta: 0, dolarFecha: null };

const TABS = [
  { id: "stock", label: "Stock", icon: Package, accent: "#0F6B5C" },
  { id: "reparaciones", label: "Reparaciones", icon: Wrench, accent: "#C9822C" },
  { id: "agenda", label: "Agenda", icon: Users, accent: "#4A5FA8" },
  { id: "facturacion", label: "Facturación", icon: Receipt, accent: "#2E5F8A" },
];

// ---------- Shared UI ----------
function Modal({ title, onClose, children, wide }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,29,31,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 50, overflowY: "auto" }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: wide ? 560 : 420, padding: 20, margin: "auto" }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div className="sg" style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", color: "#A7A29A" }}><X size={18} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}
function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 12.5, color: "#6B6560", marginBottom: 4, fontWeight: 500 }}>{label}</label>
      {children}
    </div>
  );
}
const inputStyle = { width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #E4E2DD", fontSize: 14, boxSizing: "border-box" };
function StatCard({ label, value, accent, bg, active, onClick }) {
  return (
    <div onClick={onClick} style={{ background: bg || "#fff", border: active ? `2px solid ${accent}` : "1px solid #E4E2DD", borderRadius: 10, padding: active ? "9px 11px" : "10px 12px", cursor: onClick ? "pointer" : "default" }}>
      <div className="sg" style={{ fontSize: 20, fontWeight: 700, color: accent }}>{value}</div>
      <div style={{ fontSize: 11.5, color: "#6B6560" }}>{label}</div>
    </div>
  );
}

// Reusable client picker used in Reparaciones and Facturación
function ClienteSelector({ contactos, value, onChange, onCreateContacto }) {
  const [q, setQ] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [nombre, setNombre] = useState("");
  const [dniCuit, setDniCuit] = useState("");
  const [telefono, setTelefono] = useState("");
  const selected = contactos.find((c) => c.id === value);

  const matches = useMemo(() => {
    if (!q.trim()) return [];
    const qq = q.toLowerCase();
    return contactos.filter((c) => c.nombre.toLowerCase().includes(qq) || (c.dniCuit || "").includes(qq)).slice(0, 6);
  }, [q, contactos]);

  if (selected) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#F0EEE9", borderRadius: 8, padding: "8px 10px" }}>
        <User size={14} color="#6B6560" />
        <div style={{ flex: 1, fontSize: 13.5 }}>
          <strong>{selected.nombre}</strong>{selected.dniCuit ? ` · ${selected.dniCuit}` : ""}
        </div>
        <button type="button" onClick={() => onChange(null)} style={{ background: "none", border: "none", color: "#A7A29A", cursor: "pointer" }}><X size={14} /></button>
      </div>
    );
  }

  if (showNew) {
    return (
      <div style={{ border: "1px solid #E4E2DD", borderRadius: 8, padding: 10 }}>
        <input style={{ ...inputStyle, marginBottom: 6 }} placeholder="Nombre" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
          <input style={inputStyle} placeholder="DNI/CUIT" value={dniCuit} onChange={(e) => setDniCuit(e.target.value)} />
          <input style={inputStyle} placeholder="Teléfono" value={telefono} onChange={(e) => setTelefono(e.target.value)} />
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button type="button" onClick={() => {
            if (!nombre.trim()) return;
            const c = onCreateContacto({ tipo: "cliente", nombre: nombre.trim(), dniCuit: dniCuit.trim(), telefono: telefono.trim(), email: "", direccion: "" });
            onChange(c.id);
            setShowNew(false);
          }} style={{ flex: 1, background: "#4A5FA8", color: "#fff", border: "none", borderRadius: 8, padding: "8px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Crear y usar</button>
          <button type="button" onClick={() => setShowNew(false)} style={{ background: "none", border: "1px solid #E4E2DD", borderRadius: 8, padding: "8px 12px", fontSize: 13, cursor: "pointer" }}>Cancelar</button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ position: "relative" }}>
        <Search size={14} style={{ position: "absolute", left: 10, top: 11, color: "#A7A29A" }} />
        <input style={{ ...inputStyle, paddingLeft: 30 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar cliente por nombre o DNI/CUIT…" />
      </div>
      {matches.length > 0 && (
        <div style={{ border: "1px solid #E4E2DD", borderRadius: 8, marginTop: 6, overflow: "hidden" }}>
          {matches.map((c) => (
            <div key={c.id} onClick={() => onChange(c.id)} style={{ padding: "8px 10px", fontSize: 13, cursor: "pointer", borderBottom: "1px solid #EFEDE8" }}>
              <strong>{c.nombre}</strong> {c.dniCuit && <span style={{ color: "#8C8880" }}>· {c.dniCuit}</span>}
            </div>
          ))}
        </div>
      )}
      <button type="button" onClick={() => setShowNew(true)} style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px dashed #D8D5CE", color: "#6B6560", borderRadius: 8, padding: "6px 10px", fontSize: 12.5, cursor: "pointer" }}>
        <Plus size={12} /> Nuevo cliente
      </button>
    </div>
  );
}

// Selector de categorías con alta rápida (usado en el formulario de productos)
function CategoriaSelector({ categorias, value, onChange, onCreateCategoria }) {
  const [showNew, setShowNew] = useState(false);
  const [nombre, setNombre] = useState("");
  const [margen, setMargen] = useState("30");

  if (showNew) {
    return (
      <div style={{ display: "flex", gap: 6 }}>
        <input autoFocus style={{ ...inputStyle, flex: 2 }} placeholder="Nombre de la categoría" value={nombre} onChange={(e) => setNombre(e.target.value)} />
        <input style={{ ...inputStyle, width: 70 }} type="number" value={margen} onChange={(e) => setMargen(e.target.value)} placeholder="% margen" />
        <button type="button" onClick={() => {
          if (!nombre.trim()) return;
          const c = onCreateCategoria(nombre.trim(), margen);
          onChange(c.id);
          setNombre("");
          setShowNew(false);
        }} style={{ background: "#0F6B5C", color: "#fff", border: "none", borderRadius: 8, padding: "0 12px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>Crear</button>
        <button type="button" onClick={() => setShowNew(false)} style={{ background: "none", border: "1px solid #E4E2DD", borderRadius: 8, padding: "0 10px", fontSize: 13, cursor: "pointer" }}>×</button>
      </div>
    );
  }
  return (
    <div style={{ display: "flex", gap: 6 }}>
      <select style={{ ...inputStyle, flex: 1 }} value={value || ""} onChange={(e) => onChange(e.target.value || null)}>
        <option value="">Sin categoría</option>
        {categorias.map((c) => <option key={c.id} value={c.id}>{c.nombre}</option>)}
      </select>
      <button type="button" onClick={() => setShowNew(true)} style={{ display: "flex", alignItems: "center", gap: 4, background: "#EEF5F3", color: "#0F6B5C", border: "1px solid #CFE3DD", borderRadius: 8, padding: "0 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}><Plus size={12} /> Nueva</button>
    </div>
  );
}

function DolarEditor({ valorInicial, onGuardar, onCancelar }) {
  const [valor, setValor] = useState(valorInicial || "");
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(255,255,255,0.08)", borderRadius: 999, padding: "4px 10px" }}>
      <span style={{ color: "#8C8880", fontSize: 11.5 }}>Dólar $</span>
      <input autoFocus type="number" value={valor} onChange={(e) => setValor(e.target.value)} style={{ width: 70, background: "none", border: "none", borderBottom: "1px solid #6B6560", color: "#fff", fontSize: 13, outline: "none" }} />
      <button onClick={() => onGuardar(Number(valor) || 0)} style={{ background: "none", border: "none", color: "#0F6B5C", cursor: "pointer", fontWeight: 700, fontSize: 12 }}>OK</button>
      <button onClick={onCancelar} style={{ background: "none", border: "none", color: "#B7B3AC", cursor: "pointer", fontSize: 12 }}>×</button>
    </div>
  );
}

// ---------- Autenticación ----------
function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) setError("Email o contraseña incorrectos.");
  }

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", background: "#F7F6F3", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=Inter:wght@400;500;600&display=swap'); .sg{font-family:'Space Grotesk',sans-serif;}`}</style>
      <form onSubmit={submit} style={{ background: "#fff", border: "1px solid #E4E2DD", borderRadius: 14, padding: 28, width: "100%", maxWidth: 340 }}>
        <div className="sg" style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>Sistema de gestión</div>
        <div style={{ fontSize: 13, color: "#8C8880", marginBottom: 18 }}>Ingresá con tu cuenta</div>
        <div style={{ marginBottom: 10, position: "relative" }}>
          <MailIcon size={14} style={{ position: "absolute", left: 10, top: 12, color: "#A7A29A" }} />
          <input style={{ ...inputStyle, paddingLeft: 30 }} type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div style={{ marginBottom: 14, position: "relative" }}>
          <Lock size={14} style={{ position: "absolute", left: 10, top: 12, color: "#A7A29A" }} />
          <input style={{ ...inputStyle, paddingLeft: 30 }} type="password" placeholder="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        {error && <div style={{ color: "#B23A3A", fontSize: 12.5, marginBottom: 10 }}>{error}</div>}
        <button type="submit" disabled={loading} style={{ width: "100%", background: "#1C1D1F", color: "#fff", border: "none", borderRadius: 9, padding: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{loading ? "Ingresando…" : "Ingresar"}</button>
        <div style={{ fontSize: 11.5, color: "#A7A29A", marginTop: 14, textAlign: "center" }}>Los usuarios se crean desde el panel de Supabase (Authentication → Users).</div>
      </form>
    </div>
  );
}

export default function AuthGate() {
  const [session, setSession] = useState(undefined);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => setSession(session));
    return () => sub.subscription.unsubscribe();
  }, []);
  if (session === undefined) return <div style={{ padding: 40, textAlign: "center", color: "#A7A29A" }}>Cargando…</div>;
  if (!session) return <LoginForm />;
  return <SistemaIntegrado session={session} />;
}

// ---------- Root App ----------
function SistemaIntegrado({ session }) {
  const [data, setData] = useState(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saveError, setSaveError] = useState(false);
  const [tab, setTab] = useState("stock");
  const [ventaDraft, setVentaDraft] = useState(null); // prefill from una orden reparada
  const [printPayload, setPrintPayload] = useState(null);

  const [dolarLoading, setDolarLoading] = useState(false);
  const [editandoDolar, setEditandoDolar] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: row } = await supabase.from("estado_sistema").select("data").eq("id", 1).maybeSingle();
      if (row && row.data) setData({ ...EMPTY, ...row.data });
      setLoading(false);
    })();
  }, []);

  async function actualizarDolar(dataActual) {
    setDolarLoading(true);
    const r = await fetchDolarOficial();
    setDolarLoading(false);
    if (r) persist({ ...dataActual, dolarVenta: r.valor, dolarFecha: r.fecha });
  }

  useEffect(() => {
    if (!loading && !data.dolarVenta) actualizarDolar(data);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  function crearCategoria(nombre, margen) {
    const c = { id: uid(), nombre, margen: Number(margen) || 0 };
    persist({ categorias: [...data.categorias, c] });
    return c;
  }
  function editarCategoria(id, patch) {
    persist({ categorias: data.categorias.map((c) => (c.id === id ? { ...c, ...patch } : c)) });
  }
  function eliminarCategoria(id) {
    persist({ categorias: data.categorias.filter((c) => c.id !== id), productos: data.productos.map((p) => (p.categoriaId === id ? { ...p, categoriaId: null } : p)) });
  }

  async function persist(patch) {
    const next = { ...data, ...patch };
    setData(next);
    const { error } = await supabase.from("estado_sistema").upsert({ id: 1, data: next, updated_at: new Date().toISOString() });
    setSaveError(!!error);
  }

  function crearContacto(fields) {
    const c = { id: uid(), ...fields };
    persist({ contactos: [...data.contactos, c] });
    return c;
  }

  function deudaDe(contactoId) {
    return data.movimientos.filter((m) => m.contactoId === contactoId).reduce((acc, m) => acc + (m.tipo === "cargo" ? m.monto : -m.monto), 0);
  }

  function irAFacturarDesdeOrden(orden) {
    setVentaDraft({
      tipoComprobante: "factura",
      contactoId: orden.contactoId,
      origenOrdenId: orden.id,
      items: [{ id: uid(), tipo: "libre", descripcion: `Reparación: ${orden.producto} (${orden.numeroSerie})`, cantidad: 1, precioUnitario: "" }],
    });
    setTab("facturacion");
  }

  function imprimir(payload) {
    setPrintPayload(payload);
    setTimeout(() => window.print(), 80);
  }

  function registrarVenta(venta) {
    // 1) guardar venta
    const numero = `${venta.tipoComprobante === "factura" ? "FC-" + (CONDICIONES_IVA.find((c) => c.value === venta.condicionIva)?.factura || "B") : "RM"}-${String(Math.floor(Math.random() * 90000) + 10000)}`;
    const ventaFinal = { id: uid(), numero, fecha: todayISO(), estadoAfip: venta.tipoComprobante === "factura" ? "pendiente_afip" : "no_aplica", ...venta };

    // 2) marcar unidades vendidas (productos con control por número de serie)
    const unidadesIds = venta.items.filter((it) => it.tipo === "stock" && it.unidadId).map((it) => it.unidadId);
    const nextUnidades = data.unidades.map((u) => (unidadesIds.includes(u.id) ? { ...u, estado: "vendido" } : u));

    // 2b) descontar cantidad de productos sin control por número de serie
    const descuentos = {};
    venta.items.filter((it) => it.tipo === "stock" && it.productId && !it.unidadId).forEach((it) => {
      descuentos[it.productId] = (descuentos[it.productId] || 0) + (Number(it.cantidad) || 0);
    });
    const nextProductos = data.productos.map((p) => (descuentos[p.id] ? { ...p, cantidadStock: Math.max(0, (Number(p.cantidadStock) || 0) - descuentos[p.id]) } : p));

    // 3) generar cargo en cuenta corriente si no está cobrada en el acto
    let nextMovimientos = data.movimientos;
    if (!venta.pagada && venta.contactoId) {
      nextMovimientos = [...data.movimientos, { id: uid(), contactoId: venta.contactoId, fecha: todayISO(), concepto: `${venta.tipoComprobante === "factura" ? "Factura" : "Remito"} ${numero}`, monto: venta.total, tipo: "cargo" }];
    }

    // 4) si viene de una orden de reparación, marcarla entregada y vincular
    let nextOrdenes = data.ordenes;
    if (venta.origenOrdenId) {
      nextOrdenes = data.ordenes.map((o) => (o.id === venta.origenOrdenId ? { ...o, estado: "entregado", ventaId: ventaFinal.id } : o));
    }

    persist({ ventas: [ventaFinal, ...data.ventas], unidades: nextUnidades, productos: nextProductos, movimientos: nextMovimientos, ordenes: nextOrdenes });
    setVentaDraft(null);
    return ventaFinal;
  }

  const activeTabInfo = TABS.find((t) => t.id === tab);

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", background: "#F7F6F3", minHeight: "100%", color: "#1C1D1F" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');
        .sg { font-family: 'Space Grotesk', sans-serif; }
        .mono { font-family: 'JetBrains Mono', ui-monospace, monospace; }
        input, select { font-family: inherit; }
        ::placeholder { color: #A7A29A; }
        .spin { animation: spin 0.8s linear infinite; }
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @media print {
          body * { visibility: hidden; }
          #print-area, #print-area * { visibility: visible; }
          #print-area { position: absolute; top: 0; left: 0; width: 100%; padding: 20px; }
          .no-print { display: none !important; }
        }
      `}</style>
      <div id="print-area" style={{ position: "absolute", left: -9999, top: 0, width: 700 }}>
        <PrintArea payload={printPayload} />
      </div>

      <div className="no-print" style={{ background: "#1C1D1F", padding: "16px 24px" }}>
        <div style={{ maxWidth: 1000, margin: "0 auto" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
            <div className="sg" style={{ color: "#fff", fontSize: 17, fontWeight: 700, letterSpacing: -0.3 }}>Sistema de gestión</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              {saveError && <div style={{ color: "#E5A15E", fontSize: 12 }}>No se pudo guardar</div>}
              {editandoDolar ? (
                <DolarEditor
                  valorInicial={data.dolarVenta}
                  onCancelar={() => setEditandoDolar(false)}
                  onGuardar={(v) => { persist({ dolarVenta: v, dolarFecha: todayISO() }); setEditandoDolar(false); }}
                />
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "rgba(255,255,255,0.08)", borderRadius: 999, padding: "5px 12px" }}>
                  <span style={{ color: "#8C8880", fontSize: 11.5 }}>Dólar oficial venta</span>
                  <span className="sg" style={{ color: "#fff", fontSize: 13.5, fontWeight: 700 }}>{data.dolarVenta ? fmtMoney(data.dolarVenta) : "—"}</span>
                  <button onClick={() => actualizarDolar(data)} disabled={dolarLoading} title="Actualizar" style={{ background: "none", border: "none", color: "#B7B3AC", cursor: "pointer", display: "flex" }}><RefreshCw size={12} className={dolarLoading ? "spin" : ""} /></button>
                  <button onClick={() => setEditandoDolar(true)} title="Editar manualmente" style={{ background: "none", border: "none", color: "#B7B3AC", cursor: "pointer", display: "flex" }}><Pencil size={12} /></button>
                </div>
              )}
              <span style={{ color: "#8C8880", fontSize: 12 }}>{session?.user?.email}</span>
              <button onClick={() => supabase.auth.signOut()} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px solid #3A3B3D", color: "#B7B3AC", borderRadius: 8, padding: "5px 10px", fontSize: 12, cursor: "pointer" }}><LogOut size={13} /> Salir</button>
            </div>
          </div>
          <div style={{ display: "flex", gap: 6 }}>
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button key={t.id} onClick={() => setTab(t.id)} style={{
                  display: "flex", alignItems: "center", gap: 6, padding: "8px 14px", borderRadius: 9,
                  border: "none", cursor: "pointer", fontSize: 13.5, fontWeight: 600,
                  background: active ? t.accent : "rgba(255,255,255,0.08)", color: active ? "#fff" : "#B7B3AC",
                }}>
                  <Icon size={15} /> {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "24px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: 40, color: "#A7A29A" }}>Cargando…</div>
        ) : tab === "stock" ? (
          <TabStock data={data} persist={persist} imprimir={imprimir} crearCategoria={crearCategoria} editarCategoria={editarCategoria} eliminarCategoria={eliminarCategoria} />
        ) : tab === "reparaciones" ? (
          <TabReparaciones data={data} persist={persist} crearContacto={crearContacto} irAFacturar={irAFacturarDesdeOrden} imprimir={imprimir} />
        ) : tab === "agenda" ? (
          <TabAgenda data={data} persist={persist} deudaDe={deudaDe} imprimir={imprimir} />
        ) : (
          <TabFacturacion data={data} persist={persist} crearContacto={crearContacto} registrarVenta={registrarVenta} draft={ventaDraft} clearDraft={() => setVentaDraft(null)} imprimir={imprimir} />
        )}
      </div>
    </div>
  );
}

// ---------- TAB: STOCK ----------
function TabStock({ data, persist, imprimir, crearCategoria, editarCategoria, eliminarCategoria }) {
  const { productos, unidades, categorias, dolarVenta } = data;
  const [showCategorias, setShowCategorias] = useState(false);
  const [query, setQuery] = useState("");
  const [expanded, setExpanded] = useState({});
  const [showProductForm, setShowProductForm] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [unitFormFor, setUnitFormFor] = useState(null);
  const [editingUnit, setEditingUnit] = useState(null);

  function saveProduct(fields) {
    if (editingProduct) persist({ productos: productos.map((p) => (p.id === editingProduct.id ? { ...p, ...fields } : p)) });
    else persist({ productos: [...productos, { id: uid(), ...fields }] });
    setShowProductForm(false); setEditingProduct(null);
  }
  function deleteProduct(id) {
    persist({ productos: productos.filter((p) => p.id !== id), unidades: unidades.filter((u) => u.productId !== id) });
  }
  function saveUnit(productId, fields) {
    if (editingUnit) persist({ unidades: unidades.map((u) => (u.id === editingUnit.id ? { ...u, ...fields } : u)) });
    else persist({ unidades: [...unidades, { id: uid(), productId, ...fields }] });
    setUnitFormFor(null); setEditingUnit(null);
  }
  function deleteUnit(id) { persist({ unidades: unidades.filter((u) => u.id !== id) }); }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return productos;
    const catNombre = (p) => categorias.find((c) => c.id === p.categoriaId)?.nombre || "";
    return productos.filter((p) => p.nombre.toLowerCase().includes(q) || catNombre(p).toLowerCase().includes(q) || unidades.some((u) => u.productId === p.id && u.numeroSerie.toLowerCase().includes(q)));
  }, [productos, unidades, query]);

  const stats = useMemo(() => {
    const byStatus = { disponible: 0, vendido: 0, reparacion: 0, baja: 0 };
    unidades.forEach((u) => { byStatus[u.estado] = (byStatus[u.estado] || 0) + 1; });
    return { totalProductos: productos.length, totalUnidades: unidades.length, byStatus };
  }, [productos, unidades]);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
        <StatCard label="Productos" value={stats.totalProductos} accent="#1C1D1F" />
        <StatCard label="Unidades totales" value={stats.totalUnidades} accent="#1C1D1F" />
        {ESTADOS_UNIDAD.map((e) => <StatCard key={e.value} label={e.label} value={stats.byStatus[e.value] || 0} accent={e.color} bg={e.bg} />)}
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "#A7A29A" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por producto, categoría o número de serie…" style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: "1px solid #E4E2DD", background: "#fff", fontSize: 14, boxSizing: "border-box" }} />
        </div>
        <button onClick={() => imprimir({ tipo: "inventario", productos: filtered, unidades, categorias, dolarVenta })} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", color: "#1C1D1F", border: "1px solid #E4E2DD", borderRadius: 10, padding: "0 14px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}><Printer size={15} /> Imprimir</button>
        <button onClick={() => setShowCategorias(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#fff", color: "#1C1D1F", border: "1px solid #E4E2DD", borderRadius: 10, padding: "0 14px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}><Tag size={15} /> Categorías</button>
        <button onClick={() => { setEditingProduct(null); setShowProductForm(true); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "#0F6B5C", color: "#fff", border: "none", borderRadius: 10, padding: "0 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}><Plus size={16} /> Producto</button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 20px", background: "#fff", border: "1px dashed #E4E2DD", borderRadius: 12 }}>
          <Package size={28} color="#A7A29A" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14, color: "#6B6560" }}>{productos.length === 0 ? "Todavía no cargaste ningún producto." : "No hay resultados."}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((p) => {
            const us = unidades.filter((u) => u.productId === p.id);
            const disp = us.filter((u) => u.estado === "disponible").length;
            const exp = !!expanded[p.id];
            return (
              <div key={p.id} style={{ background: "#fff", border: "1px solid #E4E2DD", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "13px 14px", cursor: p.controlSerie === false ? "default" : "pointer" }} onClick={() => { if (p.controlSerie !== false) setExpanded((s) => ({ ...s, [p.id]: !s[p.id] })); }}>
                  {p.controlSerie === false ? <span style={{ width: 18 }} /> : <button style={{ background: "none", border: "none", cursor: "pointer", color: "#A7A29A", padding: 0 }}>{exp ? <ChevronDown size={18} /> : <ChevronRight size={18} />}</button>}
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <span className="sg" style={{ fontWeight: 600, fontSize: 15 }}>{p.nombre}</span>
                      {p.categoriaId && categorias.find((c) => c.id === p.categoriaId) && <span style={{ fontSize: 11, color: "#6B6560", background: "#F0EEE9", padding: "2px 8px", borderRadius: 999, display: "flex", alignItems: "center", gap: 4 }}><Tag size={10} /> {categorias.find((c) => c.id === p.categoriaId).nombre}</span>}
                    </div>
                    <div style={{ fontSize: 12, color: "#8C8880", marginTop: 2 }}>
                      {p.controlSerie === false ? `${p.cantidadStock || 0} en stock` : `${us.length} unidad${us.length !== 1 ? "es" : ""} · ${disp} disponible${disp !== 1 ? "s" : ""}`} · costo U$D {p.costoUSD || 0}
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <div className="sg" style={{ fontSize: 15, fontWeight: 700 }}>{fmtMoney(precioVentaDe(p, dolarVenta, categorias))}</div>
                    <div style={{ fontSize: 10.5, color: "#A7A29A" }}>precio de venta</div>
                  </div>
                  <button onClick={(e) => { e.stopPropagation(); setEditingProduct(p); setShowProductForm(true); }} style={{ background: "none", border: "none", color: "#A7A29A", cursor: "pointer", padding: 6 }}><Pencil size={15} /></button>
                  <button onClick={(e) => { e.stopPropagation(); if (confirm(`¿Eliminar "${p.nombre}"?`)) deleteProduct(p.id); }} style={{ background: "none", border: "none", color: "#C97B7B", cursor: "pointer", padding: 6 }}><Trash2 size={15} /></button>
                </div>
                {p.controlSerie === false ? (
                  <div style={{ borderTop: "1px solid #EFEDE8", padding: "10px 14px", display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontSize: 12.5, color: "#6B6560" }}>Cantidad en stock:</span>
                    <button onClick={() => persist({ productos: productos.map((x) => (x.id === p.id ? { ...x, cantidadStock: Math.max(0, (Number(x.cantidadStock) || 0) - 1) } : x)) })} style={{ background: "#F0EEE9", border: "none", borderRadius: 6, width: 24, height: 24, cursor: "pointer", fontWeight: 700 }}>−</button>
                    <span className="sg" style={{ fontWeight: 700, fontSize: 14, minWidth: 24, textAlign: "center" }}>{p.cantidadStock || 0}</span>
                    <button onClick={() => persist({ productos: productos.map((x) => (x.id === p.id ? { ...x, cantidadStock: (Number(x.cantidadStock) || 0) + 1 } : x)) })} style={{ background: "#F0EEE9", border: "none", borderRadius: 6, width: 24, height: 24, cursor: "pointer", fontWeight: 700 }}>+</button>
                    {p.numeroSerieUnico && <span className="mono" style={{ fontSize: 12, background: "#FAFAF8", border: "1px dashed #D8D5CE", borderRadius: 6, padding: "3px 8px", marginLeft: 6 }}>{p.numeroSerieUnico}</span>}
                  </div>
                ) : exp && (
                  <div style={{ borderTop: "1px solid #EFEDE8", padding: "10px 14px 14px" }}>
                    {us.length === 0 ? <div style={{ fontSize: 13, color: "#A7A29A", marginBottom: 10 }}>Sin unidades cargadas.</div> : (
                      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 10 }}>
                        {us.map((u) => {
                          const info = unidadInfo(u.estado);
                          return (
                            <div key={u.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 10px", background: "#FAFAF8", borderRadius: 8 }}>
                              <span className="mono" style={{ fontSize: 12.5, background: "#fff", border: "1px dashed #D8D5CE", borderRadius: 6, padding: "3px 8px" }}>{u.numeroSerie}</span>
                              <span style={{ fontSize: 12, color: "#8C8880", display: "flex", alignItems: "center", gap: 4 }}><Calendar size={11} /> {fmtDate(u.fechaIngreso)}</span>
                              <span style={{ fontSize: 11.5, color: info.color, background: info.bg, padding: "3px 9px", borderRadius: 999, fontWeight: 600, display: "flex", alignItems: "center", gap: 4 }}><CircleDot size={10} /> {info.label}</span>
                              <span style={{ flex: 1 }} />
                              <button onClick={() => { setEditingUnit(u); setUnitFormFor(p.id); }} style={{ background: "none", border: "none", color: "#A7A29A", cursor: "pointer", padding: 4 }}><Pencil size={13} /></button>
                              <button onClick={() => { if (confirm("¿Eliminar esta unidad?")) deleteUnit(u.id); }} style={{ background: "none", border: "none", color: "#C97B7B", cursor: "pointer", padding: 4 }}><Trash2 size={13} /></button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <button onClick={() => { setEditingUnit(null); setUnitFormFor(p.id); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "#EEF5F3", color: "#0F6B5C", border: "1px solid #CFE3DD", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}><Plus size={13} /> Agregar número de serie</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showProductForm && (
        <Modal title={editingProduct ? "Editar producto" : "Nuevo producto"} onClose={() => { setShowProductForm(false); setEditingProduct(null); }}>
          <ProductForm initial={editingProduct} onSave={saveProduct} categorias={categorias} crearCategoria={crearCategoria} dolarVenta={dolarVenta} />
        </Modal>
      )}
      {unitFormFor && (
        <Modal title={editingUnit ? "Editar unidad" : "Nueva unidad / N° de serie"} onClose={() => { setUnitFormFor(null); setEditingUnit(null); }}>
          <UnitForm initial={editingUnit} onSave={(f) => saveUnit(unitFormFor, f)} />
        </Modal>
      )}
      {showCategorias && (
        <Modal title="Categorías" onClose={() => setShowCategorias(false)} wide>
          <CategoriasModal categorias={categorias} onCrear={crearCategoria} onEditar={editarCategoria} onEliminar={eliminarCategoria} />
        </Modal>
      )}
    </div>
  );
}
function CategoriasModal({ categorias, onCrear, onEditar, onEliminar }) {
  const [nombre, setNombre] = useState("");
  const [margen, setMargen] = useState("30");
  return (
    <div>
      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
        {categorias.length === 0 && <div style={{ fontSize: 13, color: "#A7A29A" }}>Todavía no hay categorías cargadas.</div>}
        {categorias.map((c) => (
          <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#FAFAF8", borderRadius: 8, padding: "8px 10px" }}>
            <span style={{ flex: 1, fontSize: 13.5 }}>{c.nombre}</span>
            <input type="number" defaultValue={c.margen} onBlur={(e) => onEditar(c.id, { margen: Number(e.target.value) || 0 })} style={{ ...inputStyle, width: 70, padding: "6px 8px" }} />
            <span style={{ fontSize: 12, color: "#8C8880" }}>% margen</span>
            <button onClick={() => { if (confirm(`¿Eliminar la categoría "${c.nombre}"?`)) onEliminar(c.id); }} style={{ background: "none", border: "none", color: "#C97B7B", cursor: "pointer" }}><Trash2 size={14} /></button>
          </div>
        ))}
      </div>
      <div style={{ display: "flex", gap: 8, alignItems: "flex-end", borderTop: "1px solid #EFEDE8", paddingTop: 12 }}>
        <div style={{ flex: 1 }}><Field label="Nueva categoría"><input style={inputStyle} value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field></div>
        <div style={{ width: 90 }}><Field label="% margen"><input style={inputStyle} type="number" value={margen} onChange={(e) => setMargen(e.target.value)} /></Field></div>
        <button onClick={() => { if (!nombre.trim()) return; onCrear(nombre.trim(), margen); setNombre(""); setMargen("30"); }} style={{ background: "#0F6B5C", color: "#fff", border: "none", borderRadius: 8, padding: "9px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", marginBottom: 12 }}>Agregar</button>
      </div>
    </div>
  );
}
function ProductForm({ initial, onSave, categorias, crearCategoria, dolarVenta }) {
  const [nombre, setNombre] = useState(initial?.nombre || "");
  const [categoriaId, setCategoriaId] = useState(initial?.categoriaId || null);
  const [costoUSD, setCostoUSD] = useState(initial?.costoUSD ?? "");
  const [margenPropio, setMargenPropio] = useState(initial?.margen ?? "30");
  const [controlSerie, setControlSerie] = useState(initial?.controlSerie ?? true);
  const [cantidadStock, setCantidadStock] = useState(initial?.cantidadStock ?? "0");
  const [numeroSerieUnico, setNumeroSerieUnico] = useState(initial?.numeroSerieUnico || "");
  const [descripcion, setDescripcion] = useState(initial?.descripcion || "");

  const categoria = categorias.find((c) => c.id === categoriaId);
  const margenEfectivo = categoria ? (Number(categoria.margen) || 0) : (Number(margenPropio) || 0);
  const precioVenta = (Number(costoUSD) || 0) * (Number(dolarVenta) || 0) * (1 + margenEfectivo / 100);

  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!nombre.trim()) return; onSave({ nombre: nombre.trim(), categoriaId, costoUSD: Number(costoUSD) || 0, margen: categoria ? null : (Number(margenPropio) || 0), controlSerie, cantidadStock: controlSerie ? null : (Number(cantidadStock) || 0), numeroSerieUnico: controlSerie ? "" : numeroSerieUnico.trim(), descripcion: descripcion.trim() }); }}>
      <Field label="Nombre del producto"><input autoFocus style={inputStyle} value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field>
      <Field label="Categoría"><CategoriaSelector categorias={categorias} value={categoriaId} onChange={setCategoriaId} onCreateCategoria={crearCategoria} /></Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}>
          <Field label="Costo (U$D)"><input style={inputStyle} type="number" value={costoUSD} onChange={(e) => setCostoUSD(e.target.value)} placeholder="0" /></Field>
        </div>
        <div style={{ flex: 1 }}>
          {categoria ? (
            <Field label="Margen de ganancia (%)"><div style={{ ...inputStyle, background: "#F0EEE9", color: "#6B6560" }}>{categoria.margen}% (de "{categoria.nombre}")</div></Field>
          ) : (
            <Field label="Margen de ganancia (%)"><input style={inputStyle} type="number" value={margenPropio} onChange={(e) => setMargenPropio(e.target.value)} placeholder="30" /></Field>
          )}
        </div>
      </div>
      <div style={{ background: "#FAFAF8", borderRadius: 8, padding: "8px 12px", marginBottom: 12, fontSize: 13 }}>
        Precio de venta (con dólar a {fmtMoney(dolarVenta)}): <strong className="sg">{fmtMoney(precioVenta)}</strong>
      </div>
      <Field label="¿Controla por número de serie?">
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => setControlSerie(true)} style={{ flex: 1, padding: 8, borderRadius: 8, border: controlSerie ? "2px solid #0F6B5C" : "1px solid #E4E2DD", background: controlSerie ? "#E7F2EF" : "#fff", color: controlSerie ? "#0F6B5C" : "#6B6560", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Sí, por N° de serie</button>
          <button type="button" onClick={() => setControlSerie(false)} style={{ flex: 1, padding: 8, borderRadius: 8, border: !controlSerie ? "2px solid #0F6B5C" : "1px solid #E4E2DD", background: !controlSerie ? "#E7F2EF" : "#fff", color: !controlSerie ? "#0F6B5C" : "#6B6560", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>No, solo cantidad</button>
        </div>
      </Field>
      {!controlSerie && (
        <div style={{ display: "flex", gap: 10 }}>
          <div style={{ flex: 1 }}>
            <Field label="Número de serie (opcional)"><input className="mono" style={inputStyle} value={numeroSerieUnico} onChange={(e) => setNumeroSerieUnico(e.target.value)} placeholder="Ej: LOTE-2026-04" /></Field>
          </div>
          <div style={{ flex: 1 }}>
            <Field label="Cantidad en stock"><input style={inputStyle} type="number" value={cantidadStock} onChange={(e) => setCantidadStock(e.target.value)} /></Field>
          </div>
        </div>
      )}
      <Field label="Descripción (opcional)"><textarea style={{ ...inputStyle, minHeight: 60 }} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></Field>
      <button type="submit" style={{ width: "100%", background: "#0F6B5C", color: "#fff", border: "none", borderRadius: 9, padding: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{initial ? "Guardar cambios" : "Crear producto"}</button>
    </form>
  );
}
function UnitForm({ initial, onSave }) {
  const [numeroSerie, setNumeroSerie] = useState(initial?.numeroSerie || "");
  const [fechaIngreso, setFechaIngreso] = useState(initial?.fechaIngreso || todayISO());
  const [estado, setEstado] = useState(initial?.estado || "disponible");
  const [notas, setNotas] = useState(initial?.notas || "");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!numeroSerie.trim()) return; onSave({ numeroSerie: numeroSerie.trim(), fechaIngreso, estado, notas: notas.trim() }); }}>
      <Field label="Número de serie"><input autoFocus className="mono" style={inputStyle} value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} /></Field>
      <Field label="Fecha de ingreso"><input style={inputStyle} type="date" value={fechaIngreso} onChange={(e) => setFechaIngreso(e.target.value)} /></Field>
      <Field label="Estado"><select style={inputStyle} value={estado} onChange={(e) => setEstado(e.target.value)}>{ESTADOS_UNIDAD.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}</select></Field>
      <Field label="Notas (opcional)"><input style={inputStyle} value={notas} onChange={(e) => setNotas(e.target.value)} /></Field>
      <button type="submit" style={{ width: "100%", background: "#0F6B5C", color: "#fff", border: "none", borderRadius: 9, padding: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{initial ? "Guardar cambios" : "Agregar unidad"}</button>
    </form>
  );
}

// ---------- TAB: REPARACIONES ----------
function TabReparaciones({ data, persist, crearContacto, irAFacturar, imprimir }) {
  const { ordenes, contactos } = data;
  const [query, setQuery] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("todos");
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  function siguienteNumeroOrden() {
    const max = ordenes.reduce((acc, o) => {
      const n = parseInt((o.numero || "").replace(/\D/g, ""), 10);
      return Number.isFinite(n) && n > acc ? n : acc;
    }, 0);
    return `OR-${String(max + 1).padStart(5, "0")}`;
  }

  function save(fields) {
    if (editing) persist({ ordenes: ordenes.map((o) => (o.id === editing.id ? { ...o, ...fields } : o)) });
    else persist({ ordenes: [...ordenes, { id: uid(), numero: siguienteNumeroOrden(), estado: "reparacion", ventaId: null, ...fields }] });
    setShowForm(false); setEditing(null);
  }
  function remove(id) { persist({ ordenes: ordenes.filter((o) => o.id !== id) }); }
  function setEstado(id, estado) {
    persist({ ordenes: ordenes.map((o) => (o.id === id ? { ...o, estado, fechaReparado: estado === "reparado" ? todayISO() : o.fechaReparado } : o)) });
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return ordenes.filter((o) => {
      if (filtroEstado !== "todos" && o.estado !== filtroEstado) return false;
      const contacto = contactos.find((c) => c.id === o.contactoId);
      if (!q) return true;
      return (contacto?.nombre || "").toLowerCase().includes(q) || o.producto.toLowerCase().includes(q) || o.numeroSerie.toLowerCase().includes(q) || (o.numero || "").toLowerCase().includes(q);
    });
  }, [ordenes, contactos, query, filtroEstado]);

  const stats = useMemo(() => {
    const byStatus = { reparacion: 0, reparado: 0, entregado: 0 };
    ordenes.forEach((o) => { byStatus[o.estado] = (byStatus[o.estado] || 0) + 1; });
    return { total: ordenes.length, byStatus };
  }, [ordenes]);

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10, marginBottom: 20 }}>
        <StatCard label="Órdenes totales" value={stats.total} accent="#1C1D1F" />
        {ESTADOS_ORDEN.map((e) => <StatCard key={e.value} label={e.label} value={stats.byStatus[e.value] || 0} accent={e.color} bg={e.bg} active={filtroEstado === e.value} onClick={() => setFiltroEstado(filtroEstado === e.value ? "todos" : e.value)} />)}
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "#A7A29A" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por cliente, producto o N° de serie…" style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: "1px solid #E4E2DD", background: "#fff", fontSize: 14, boxSizing: "border-box" }} />
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "#C9822C", color: "#fff", border: "none", borderRadius: 10, padding: "0 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}><Plus size={16} /> Orden</button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 20px", background: "#fff", border: "1px dashed #E4E2DD", borderRadius: 12 }}>
          <Wrench size={28} color="#A7A29A" style={{ marginBottom: 10 }} />
          <div style={{ fontSize: 14, color: "#6B6560" }}>{ordenes.length === 0 ? "Todavía no hay órdenes cargadas." : "Sin resultados."}</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map((o) => {
            const contacto = contactos.find((c) => c.id === o.contactoId);
            const info = ordenInfo(o.estado);
            return (
              <div key={o.id} style={{ background: "#fff", border: "1px solid #E4E2DD", borderRadius: 12, padding: 14 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, flexWrap: "wrap" }}>
                  <div style={{ flex: 1, minWidth: 200 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span className="mono" style={{ fontSize: 11.5, color: "#6B6560", background: "#F0EEE9", padding: "2px 8px", borderRadius: 999 }}>{o.numero || "—"}</span>
                      <User size={14} color="#6B6560" />
                      <span className="sg" style={{ fontWeight: 600, fontSize: 15 }}>{contacto?.nombre || "Cliente eliminado"}</span>
                      {contacto?.dniCuit && <span style={{ fontSize: 11.5, color: "#8C8880", display: "flex", alignItems: "center", gap: 3 }}><CreditCard size={11} /> {contacto.dniCuit}</span>}
                      {contacto?.telefono && <span style={{ fontSize: 11.5, color: "#8C8880", display: "flex", alignItems: "center", gap: 3 }}><Phone size={11} /> {contacto.telefono}</span>}
                    </div>
                    <div style={{ fontSize: 13.5, marginBottom: 4 }}><strong>{o.producto}</strong> <span className="mono" style={{ fontSize: 12, background: "#FAFAF8", border: "1px dashed #D8D5CE", borderRadius: 6, padding: "2px 6px", marginLeft: 4 }}>{o.numeroSerie}</span></div>
                    <div style={{ fontSize: 12.5, color: "#8C8880", display: "flex", alignItems: "center", gap: 4, marginBottom: 4 }}><AlertTriangle size={11} /> {o.falla}</div>
                    <div style={{ fontSize: 11.5, color: "#A7A29A", display: "flex", alignItems: "center", gap: 4 }}><Calendar size={11} /> Ingreso: {fmtDate(o.fechaIngreso)}{o.fechaReparado && <> · Reparado: {fmtDate(o.fechaReparado)}</>}</div>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 8 }}>
                    <select value={o.estado} onChange={(e) => setEstado(o.id, e.target.value)} style={{ fontSize: 12.5, fontWeight: 600, color: info.color, background: info.bg, border: "none", borderRadius: 999, padding: "5px 10px", cursor: "pointer" }}>
                      {ESTADOS_ORDEN.map((e) => <option key={e.value} value={e.value}>{e.label}</option>)}
                    </select>
                    <div style={{ display: "flex", gap: 4 }}>
                      <button onClick={() => imprimir({ tipo: "ticket", orden: o, contacto })} title="Imprimir ticket" style={{ background: "none", border: "none", color: "#A7A29A", cursor: "pointer", padding: 4 }}><Printer size={14} /></button>
                      <button onClick={() => { setEditing(o); setShowForm(true); }} style={{ background: "none", border: "none", color: "#A7A29A", cursor: "pointer", padding: 4 }}><Pencil size={14} /></button>
                      <button onClick={() => { if (confirm("¿Eliminar esta orden?")) remove(o.id); }} style={{ background: "none", border: "none", color: "#C97B7B", cursor: "pointer", padding: 4 }}><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
                {(o.estado === "reparado" || o.estado === "entregado") && (
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px solid #EFEDE8" }}>
                    {o.ventaId ? (
                      <div style={{ fontSize: 12.5, color: "#0F6B5C", display: "flex", alignItems: "center", gap: 5 }}><CheckCircle2 size={14} /> Comprobante generado en Facturación</div>
                    ) : (
                      <button onClick={() => irAFacturar(o)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#EEF5F3", color: "#0F6B5C", border: "1px solid #CFE3DD", borderRadius: 8, padding: "6px 12px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}><Link2 size={13} /> Generar factura o remito</button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {showForm && (
        <Modal title={editing ? "Editar orden" : "Nueva orden de reparación"} onClose={() => { setShowForm(false); setEditing(null); }} wide>
          <OrdenForm initial={editing} contactos={contactos} crearContacto={crearContacto} onSave={save} />
        </Modal>
      )}
    </div>
  );
}
function OrdenForm({ initial, contactos, crearContacto, onSave }) {
  const [contactoId, setContactoId] = useState(initial?.contactoId || null);
  const [producto, setProducto] = useState(initial?.producto || "");
  const [numeroSerie, setNumeroSerie] = useState(initial?.numeroSerie || "");
  const [falla, setFalla] = useState(initial?.falla || "");
  const [fechaIngreso, setFechaIngreso] = useState(initial?.fechaIngreso || todayISO());
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!contactoId || !producto.trim()) return; onSave({ contactoId, producto: producto.trim(), numeroSerie: numeroSerie.trim(), falla: falla.trim(), fechaIngreso }); }}>
      <Field label="Cliente"><ClienteSelector contactos={contactos} value={contactoId} onChange={setContactoId} onCreateContacto={crearContacto} /></Field>
      <Field label="Producto que deja"><input style={inputStyle} value={producto} onChange={(e) => setProducto(e.target.value)} placeholder="Ej: Amoladora angular 4 1/2" /></Field>
      <Field label="Número de serie"><input className="mono" style={inputStyle} value={numeroSerie} onChange={(e) => setNumeroSerie(e.target.value)} placeholder="SN-00231A" /></Field>
      <Field label="Falla reportada"><textarea style={{ ...inputStyle, minHeight: 60 }} value={falla} onChange={(e) => setFalla(e.target.value)} /></Field>
      <Field label="Fecha de ingreso"><input style={inputStyle} type="date" value={fechaIngreso} onChange={(e) => setFechaIngreso(e.target.value)} /></Field>
      <button type="submit" style={{ width: "100%", background: "#C9822C", color: "#fff", border: "none", borderRadius: 9, padding: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{initial ? "Guardar cambios" : "Crear orden"}</button>
    </form>
  );
}

// ---------- TAB: AGENDA ----------
function TabAgenda({ data, persist, deudaDe, imprimir }) {
  const { contactos, movimientos, servicios, ordenes, ventas } = data;
  const [query, setQuery] = useState("");
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [selectedId, setSelectedId] = useState(null);
  const [showContactForm, setShowContactForm] = useState(false);
  const [editingContact, setEditingContact] = useState(null);
  const [showMovForm, setShowMovForm] = useState(false);
  const [showServForm, setShowServForm] = useState(false);

  function saveContact(fields) {
    if (editingContact) persist({ contactos: contactos.map((c) => (c.id === editingContact.id ? { ...c, ...fields } : c)) });
    else { const c = { id: uid(), ...fields }; persist({ contactos: [...contactos, c] }); setSelectedId(c.id); }
    setShowContactForm(false); setEditingContact(null);
  }
  function deleteContact(id) {
    persist({ contactos: contactos.filter((c) => c.id !== id), movimientos: movimientos.filter((m) => m.contactoId !== id), servicios: servicios.filter((s) => s.contactoId !== id) });
    if (selectedId === id) setSelectedId(null);
  }
  function addMov(contactoId, fields) { persist({ movimientos: [...movimientos, { id: uid(), contactoId, fecha: todayISO(), ...fields }] }); setShowMovForm(false); }
  function deleteMov(id) { persist({ movimientos: movimientos.filter((m) => m.id !== id) }); }
  function addServ(contactoId, fields) { persist({ servicios: [...servicios, { id: uid(), contactoId, estado: "pendiente", ...fields }] }); setShowServForm(false); }
  function toggleServ(id) { persist({ servicios: servicios.map((s) => (s.id === id ? { ...s, estado: s.estado === "pendiente" ? "realizado" : "pendiente" } : s)) }); }
  function deleteServ(id) { persist({ servicios: servicios.filter((s) => s.id !== id) }); }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return contactos.filter((c) => {
      if (filtroTipo !== "todos" && c.tipo !== filtroTipo) return false;
      if (!q) return true;
      return c.nombre.toLowerCase().includes(q) || (c.dniCuit || "").includes(q);
    });
  }, [contactos, query, filtroTipo]);

  const proximosServicios = useMemo(() => {
    return servicios.filter((s) => s.estado === "pendiente").map((s) => ({ ...s, dias: diffDias(s.fecha), contacto: contactos.find((c) => c.id === s.contactoId) })).filter((s) => s.contacto && s.dias <= (s.avisoDias || 0)).sort((a, b) => a.dias - b.dias);
  }, [servicios, contactos]);

  const selected = contactos.find((c) => c.id === selectedId);

  if (selected) {
    const misOrdenes = ordenes.filter((o) => o.contactoId === selected.id);
    const misVentas = ventas.filter((v) => v.contactoId === selected.id);
    const misMovs = movimientos.filter((m) => m.contactoId === selected.id);
    const misServ = servicios.filter((s) => s.contactoId === selected.id);
    const deuda = deudaDe(selected.id);
    return (
      <div>
        <button onClick={() => setSelectedId(null)} className="no-print" style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#6B6560", cursor: "pointer", fontSize: 13.5, marginBottom: 12 }}><ChevronLeft size={16} /> Volver</button>

        <div style={{ background: "#fff", border: "1px solid #E4E2DD", borderRadius: 12, padding: 16, marginBottom: 16, display: "flex", flexWrap: "wrap", gap: 16, alignItems: "center" }}>
          <div>
            <div className="sg" style={{ fontSize: 17, fontWeight: 700 }}>{selected.nombre}</div>
            <div style={{ fontSize: 12, color: "#8C8880" }}>{selected.tipo === "empresa" ? "Empresa" : "Cliente"}</div>
            <div style={{ fontSize: 12.5, color: "#6B6560", marginTop: 6, display: "flex", flexDirection: "column", gap: 3 }}>
              {selected.dniCuit && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><CreditCard size={12} />{selected.dniCuit}</span>}
              {selected.telefono && <span style={{ display: "flex", alignItems: "center", gap: 5 }}><Phone size={12} />{selected.telefono}</span>}
            </div>
          </div>
          <div style={{ marginLeft: "auto", textAlign: "right" }}>
            <div className="sg" style={{ fontSize: 22, fontWeight: 700, color: deuda > 0 ? "#B23A3A" : deuda < 0 ? "#0F6B5C" : "#6B6560" }}>{fmtMoney(deuda)}</div>
            <div style={{ fontSize: 11, color: "#A7A29A" }}>{deuda > 0 ? "saldo adeudado" : deuda < 0 ? "saldo a favor" : "cuenta al día"}</div>
          </div>
          <div className="no-print" style={{ display: "flex", gap: 6 }}>
            <button onClick={() => { setEditingContact(selected); setShowContactForm(true); }} style={{ background: "none", border: "1px solid #E4E2DD", color: "#6B6560", borderRadius: 8, padding: "6px 10px", cursor: "pointer" }}><Pencil size={14} /></button>
            <button onClick={() => imprimir({ tipo: "cuenta", contacto: selected, movimientos: misMovs, deuda })} style={{ background: "#1C1D1F", border: "none", color: "#fff", borderRadius: 8, padding: "6px 10px", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontSize: 12.5 }}><Printer size={14} /> Imprimir cuenta</button>
          </div>
        </div>

        <SectionTitle title="Cuenta corriente" onAdd={() => setShowMovForm(true)} addLabel="Movimiento" />
        <ListBox empty="Sin movimientos registrados.">
          {misMovs.slice().reverse().map((m, i) => (
            <RowItem key={m.id} first={i === 0}>
              {m.tipo === "cargo" ? <ArrowUpCircle size={15} color="#B23A3A" /> : <ArrowDownCircle size={15} color="#0F6B5C" />}
              <div style={{ flex: 1 }}><div style={{ fontSize: 13.5 }}>{m.concepto}</div><div style={{ fontSize: 11, color: "#A7A29A" }}>{fmtDate(m.fecha)}</div></div>
              <div className="sg" style={{ fontWeight: 700, fontSize: 13.5, color: m.tipo === "cargo" ? "#B23A3A" : "#0F6B5C" }}>{m.tipo === "cargo" ? "+" : "−"}{fmtMoney(m.monto)}</div>
              <button onClick={() => deleteMov(m.id)} className="no-print" style={{ background: "none", border: "none", color: "#C97B7B", cursor: "pointer" }}><Trash2 size={13} /></button>
            </RowItem>
          ))}
        </ListBox>

        <SectionTitle title="Servicios programados" onAdd={() => setShowServForm(true)} addLabel="Servicio" />
        <ListBox empty="Sin servicios programados.">
          {misServ.map((s, i) => {
            const dias = diffDias(s.fecha);
            return (
              <RowItem key={s.id} first={i === 0}>
                <button onClick={() => toggleServ(s.id)} style={{ background: "none", border: "none", cursor: "pointer", color: s.estado === "realizado" ? "#0F6B5C" : "#D8D5CE" }}>{s.estado === "realizado" ? <CheckCircle2 size={18} /> : <Clock size={18} />}</button>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13.5, textDecoration: s.estado === "realizado" ? "line-through" : "none", color: s.estado === "realizado" ? "#A7A29A" : "#1C1D1F" }}>{s.descripcion}</div>
                  <div style={{ fontSize: 11, color: "#A7A29A" }}>{fmtDate(s.fecha)} · aviso {s.avisoDias}d {s.estado === "pendiente" && (dias < 0 ? `· vencido ${Math.abs(dias)}d` : `· en ${dias}d`)}</div>
                </div>
                <div className="sg" style={{ fontWeight: 600, fontSize: 13 }}>{fmtMoney(s.importe)}</div>
                <button onClick={() => deleteServ(s.id)} className="no-print" style={{ background: "none", border: "none", color: "#C97B7B", cursor: "pointer" }}><Trash2 size={13} /></button>
              </RowItem>
            );
          })}
        </ListBox>

        {(misOrdenes.length > 0 || misVentas.length > 0) && (
          <>
            <SectionTitle title="Historial" />
            <ListBox empty="Sin historial.">
              {misOrdenes.map((o, i) => (
                <RowItem key={o.id} first={i === 0}>
                  <Wrench size={14} color="#C9822C" />
                  <div style={{ flex: 1, fontSize: 13 }}>Reparación: {o.producto} <span style={{ color: "#A7A29A" }}>· {ordenInfo(o.estado).label}</span></div>
                  <span style={{ fontSize: 11.5, color: "#A7A29A" }}>{fmtDate(o.fechaIngreso)}</span>
                </RowItem>
              ))}
              {misVentas.map((v, i) => (
                <RowItem key={v.id} first={i === 0 && misOrdenes.length === 0}>
                  <Receipt size={14} color="#2E5F8A" />
                  <div style={{ flex: 1, fontSize: 13 }}>{v.tipoComprobante === "factura" ? "Factura" : "Remito"} {v.numero}</div>
                  <span className="sg" style={{ fontSize: 13, fontWeight: 600 }}>{fmtMoney(v.total)}</span>
                </RowItem>
              ))}
            </ListBox>
          </>
        )}

        {showContactForm && <Modal title="Editar contacto" onClose={() => { setShowContactForm(false); setEditingContact(null); }}><ContactForm initial={editingContact} onSave={saveContact} /></Modal>}
        {showMovForm && <Modal title="Nuevo movimiento" onClose={() => setShowMovForm(false)}><MovForm onSave={(f) => addMov(selected.id, f)} /></Modal>}
        {showServForm && <Modal title="Nuevo servicio programado" onClose={() => setShowServForm(false)}><ServForm onSave={(f) => addServ(selected.id, f)} /></Modal>}
      </div>
    );
  }

  return (
    <div>
      {proximosServicios.length > 0 && (
        <div style={{ background: "#FBF0E1", border: "1px solid #F0DDBB", borderRadius: 12, padding: "12px 14px", marginBottom: 20 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, fontWeight: 600, color: "#8A5A17", marginBottom: 8 }}><Bell size={14} /> Servicios próximos a realizar</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {proximosServicios.map((s) => (
              <div key={s.id} onClick={() => setSelectedId(s.contacto.id)} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13, cursor: "pointer", background: "#fff", borderRadius: 8, padding: "7px 10px" }}>
                <span style={{ fontWeight: 600 }}>{s.contacto.nombre}</span>
                <span style={{ color: "#6B6560" }}>{s.descripcion}</span>
                <span style={{ marginLeft: "auto", color: s.dias < 0 ? "#B23A3A" : "#C9822C", fontWeight: 600, fontSize: 12 }}>{s.dias < 0 ? `Vencido hace ${Math.abs(s.dias)}d` : s.dias === 0 ? "Hoy" : `En ${s.dias}d`} · {fmtDate(s.fecha)}</span>
                <span style={{ fontSize: 12, color: "#6B6560" }}>{fmtMoney(s.importe)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "#A7A29A" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por nombre o DNI/CUIT…" style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: "1px solid #E4E2DD", background: "#fff", fontSize: 14, boxSizing: "border-box" }} />
        </div>
        <select value={filtroTipo} onChange={(e) => setFiltroTipo(e.target.value)} style={{ borderRadius: 10, border: "1px solid #E4E2DD", padding: "0 10px", fontSize: 14, background: "#fff" }}>
          <option value="todos">Todos</option><option value="cliente">Clientes</option><option value="empresa">Empresas</option>
        </select>
        <button onClick={() => { setEditingContact(null); setShowContactForm(true); }} style={{ display: "flex", alignItems: "center", gap: 6, background: "#4A5FA8", color: "#fff", border: "none", borderRadius: 10, padding: "0 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}><Plus size={16} /> Contacto</button>
      </div>

      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 20px", background: "#fff", border: "1px dashed #E4E2DD", borderRadius: 12 }}><Users size={28} color="#A7A29A" style={{ marginBottom: 10 }} /><div style={{ fontSize: 14, color: "#6B6560" }}>{contactos.length === 0 ? "Todavía no hay clientes ni empresas." : "Sin resultados."}</div></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((c) => {
            const deuda = deudaDe(c.id);
            return (
              <div key={c.id} onClick={() => setSelectedId(c.id)} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #E4E2DD", borderRadius: 12, padding: "13px 14px", cursor: "pointer" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#F0EEE9", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B6560" }}>{c.tipo === "empresa" ? <Building2 size={16} /> : <Users size={16} />}</div>
                <div style={{ flex: 1 }}><div className="sg" style={{ fontWeight: 600, fontSize: 15 }}>{c.nombre}</div><div style={{ fontSize: 12, color: "#8C8880" }}>{c.telefono || "sin teléfono"}{c.dniCuit ? ` · ${c.dniCuit}` : ""}</div></div>
                <div style={{ textAlign: "right" }}><div className="sg" style={{ fontWeight: 700, fontSize: 14, color: deuda > 0 ? "#B23A3A" : deuda < 0 ? "#0F6B5C" : "#6B6560" }}>{fmtMoney(deuda)}</div><div style={{ fontSize: 10.5, color: "#A7A29A" }}>{deuda > 0 ? "debe" : deuda < 0 ? "a favor" : "al día"}</div></div>
                <button onClick={(e) => { e.stopPropagation(); if (confirm(`¿Eliminar a "${c.nombre}"?`)) deleteContact(c.id); }} style={{ background: "none", border: "none", color: "#C97B7B", cursor: "pointer", padding: 4 }}><Trash2 size={15} /></button>
              </div>
            );
          })}
        </div>
      )}
      {showContactForm && <Modal title={editingContact ? "Editar contacto" : "Nuevo contacto"} onClose={() => { setShowContactForm(false); setEditingContact(null); }}><ContactForm initial={editingContact} onSave={saveContact} /></Modal>}
    </div>
  );
}
function SectionTitle({ title, onAdd, addLabel }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, marginTop: 8 }}>
      <div className="sg" style={{ fontSize: 14, fontWeight: 700 }}>{title}</div>
      {onAdd && <button onClick={onAdd} className="no-print" style={{ display: "flex", alignItems: "center", gap: 5, background: "#EEF0F7", color: "#4A5FA8", border: "1px solid #D4D9EC", borderRadius: 8, padding: "5px 10px", fontSize: 12.5, fontWeight: 600, cursor: "pointer" }}><Plus size={12} /> {addLabel}</button>}
    </div>
  );
}
function ListBox({ children, empty }) {
  const arr = React.Children.toArray(children);
  return <div style={{ background: "#fff", border: "1px solid #E4E2DD", borderRadius: 12, marginBottom: 16 }}>{arr.length === 0 ? <div style={{ padding: 16, fontSize: 13, color: "#A7A29A" }}>{empty}</div> : arr}</div>;
}
function RowItem({ children, first }) {
  return <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderTop: first ? "none" : "1px solid #EFEDE8" }}>{children}</div>;
}
function ContactForm({ initial, onSave }) {
  const [tipo, setTipo] = useState(initial?.tipo || "cliente");
  const [nombre, setNombre] = useState(initial?.nombre || "");
  const [dniCuit, setDniCuit] = useState(initial?.dniCuit || "");
  const [telefono, setTelefono] = useState(initial?.telefono || "");
  const [email, setEmail] = useState(initial?.email || "");
  const [direccion, setDireccion] = useState(initial?.direccion || "");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!nombre.trim()) return; onSave({ tipo, nombre: nombre.trim(), dniCuit: dniCuit.trim(), telefono: telefono.trim(), email: email.trim(), direccion: direccion.trim() }); }}>
      <Field label="Tipo">
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => setTipo("cliente")} style={{ flex: 1, padding: 8, borderRadius: 8, border: tipo === "cliente" ? "2px solid #4A5FA8" : "1px solid #E4E2DD", background: tipo === "cliente" ? "#EBEEF8" : "#fff", color: tipo === "cliente" ? "#4A5FA8" : "#6B6560", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>Cliente</button>
          <button type="button" onClick={() => setTipo("empresa")} style={{ flex: 1, padding: 8, borderRadius: 8, border: tipo === "empresa" ? "2px solid #4A5FA8" : "1px solid #E4E2DD", background: tipo === "empresa" ? "#EBEEF8" : "#fff", color: tipo === "empresa" ? "#4A5FA8" : "#6B6560", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>Empresa</button>
        </div>
      </Field>
      <Field label={tipo === "empresa" ? "Razón social" : "Nombre y apellido"}><input autoFocus style={inputStyle} value={nombre} onChange={(e) => setNombre(e.target.value)} /></Field>
      <Field label="DNI / CUIT"><input style={inputStyle} value={dniCuit} onChange={(e) => setDniCuit(e.target.value)} placeholder="20-12345678-9" /></Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Field label="Teléfono"><input style={inputStyle} value={telefono} onChange={(e) => setTelefono(e.target.value)} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Email"><input style={inputStyle} value={email} onChange={(e) => setEmail(e.target.value)} /></Field></div>
      </div>
      <Field label="Dirección"><input style={inputStyle} value={direccion} onChange={(e) => setDireccion(e.target.value)} /></Field>
      <button type="submit" style={{ width: "100%", background: "#4A5FA8", color: "#fff", border: "none", borderRadius: 9, padding: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{initial ? "Guardar cambios" : "Crear contacto"}</button>
    </form>
  );
}
function MovForm({ onSave }) {
  const [tipo, setTipo] = useState("cargo");
  const [concepto, setConcepto] = useState("");
  const [monto, setMonto] = useState("");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!concepto.trim() || !monto) return; onSave({ tipo, concepto: concepto.trim(), monto: Number(monto) || 0 }); }}>
      <Field label="Tipo">
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => setTipo("cargo")} style={{ flex: 1, padding: 8, borderRadius: 8, border: tipo === "cargo" ? "2px solid #B23A3A" : "1px solid #E4E2DD", background: tipo === "cargo" ? "#FBEAEA" : "#fff", color: tipo === "cargo" ? "#B23A3A" : "#6B6560", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>Cargo (deuda)</button>
          <button type="button" onClick={() => setTipo("pago")} style={{ flex: 1, padding: 8, borderRadius: 8, border: tipo === "pago" ? "2px solid #0F6B5C" : "1px solid #E4E2DD", background: tipo === "pago" ? "#E7F2EF" : "#fff", color: tipo === "pago" ? "#0F6B5C" : "#6B6560", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>Pago</button>
        </div>
      </Field>
      <Field label="Concepto"><input autoFocus style={inputStyle} value={concepto} onChange={(e) => setConcepto(e.target.value)} /></Field>
      <Field label="Importe"><input style={inputStyle} type="number" value={monto} onChange={(e) => setMonto(e.target.value)} /></Field>
      <button type="submit" style={{ width: "100%", background: "#4A5FA8", color: "#fff", border: "none", borderRadius: 9, padding: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Registrar movimiento</button>
    </form>
  );
}
function ServForm({ onSave }) {
  const [descripcion, setDescripcion] = useState("");
  const [fecha, setFecha] = useState(todayISO());
  const [importe, setImporte] = useState("");
  const [avisoDias, setAvisoDias] = useState("3");
  return (
    <form onSubmit={(e) => { e.preventDefault(); if (!descripcion.trim()) return; onSave({ descripcion: descripcion.trim(), fecha, importe: Number(importe) || 0, avisoDias: Number(avisoDias) || 0 }); }}>
      <Field label="Descripción del servicio"><input autoFocus style={inputStyle} value={descripcion} onChange={(e) => setDescripcion(e.target.value)} /></Field>
      <div style={{ display: "flex", gap: 10 }}>
        <div style={{ flex: 1 }}><Field label="Fecha"><input style={inputStyle} type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} /></Field></div>
        <div style={{ flex: 1 }}><Field label="Avisar (días antes)"><input style={inputStyle} type="number" value={avisoDias} onChange={(e) => setAvisoDias(e.target.value)} /></Field></div>
      </div>
      <Field label="Importe a cobrar"><input style={inputStyle} type="number" value={importe} onChange={(e) => setImporte(e.target.value)} /></Field>
      <button type="submit" style={{ width: "100%", background: "#4A5FA8", color: "#fff", border: "none", borderRadius: 9, padding: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Programar servicio</button>
    </form>
  );
}

// ---------- TAB: FACTURACIÓN ----------
function TabFacturacion({ data, persist, crearContacto, registrarVenta, draft, clearDraft, imprimir }) {
  const { ventas, contactos, productos, unidades, dolarVenta, categorias } = data;
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(!!draft);
  const [viewingId, setViewingId] = useState(null);

  useEffect(() => { if (draft) setShowForm(true); }, [draft]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return ventas;
    return ventas.filter((v) => {
      const c = contactos.find((c) => c.id === v.contactoId);
      return (c?.nombre || "").toLowerCase().includes(q) || (c?.dniCuit || "").includes(q) || v.numero.toLowerCase().includes(q);
    });
  }, [ventas, contactos, query]);

  const viewing = ventas.find((v) => v.id === viewingId);

  function save(venta) {
    const v = registrarVenta(venta);
    setShowForm(false);
    clearDraft();
    setViewingId(v.id);
  }

  if (viewing) {
    const contacto = contactos.find((c) => c.id === viewing.contactoId);
    return (
      <div>
        <button onClick={() => setViewingId(null)} className="no-print" style={{ display: "flex", alignItems: "center", gap: 4, background: "none", border: "none", color: "#6B6560", cursor: "pointer", fontSize: 13.5, marginBottom: 12 }}><ChevronLeft size={16} /> Volver</button>
        {viewing.estadoAfip === "pendiente_afip" && (
          <div style={{ background: "#FBF0E1", border: "1px solid #F0DDBB", borderRadius: 10, padding: "10px 12px", marginBottom: 16, fontSize: 12.5, color: "#8A5A17", display: "flex", gap: 8 }}><ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} /> Pendiente de autorización en AFIP (numeración interna hasta conectar el certificado).</div>
        )}
        <div style={{ background: "#fff", border: "1px solid #E4E2DD", borderRadius: 12, padding: 18 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
            <span className="sg" style={{ fontSize: 16, fontWeight: 700 }}>{viewing.tipoComprobante === "factura" ? "Factura" : "Remito"} {viewing.numero}</span>
            <span style={{ fontSize: 12, color: "#8C8880" }}>{fmtDate(viewing.fecha)}</span>
          </div>
          <div style={{ fontSize: 13, color: "#6B6560", marginBottom: 4 }}>{contacto?.nombre}</div>
          {contacto?.dniCuit && <div style={{ fontSize: 13, color: "#6B6560", marginBottom: 10 }}>{contacto.dniCuit}</div>}
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 13 }}>
            <thead><tr style={{ borderBottom: "1px solid #E4E2DD" }}><th style={{ textAlign: "left", padding: "6px 4px", color: "#8C8880", fontWeight: 500 }}>Descripción</th><th style={{ textAlign: "right", padding: "6px 4px", color: "#8C8880", fontWeight: 500 }}>Cant.</th><th style={{ textAlign: "right", padding: "6px 4px", color: "#8C8880", fontWeight: 500 }}>P.Unit.</th><th style={{ textAlign: "right", padding: "6px 4px", color: "#8C8880", fontWeight: 500 }}>Subtotal</th></tr></thead>
            <tbody>{agruparItemsVenta(viewing.items).map((it) => <tr key={it.id} style={{ borderBottom: "1px solid #EFEDE8" }}><td style={{ padding: "6px 4px" }}><div>{it.descripcion}</div>{it.series.map((s) => <div key={s} style={{ fontSize: 10.5, color: "#8C8880" }}>N/S: {s}</div>)}</td><td style={{ padding: "6px 4px", textAlign: "right" }}>{it.cantidad}</td><td style={{ padding: "6px 4px", textAlign: "right" }}>{fmtMoney(it.precioUnitario)}</td><td style={{ padding: "6px 4px", textAlign: "right" }}>{fmtMoney(it.subtotal)}</td></tr>)}</tbody>
          </table>
          <div style={{ marginTop: 12, textAlign: "right" }}>
            {viewing.discriminarIva && <><div style={{ fontSize: 13, color: "#6B6560" }}>Subtotal: {fmtMoney(viewing.subtotal)}</div><div style={{ fontSize: 13, color: "#6B6560" }}>IVA 21%: {fmtMoney(viewing.iva)}</div></>}
            <div className="sg" style={{ fontSize: 18, fontWeight: 700 }}>Total: {fmtMoney(viewing.total)}</div>
          </div>
        </div>
        <button onClick={() => imprimir({ tipo: "venta", venta: viewing, contacto })} className="no-print" style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 6, background: "#1C1D1F", color: "#fff", border: "none", borderRadius: 9, padding: 10, fontSize: 14, fontWeight: 600, cursor: "pointer", marginTop: 14 }}><Printer size={15} /> Imprimir / Guardar PDF</button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ background: "#FBF0E1", border: "1px solid #F0DDBB", borderRadius: 10, padding: "10px 12px", marginBottom: 16, fontSize: 12.5, color: "#8A5A17", display: "flex", gap: 8 }}>
        <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>Todavía no está conectado el certificado de AFIP: las facturas quedan "pendientes" con numeración interna hasta habilitarlo.</span>
      </div>
      <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
        <div style={{ flex: 1, position: "relative" }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "#A7A29A" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar por cliente o número…" style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: "1px solid #E4E2DD", background: "#fff", fontSize: 14, boxSizing: "border-box" }} />
        </div>
        <button onClick={() => setShowForm(true)} style={{ display: "flex", alignItems: "center", gap: 6, background: "#2E5F8A", color: "#fff", border: "none", borderRadius: 10, padding: "0 16px", fontSize: 14, fontWeight: 600, cursor: "pointer" }}><Plus size={16} /> Nueva venta</button>
      </div>
      {filtered.length === 0 ? (
        <div style={{ textAlign: "center", padding: "50px 20px", background: "#fff", border: "1px dashed #E4E2DD", borderRadius: 12 }}><Receipt size={28} color="#A7A29A" style={{ marginBottom: 10 }} /><div style={{ fontSize: 14, color: "#6B6560" }}>{ventas.length === 0 ? "Todavía no hay ventas cargadas." : "Sin resultados."}</div></div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {filtered.map((v) => {
            const c = contactos.find((c) => c.id === v.contactoId);
            return (
              <div key={v.id} onClick={() => setViewingId(v.id)} style={{ display: "flex", alignItems: "center", gap: 10, background: "#fff", border: "1px solid #E4E2DD", borderRadius: 12, padding: "12px 14px", cursor: "pointer" }}>
                <div style={{ width: 32, height: 32, borderRadius: 8, background: "#F0EEE9", display: "flex", alignItems: "center", justifyContent: "center", color: "#6B6560" }}>{v.tipoComprobante === "factura" ? <Receipt size={16} /> : <FileText size={16} />}</div>
                <div style={{ flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}><span className="sg" style={{ fontWeight: 600, fontSize: 14.5 }}>{c?.nombre || "—"}</span><span className="mono" style={{ fontSize: 11.5, color: "#8C8880" }}>{v.numero}</span></div>
                  <div style={{ fontSize: 12, color: "#8C8880" }}>{fmtDate(v.fecha)}</div>
                </div>
                {v.estadoAfip === "pendiente_afip" && <span style={{ fontSize: 11, color: "#8A5A17", background: "#FBF0E1", padding: "3px 8px", borderRadius: 999, fontWeight: 600 }}>Pendiente AFIP</span>}
                <div className="sg" style={{ fontWeight: 700, fontSize: 14.5 }}>{fmtMoney(v.total)}</div>
              </div>
            );
          })}
        </div>
      )}
      {showForm && (
        <Modal title="Nueva venta" onClose={() => { setShowForm(false); clearDraft(); }} wide>
          <VentaForm draft={draft} contactos={contactos} productos={productos} unidades={unidades} crearContacto={crearContacto} onSave={save} dolarVenta={dolarVenta} categorias={categorias} />
        </Modal>
      )}
    </div>
  );
}
function VentaForm({ draft, contactos, productos, unidades, crearContacto, onSave, dolarVenta, categorias: categoriasFacturacion }) {
  const [tipoComprobante, setTipoComprobante] = useState(draft?.tipoComprobante || "factura");
  const [contactoId, setContactoId] = useState(draft?.contactoId || null);
  const [condicionIva, setCondicionIva] = useState("consumidor_final");
  const [discriminarIva, setDiscriminarIva] = useState(false);
  const [pagada, setPagada] = useState(false);
  const [items, setItems] = useState(draft?.items || [{ id: uid(), tipo: "libre", descripcion: "", cantidad: 1, precioUnitario: "" }]);

  function updateItem(id, patch) { setItems(items.map((it) => (it.id === id ? { ...it, ...patch } : it))); }
  function addItem(tipo) { setItems([...items, tipo === "stock" ? { id: uid(), tipo: "stock", productId: "", unidadId: "", descripcion: "", cantidad: 1, precioUnitario: "" } : { id: uid(), tipo: "libre", descripcion: "", cantidad: 1, precioUnitario: "" }]); }
  function removeItem(id) { setItems(items.filter((it) => it.id !== id)); }

  function pickProducto(itemId, productId) {
    const p = productos.find((p) => p.id === productId);
    updateItem(itemId, { productId, unidadId: "", descripcion: p?.nombre || "", precioUnitario: p ? precioVentaDe(p, dolarVenta, categoriasFacturacion).toFixed(2) : "" });
  }
  function pickUnidad(itemId, unidadId) {
    const item = items.find((it) => it.id === itemId);
    const p = productos.find((p) => p.id === item.productId);
    const u = unidades.find((u) => u.id === unidadId);
    updateItem(itemId, { unidadId, numeroSerie: u?.numeroSerie || "", descripcion: p?.nombre || "" });
  }

  const subtotal = items.reduce((acc, it) => acc + (Number(it.cantidad) || 0) * (Number(it.precioUnitario) || 0), 0);
  const iva = discriminarIva ? subtotal * 0.21 : 0;
  const total = discriminarIva ? subtotal + iva : subtotal;

  function submit(e) {
    e.preventDefault();
    if (!contactoId || items.every((it) => !it.descripcion.trim())) return;
    onSave({ tipoComprobante, contactoId, condicionIva: tipoComprobante === "factura" ? condicionIva : null, discriminarIva, pagada, items: items.filter((it) => it.descripcion.trim()), subtotal, iva, total, origenOrdenId: draft?.origenOrdenId || null });
  }

  return (
    <form onSubmit={submit}>
      <Field label="Tipo de comprobante">
        <div style={{ display: "flex", gap: 8 }}>
          <button type="button" onClick={() => setTipoComprobante("factura")} style={{ flex: 1, padding: 9, borderRadius: 8, border: tipoComprobante === "factura" ? "2px solid #2E5F8A" : "1px solid #E4E2DD", background: tipoComprobante === "factura" ? "#EAF1F7" : "#fff", color: tipoComprobante === "factura" ? "#2E5F8A" : "#6B6560", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>Factura</button>
          <button type="button" onClick={() => setTipoComprobante("remito")} style={{ flex: 1, padding: 9, borderRadius: 8, border: tipoComprobante === "remito" ? "2px solid #2E5F8A" : "1px solid #E4E2DD", background: tipoComprobante === "remito" ? "#EAF1F7" : "#fff", color: tipoComprobante === "remito" ? "#2E5F8A" : "#6B6560", fontWeight: 600, fontSize: 13.5, cursor: "pointer" }}>Remito</button>
        </div>
      </Field>

      <Field label="Cliente"><ClienteSelector contactos={contactos} value={contactoId} onChange={setContactoId} onCreateContacto={crearContacto} /></Field>

      {tipoComprobante === "factura" && (
        <Field label="Condición frente al IVA">
          <select style={inputStyle} value={condicionIva} onChange={(e) => setCondicionIva(e.target.value)}>{CONDICIONES_IVA.map((c) => <option key={c.value} value={c.value}>{c.label} (Factura {c.factura})</option>)}</select>
        </Field>
      )}

      <Field label="Ítems">
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {items.map((it) => (
            <div key={it.id} style={{ border: "1px solid #E4E2DD", borderRadius: 8, padding: 8 }}>
              {it.tipo === "stock" ? (
                <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
                  <select style={{ ...inputStyle, flex: 1 }} value={it.productId} onChange={(e) => pickProducto(it.id, e.target.value)}>
                    <option value="">Elegir producto…</option>
                    {productos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
                  </select>
                  {(() => {
                    const prodSel = productos.find((p) => p.id === it.productId);
                    if (prodSel && prodSel.controlSerie === false) {
                      return <div style={{ ...inputStyle, flex: 1, background: "#F0EEE9", color: "#6B6560", display: "flex", alignItems: "center" }}>Stock disponible: {prodSel.cantidadStock || 0}</div>;
                    }
                    return (
                      <select style={{ ...inputStyle, flex: 1 }} value={it.unidadId} onChange={(e) => pickUnidad(it.id, e.target.value)} disabled={!it.productId}>
                        <option value="">N° de serie…</option>
                        {unidades.filter((u) => u.productId === it.productId && u.estado === "disponible").map((u) => <option key={u.id} value={u.id}>{u.numeroSerie}</option>)}
                      </select>
                    );
                  })()}
                </div>
              ) : (
                <input style={{ ...inputStyle, marginBottom: 6 }} value={it.descripcion} onChange={(e) => updateItem(it.id, { descripcion: e.target.value })} placeholder="Descripción (ej: reparación, servicio, producto libre)" />
              )}
              <div style={{ display: "flex", gap: 6 }}>
                <input style={{ ...inputStyle, flex: 0.6 }} type="number" value={it.cantidad} onChange={(e) => updateItem(it.id, { cantidad: e.target.value })} placeholder="Cant." />
                <input style={{ ...inputStyle, flex: 1 }} type="number" value={it.precioUnitario} onChange={(e) => updateItem(it.id, { precioUnitario: e.target.value })} placeholder="Precio unit." />
                <button type="button" onClick={() => removeItem(it.id)} style={{ background: "none", border: "none", color: "#C97B7B", cursor: "pointer" }}><Trash2 size={16} /></button>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
          <button type="button" onClick={() => addItem("stock")} style={{ display: "flex", alignItems: "center", gap: 5, background: "#EEF5F3", border: "1px dashed #CFE3DD", color: "#0F6B5C", borderRadius: 8, padding: "6px 10px", fontSize: 12.5, cursor: "pointer" }}><Plus size={13} /> Ítem de stock</button>
          <button type="button" onClick={() => addItem("libre")} style={{ display: "flex", alignItems: "center", gap: 5, background: "none", border: "1px dashed #D8D5CE", color: "#6B6560", borderRadius: 8, padding: "6px 10px", fontSize: 12.5, cursor: "pointer" }}><Plus size={13} /> Ítem libre</button>
        </div>
      </Field>

      {tipoComprobante === "factura" && (
        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 8, cursor: "pointer" }}><input type="checkbox" checked={discriminarIva} onChange={(e) => setDiscriminarIva(e.target.checked)} /> Discriminar IVA (21%)</label>
      )}
      <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, marginBottom: 12, cursor: "pointer" }}><input type="checkbox" checked={pagada} onChange={(e) => setPagada(e.target.checked)} /> Cobrado en el acto (no genera deuda)</label>

      <div style={{ background: "#FAFAF8", borderRadius: 8, padding: "10px 12px", marginBottom: 14, fontSize: 13.5 }}>
        {discriminarIva && <><div style={{ display: "flex", justifyContent: "space-between", color: "#6B6560" }}><span>Subtotal</span><span>{fmtMoney(subtotal)}</span></div><div style={{ display: "flex", justifyContent: "space-between", color: "#6B6560" }}><span>IVA 21%</span><span>{fmtMoney(iva)}</span></div></>}
        <div className="sg" style={{ display: "flex", justifyContent: "space-between", fontWeight: 700, fontSize: 16 }}><span>Total</span><span>{fmtMoney(total)}</span></div>
      </div>

      <button type="submit" style={{ width: "100%", background: "#2E5F8A", color: "#fff", border: "none", borderRadius: 9, padding: 10, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>{tipoComprobante === "factura" ? "Generar factura" : "Generar remito"}</button>
    </form>
  );
}

// ---------- IMPRESIÓN ----------
function PrintArea({ payload }) {
  if (!payload) return null;
  if (payload.tipo === "inventario") {
    const { productos, unidades, categorias, dolarVenta } = payload;
    return (
      <div style={{ fontFamily: "Inter, system-ui, sans-serif", color: "#1C1D1F" }}>
        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #1C1D1F", paddingBottom: 8, marginBottom: 14 }}><h1 style={{ fontSize: 18, margin: 0 }}>Listado de stock</h1><span style={{ fontSize: 12, color: "#6B6560" }}>{fmtDate(todayISO())} · Dólar oficial venta: {fmtMoney(dolarVenta)}</span></div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ borderBottom: "1px solid #1C1D1F" }}><th style={{ textAlign: "left", padding: "6px 4px" }}>Producto</th><th style={{ textAlign: "left", padding: "6px 4px" }}>Categoría</th><th style={{ textAlign: "right", padding: "6px 4px" }}>Costo U$D</th><th style={{ textAlign: "right", padding: "6px 4px" }}>Precio venta</th><th style={{ textAlign: "right", padding: "6px 4px" }}>Unidades</th><th style={{ textAlign: "right", padding: "6px 4px" }}>Disponibles</th></tr></thead>
          <tbody>{productos.map((p) => { const us = unidades.filter((u) => u.productId === p.id); const disp = us.filter((u) => u.estado === "disponible").length; const catNombre = categorias?.find((c) => c.id === p.categoriaId)?.nombre; const esCantidad = p.controlSerie === false; return <tr key={p.id} style={{ borderBottom: "1px solid #E4E2DD" }}><td style={{ padding: "6px 4px" }}>{p.nombre}</td><td style={{ padding: "6px 4px" }}>{catNombre || "—"}</td><td style={{ padding: "6px 4px", textAlign: "right" }}>U$D {p.costoUSD || 0}</td><td style={{ padding: "6px 4px", textAlign: "right" }}>{fmtMoney(precioVentaDe(p, dolarVenta, categorias))}</td><td style={{ padding: "6px 4px", textAlign: "right" }}>{esCantidad ? "—" : us.length}</td><td style={{ padding: "6px 4px", textAlign: "right" }}>{esCantidad ? p.cantidadStock || 0 : disp}</td></tr>; })}</tbody>
        </table>
      </div>
    );
  }
  if (payload.tipo === "ticket") {
    const { orden, contacto } = payload;
    return (
      <div style={{ fontFamily: "Inter, system-ui, sans-serif", color: "#1C1D1F" }}>
        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #1C1D1F", paddingBottom: 8, marginBottom: 14 }}>
          <h1 style={{ fontSize: 18, margin: 0 }}>Orden de reparación</h1>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{orden.numero}</div>
            <div style={{ fontSize: 12, color: "#6B6560" }}>Ingreso: {fmtDate(orden.fechaIngreso)}</div>
          </div>
        </div>
        <table style={{ width: "100%", fontSize: 13, borderCollapse: "collapse" }}>
          <tbody>
            <tr><td style={{ padding: "4px 0", color: "#6B6560", width: 140 }}>Cliente</td><td style={{ padding: "4px 0" }}>{contacto?.nombre}</td></tr>
            {contacto?.dniCuit && <tr><td style={{ padding: "4px 0", color: "#6B6560" }}>DNI/CUIT</td><td style={{ padding: "4px 0" }}>{contacto.dniCuit}</td></tr>}
            <tr><td style={{ padding: "4px 0", color: "#6B6560" }}>Producto</td><td style={{ padding: "4px 0" }}>{orden.producto}</td></tr>
            <tr><td style={{ padding: "4px 0", color: "#6B6560" }}>N° de serie</td><td style={{ padding: "4px 0" }}>{orden.numeroSerie}</td></tr>
            <tr><td style={{ padding: "4px 0", color: "#6B6560", verticalAlign: "top" }}>Falla</td><td style={{ padding: "4px 0" }}>{orden.falla}</td></tr>
          </tbody>
        </table>
        <div style={{ marginTop: 30, fontSize: 11, color: "#8C8880" }}>Conserve este comprobante para retirar su producto.</div>
      </div>
    );
  }
  if (payload.tipo === "cuenta") {
    const { contacto, movimientos, deuda } = payload;
    return (
      <div style={{ fontFamily: "Inter, system-ui, sans-serif", color: "#1C1D1F" }}>
        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #1C1D1F", paddingBottom: 8, marginBottom: 14 }}><h1 style={{ fontSize: 18, margin: 0 }}>Cuenta corriente</h1><span style={{ fontSize: 12, color: "#6B6560" }}>{fmtDate(todayISO())}</span></div>
        <div style={{ fontSize: 13, marginBottom: 10 }}><strong>{contacto.nombre}</strong>{contacto.dniCuit ? ` · ${contacto.dniCuit}` : ""}</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ borderBottom: "1px solid #1C1D1F" }}><th style={{ textAlign: "left", padding: "6px 4px" }}>Fecha</th><th style={{ textAlign: "left", padding: "6px 4px" }}>Concepto</th><th style={{ textAlign: "right", padding: "6px 4px" }}>Importe</th></tr></thead>
          <tbody>{movimientos.map((m) => <tr key={m.id} style={{ borderBottom: "1px solid #E4E2DD" }}><td style={{ padding: "6px 4px" }}>{fmtDate(m.fecha)}</td><td style={{ padding: "6px 4px" }}>{m.concepto}</td><td style={{ padding: "6px 4px", textAlign: "right" }}>{m.tipo === "cargo" ? "+" : "−"}{fmtMoney(m.monto)}</td></tr>)}</tbody>
        </table>
        <div style={{ fontSize: 15, fontWeight: 700, textAlign: "right", marginTop: 12 }}>Saldo: {fmtMoney(deuda)}</div>
      </div>
    );
  }
  if (payload.tipo === "venta") {
    const { venta, contacto } = payload;
    return (
      <div style={{ fontFamily: "Inter, system-ui, sans-serif", color: "#1C1D1F" }}>
        <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "2px solid #1C1D1F", paddingBottom: 8, marginBottom: 14 }}>
          <h1 style={{ fontSize: 18, margin: 0 }}>{venta.tipoComprobante === "factura" ? "Factura" : "Remito"}</h1>
          <div style={{ textAlign: "right" }}><div style={{ fontSize: 13, fontWeight: 600 }}>{venta.numero}</div><div style={{ fontSize: 12, color: "#6B6560" }}>{fmtDate(venta.fecha)}</div></div>
        </div>
        <div style={{ fontSize: 13, marginBottom: 10 }}><strong>{contacto?.nombre}</strong>{contacto?.dniCuit ? ` · ${contacto.dniCuit}` : ""}</div>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
          <thead><tr style={{ borderBottom: "1px solid #1C1D1F" }}><th style={{ textAlign: "left", padding: "6px 4px" }}>Descripción</th><th style={{ textAlign: "right", padding: "6px 4px" }}>Cant.</th><th style={{ textAlign: "right", padding: "6px 4px" }}>P.Unit.</th><th style={{ textAlign: "right", padding: "6px 4px" }}>Subtotal</th></tr></thead>
          <tbody>{agruparItemsVenta(venta.items).map((it) => <tr key={it.id} style={{ borderBottom: "1px solid #E4E2DD" }}><td style={{ padding: "6px 4px" }}><div>{it.descripcion}</div>{it.series.map((s) => <div key={s} style={{ fontSize: 10.5, color: "#6B6560" }}>N/S: {s}</div>)}</td><td style={{ padding: "6px 4px", textAlign: "right" }}>{it.cantidad}</td><td style={{ padding: "6px 4px", textAlign: "right" }}>{fmtMoney(it.precioUnitario)}</td><td style={{ padding: "6px 4px", textAlign: "right" }}>{fmtMoney(it.subtotal)}</td></tr>)}</tbody>
        </table>
        <div style={{ marginTop: 12, textAlign: "right" }}>
          {venta.discriminarIva && <><div style={{ fontSize: 12 }}>Subtotal: {fmtMoney(venta.subtotal)}</div><div style={{ fontSize: 12 }}>IVA 21%: {fmtMoney(venta.iva)}</div></>}
          <div style={{ fontSize: 16, fontWeight: 700 }}>Total: {fmtMoney(venta.total)}</div>
        </div>
        {venta.estadoAfip === "pendiente_afip" && <div style={{ marginTop: 20, fontSize: 10.5, color: "#A7A29A" }}>Comprobante interno de referencia — pendiente de autorización ante AFIP.</div>}
      </div>
    );
  }
  return null;
}
