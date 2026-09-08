import React, { useState, useEffect, useMemo } from "react";
import { ShoppingCart, Plus, Minus, X, Search, Package, CheckCircle2, MessageCircle, MapPin, Clock, Phone, Mail, Instagram, Facebook, Youtube, Wrench, Server, ShieldCheck, CheckCircle, Headphones, ClipboardList, Tag, ChevronDown } from "lucide-react";
import { supabase } from "./supabaseClient";
import { jsPDF } from "jspdf";

function fmtMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

const WHATSAPP_NUMERO = import.meta.env.VITE_WHATSAPP_NUMERO || "";

export default function Tienda() {
  const [catalogo, setCatalogo] = useState({ productos: [], categorias: [], tienda: {} });
  const [vista, setVista] = useState("inicio");
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [categoriaId, setCategoriaId] = useState(null);
  const [menuCategoriasAbierto, setMenuCategoriasAbierto] = useState(false);
  const [carrito, setCarrito] = useState([]);
  const [showCarrito, setShowCarrito] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [pedidoConfirmado, setPedidoConfirmado] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("catalogo_publico").select("data").eq("id", 1).maybeSingle();
      if (data && data.data) setCatalogo({ productos: data.data.productos || [], categorias: data.data.categorias || [], tienda: data.data.tienda || {} });
      setLoading(false);
    })();
  }, []);

  function agregarAlCarrito(producto) {
    setCarrito((c) => {
      const existente = c.find((it) => it.id === producto.id);
      const cantidadActual = existente?.cantidad || 0;
      if (cantidadActual >= producto.cantidadDisponible) return c;
      if (existente) return c.map((it) => (it.id === producto.id ? { ...it, cantidad: it.cantidad + 1 } : it));
      return [...c, { id: producto.id, nombre: producto.nombre, precio: producto.precio, cantidad: 1, maxDisponible: producto.cantidadDisponible }];
    });
  }

  function cambiarCantidad(id, delta) {
    setCarrito((c) => c.map((it) => (it.id === id ? { ...it, cantidad: Math.max(1, Math.min(it.maxDisponible, it.cantidad + delta)) } : it)));
  }

  function quitarDelCarrito(id) {
    setCarrito((c) => c.filter((it) => it.id !== id));
  }

  const totalCarrito = carrito.reduce((acc, it) => acc + it.precio * it.cantidad, 0);
  const cantidadItems = carrito.reduce((acc, it) => acc + it.cantidad, 0);

  const filtrados = useMemo(() => {
    const q = query.trim().toLowerCase();
    return catalogo.productos.filter((p) => {
      if (categoriaId && p.categoriaId !== categoriaId) return false;
      if (q && !p.nombre.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [catalogo, query, categoriaId]);

  const cantidadPorCategoria = useMemo(() => {
    const conteo = {};
    catalogo.productos.forEach((p) => { if (p.categoriaId) conteo[p.categoriaId] = (conteo[p.categoriaId] || 0) + 1; });
    return conteo;
  }, [catalogo]);

  async function confirmarPedido(cliente) {
    const fecha = new Date();
    const numero = `PED-${Date.now().toString().slice(-6)}`;

    // 1) Generar PDF
    const doc = new jsPDF();
    doc.setFontSize(16);
    doc.text("Pedido", 14, 18);
    doc.setFontSize(10);
    doc.text(`N°: ${numero}`, 14, 26);
    doc.text(`Fecha: ${fecha.toLocaleString("es-AR")}`, 14, 32);
    doc.text(`Cliente: ${cliente.nombre}`, 14, 40);
    doc.text(`Teléfono: ${cliente.telefono}`, 14, 46);
    let y = 58;
    doc.setFontSize(11);
    doc.text("Producto", 14, y);
    doc.text("Cant.", 130, y);
    doc.text("Subtotal", 160, y);
    y += 6;
    doc.setLineWidth(0.2);
    doc.line(14, y, 196, y);
    y += 6;
    doc.setFontSize(10);
    carrito.forEach((it) => {
      doc.text(it.nombre, 14, y);
      doc.text(String(it.cantidad), 132, y);
      doc.text(fmtMoney(it.precio * it.cantidad), 160, y);
      y += 7;
    });
    y += 4;
    doc.line(14, y, 196, y);
    y += 8;
    doc.setFontSize(13);
    doc.text(`Total: ${fmtMoney(totalCarrito)}`, 140, y);
    doc.save(`${numero}.pdf`);

    // 2) Guardar el pedido en el sistema
    await supabase.from("pedidos_web").insert({
      data: {
        numero,
        cliente,
        items: carrito.map((it) => ({ nombre: it.nombre, cantidad: it.cantidad, precio: it.precio })),
        total: totalCarrito,
        fecha: fecha.toISOString(),
      },
      estado: "nuevo",
    });

    // 3) Abrir WhatsApp con el mensaje ya armado
    if (WHATSAPP_NUMERO) {
      const lineas = carrito.map((it) => `• ${it.cantidad}x ${it.nombre} - ${fmtMoney(it.precio * it.cantidad)}`).join("\n");
      const mensaje = `¡Hola! Quiero confirmar mi pedido ${numero}:\n\n${lineas}\n\nTotal: ${fmtMoney(totalCarrito)}\n\nMi nombre: ${cliente.nombre}\nTeléfono: ${cliente.telefono}\n\n(Te adjunto el PDF del pedido que se descargó recién)`;
      window.open(`https://wa.me/${WHATSAPP_NUMERO}?text=${encodeURIComponent(mensaje)}`, "_blank");
    }

    setShowCheckout(false);
    setShowCarrito(false);
    setPedidoConfirmado(true);
    setCarrito([]);
  }

  return (
    <div style={{ fontFamily: "Inter, system-ui, sans-serif", background: "#F7F6F3", minHeight: "100vh", color: "#1C1D1F" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Inter:wght@400;500;600&display=swap');
        .sg { font-family: 'Space Grotesk', sans-serif; }
        ::placeholder { color: #A7A29A; }
        .tienda-toggle-categorias { display: none; }
        .tienda-sidebar { }
        @media (max-width: 700px) {
          .tienda-layout { flex-direction: column; }
          .tienda-sidebar { display: none; width: 100% !important; position: static !important; margin-bottom: 12px; }
          .tienda-sidebar.abierta { display: block; }
          .tienda-toggle-categorias { display: flex !important; }
          .tienda-grid { grid-template-columns: repeat(2, 1fr) !important; gap: 10px !important; }
        }
      `}</style>

      {/* Barra superior */}
      <div style={{ background: "#6B6560", padding: "6px 24px", textAlign: "center" }}>
        <span style={{ color: "#fff", fontSize: 12.5, fontWeight: 500 }}>Hacé tu pedido en línea</span>
      </div>

      {/* Header: logo + buscador + carrito */}
      <div style={{ background: "#fff", padding: "16px 24px", borderBottom: "1px solid #E4E2DD" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", alignItems: "center", gap: 20, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            {catalogo.tienda?.logoUrl ? (
              <img src={catalogo.tienda.logoUrl} alt={catalogo.tienda?.nombreNegocio || "Logo"} style={{ height: 48, objectFit: "contain" }} />
            ) : (
              <span className="sg" style={{ fontSize: 20, fontWeight: 700 }}>{catalogo.tienda?.nombreNegocio || "Tienda"}</span>
            )}
          </div>
          <div style={{ flex: 1, minWidth: 200, position: "relative" }}>
            <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "#A7A29A" }} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto…" style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 8, border: "1px solid #E4E2DD", background: "#fff", fontSize: 14, boxSizing: "border-box" }} />
          </div>
          <button onClick={() => setShowCarrito(true)} style={{ position: "relative", background: "#0F6B5C", color: "#fff", border: "none", borderRadius: 10, padding: "10px 16px", display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 600, cursor: "pointer", whiteSpace: "nowrap" }}>
            <ShoppingCart size={16} /> Carrito
            {cantidadItems > 0 && <span style={{ position: "absolute", top: -6, right: -6, background: "#B23A3A", color: "#fff", borderRadius: 999, fontSize: 10.5, width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{cantidadItems}</span>}
          </button>
        </div>
      </div>

      {/* Menú */}
      <div style={{ background: "#6B6560", padding: "0 24px" }}>
        <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex" }}>
          <button onClick={() => setVista("inicio")} style={{ background: vista === "inicio" ? "#fff" : "transparent", color: vista === "inicio" ? "#1C1D1F" : "#fff", border: "none", padding: "10px 20px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>Inicio</button>
          <button onClick={() => setVista("servicios")} style={{ background: vista === "servicios" ? "#fff" : "transparent", color: vista === "servicios" ? "#1C1D1F" : "#fff", border: "none", padding: "10px 20px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>Servicios</button>
        </div>
      </div>

      {vista === "inicio" ? (
        <>
      {/* Banner */}
      <BannerCarrusel imagenes={catalogo.tienda?.bannerUrls?.length ? catalogo.tienda.bannerUrls : (catalogo.tienda?.bannerUrl ? [catalogo.tienda.bannerUrl] : [])} />

      {/* Catálogo con menú de categorías al costado */}
      <div className="tienda-layout" style={{ maxWidth: 1100, margin: "0 auto", padding: "20px 24px", display: "flex", gap: 20, alignItems: "flex-start" }}>
        <button
          className="tienda-toggle-categorias"
          onClick={() => setMenuCategoriasAbierto((v) => !v)}
          style={{ alignItems: "center", gap: 8, width: "100%", background: "#fff", border: "1px solid #E4E2DD", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, cursor: "pointer", justifyContent: "space-between" }}
        >
          <span style={{ display: "flex", alignItems: "center", gap: 8 }}><Tag size={15} /> Categorías{categoriaId ? `: ${catalogo.categorias.find((c) => c.id === categoriaId)?.nombre || ""}` : ""}</span>
          <ChevronDown size={15} style={{ transform: menuCategoriasAbierto ? "rotate(180deg)" : "none", transition: "transform 0.2s" }} />
        </button>
        <div className={`tienda-sidebar${menuCategoriasAbierto ? " abierta" : ""}`} style={{ width: 200, flexShrink: 0, background: "#fff", border: "1px solid #E4E2DD", borderRadius: 12, padding: 14, position: "sticky", top: 20 }}>
          <div className="sg" style={{ fontSize: 13, fontWeight: 700, marginBottom: 10 }}>Categorías</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <button
              onClick={() => { setCategoriaId(null); setMenuCategoriasAbierto(false); }}
              style={{ textAlign: "left", background: !categoriaId ? "#EEF5F3" : "none", color: !categoriaId ? "#0F6B5C" : "#4A4642", border: "none", borderRadius: 6, padding: "7px 8px", fontSize: 13, fontWeight: !categoriaId ? 600 : 400, cursor: "pointer" }}
            >
              Todas
            </button>
            {catalogo.categorias.map((c) => (
              <button
                key={c.id}
                onClick={() => { setCategoriaId(c.id); setMenuCategoriasAbierto(false); }}
                style={{ textAlign: "left", background: categoriaId === c.id ? "#EEF5F3" : "none", color: categoriaId === c.id ? "#0F6B5C" : "#4A4642", border: "none", borderRadius: 6, padding: "7px 8px", fontSize: 13, fontWeight: categoriaId === c.id ? 600 : 400, cursor: "pointer", display: "flex", justifyContent: "space-between" }}
              >
                <span>{c.nombre}</span>
                <span style={{ color: "#A7A29A", fontSize: 11.5 }}>{cantidadPorCategoria[c.id] || 0}</span>
              </button>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          {loading ? (
            <div style={{ textAlign: "center", padding: 60, color: "#A7A29A" }}>Cargando productos…</div>
          ) : filtrados.length === 0 ? (
            <div style={{ textAlign: "center", padding: 60, color: "#A7A29A" }}>
              <Package size={32} style={{ marginBottom: 10 }} />
              <div>No hay productos en esta categoría todavía.</div>
            </div>
          ) : (
            <div className="tienda-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 14 }}>
              {filtrados.map((p) => {
                const enCarrito = carrito.find((it) => it.id === p.id)?.cantidad || 0;
                const agotado = !p.disponible || enCarrito >= p.cantidadDisponible;
                return (
                  <div key={p.id} style={{ background: "#fff", border: "1px solid #E4E2DD", borderRadius: 12, overflow: "hidden", display: "flex", flexDirection: "column" }}>
                    <div style={{ width: "100%", aspectRatio: "1", background: "#F0EEE9", display: "flex", alignItems: "center", justifyContent: "center", position: "relative" }}>
                      {p.imagenUrl ? <img src={p.imagenUrl} alt={p.nombre} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <Package size={28} color="#C9C5BD" />}
                      {!p.disponible && <div style={{ position: "absolute", top: 8, right: 8, background: "#B23A3A", color: "#fff", fontSize: 10.5, fontWeight: 700, padding: "3px 8px", borderRadius: 999 }}>Sin stock</div>}
                    </div>
                    <div style={{ padding: 12, display: "flex", flexDirection: "column", flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 4 }}>{p.nombre}</div>
                      <div className="sg" style={{ fontSize: 15, fontWeight: 700, marginBottom: 10 }}>{fmtMoney(p.precio)}</div>
                      <button
                        onClick={() => agregarAlCarrito(p)}
                        disabled={agotado}
                        style={{ marginTop: "auto", background: agotado ? "#EFEDE8" : "#0F6B5C", color: agotado ? "#A7A29A" : "#fff", border: "none", borderRadius: 8, padding: "8px", fontSize: 12.5, fontWeight: 600, cursor: agotado ? "default" : "pointer" }}
                      >
                        {!p.disponible ? "Sin stock" : enCarrito >= p.cantidadDisponible ? "Sin más stock" : "Agregar al carrito"}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
        </>
      ) : (
        <PaginaServicios whatsapp={WHATSAPP_NUMERO} />
      )}

      <TiendaFooter tienda={catalogo.tienda} />

      {showCarrito && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(28,29,31,0.45)", display: "flex", justifyContent: "flex-end", zIndex: 50 }} onClick={() => setShowCarrito(false)}>
          <div style={{ background: "#fff", width: "100%", maxWidth: 380, height: "100%", padding: 20, overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div className="sg" style={{ fontSize: 16, fontWeight: 700 }}>Tu carrito</div>
              <button onClick={() => setShowCarrito(false)} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} /></button>
            </div>
            {carrito.length === 0 ? (
              <div style={{ color: "#A7A29A", fontSize: 13.5, textAlign: "center", padding: 30 }}>Todavía no agregaste productos.</div>
            ) : (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 20 }}>
                  {carrito.map((it) => (
                    <div key={it.id} style={{ display: "flex", alignItems: "center", gap: 8, background: "#FAFAF8", borderRadius: 8, padding: "8px 10px" }}>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 13 }}>{it.nombre}</div>
                        <div style={{ fontSize: 12, color: "#8C8880" }}>{fmtMoney(it.precio)} c/u</div>
                      </div>
                      <button onClick={() => cambiarCantidad(it.id, -1)} style={{ background: "#F0EEE9", border: "none", borderRadius: 6, width: 22, height: 22, cursor: "pointer" }}><Minus size={12} /></button>
                      <span style={{ fontSize: 13, fontWeight: 700, minWidth: 16, textAlign: "center" }}>{it.cantidad}</span>
                      <button onClick={() => cambiarCantidad(it.id, 1)} disabled={it.cantidad >= it.maxDisponible} style={{ background: "#F0EEE9", border: "none", borderRadius: 6, width: 22, height: 22, cursor: it.cantidad >= it.maxDisponible ? "default" : "pointer", opacity: it.cantidad >= it.maxDisponible ? 0.4 : 1 }}><Plus size={12} /></button>
                      <button onClick={() => quitarDelCarrito(it.id)} style={{ background: "none", border: "none", color: "#C97B7B", cursor: "pointer" }}><X size={14} /></button>
                    </div>
                  ))}
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 16, fontWeight: 700, marginBottom: 16 }} className="sg">
                  <span>Total</span><span>{fmtMoney(totalCarrito)}</span>
                </div>
                <button onClick={() => setShowCheckout(true)} style={{ width: "100%", background: "#0F6B5C", color: "#fff", border: "none", borderRadius: 9, padding: 12, fontSize: 14, fontWeight: 600, cursor: "pointer" }}>Finalizar pedido</button>
              </>
            )}
          </div>
        </div>
      )}

      {showCheckout && <CheckoutModal onClose={() => setShowCheckout(false)} onConfirmar={confirmarPedido} total={totalCarrito} />}

      {pedidoConfirmado && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(28,29,31,0.6)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 60 }} onClick={() => setPedidoConfirmado(false)}>
          <div style={{ background: "#fff", borderRadius: 14, padding: 28, maxWidth: 340, textAlign: "center" }} onClick={(e) => e.stopPropagation()}>
            <CheckCircle2 size={40} color="#0F6B5C" style={{ marginBottom: 12 }} />
            <div className="sg" style={{ fontSize: 16, fontWeight: 700, marginBottom: 8 }}>¡Pedido recibido!</div>
            <div style={{ fontSize: 13.5, color: "#6B6560", marginBottom: 16 }}>Se descargó el PDF de tu pedido. Se abrió WhatsApp con el mensaje listo — solo confirmá el envío y, si querés, adjuntá el PDF descargado.</div>
            <button onClick={() => setPedidoConfirmado(false)} style={{ background: "#1C1D1F", color: "#fff", border: "none", borderRadius: 9, padding: "10px 20px", fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>Listo</button>
          </div>
        </div>
      )}

      <BotonFlotanteWhatsapp numero={WHATSAPP_NUMERO} />
    </div>
  );
}

function BotonFlotanteWhatsapp({ numero }) {
  if (!numero) return null;
  const mensaje = encodeURIComponent("¡Hola! Tengo una consulta.");
  return (
    <a
      href={`https://wa.me/${numero}?text=${mensaje}`}
      target="_blank"
      rel="noreferrer"
      title="Consultanos por WhatsApp"
      style={{
        position: "fixed",
        bottom: 22,
        right: 22,
        width: 58,
        height: 58,
        borderRadius: "50%",
        background: "#25D366",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: "0 4px 14px rgba(0,0,0,0.25)",
        zIndex: 40,
        textDecoration: "none",
      }}
    >
      <svg viewBox="0 0 32 32" width="30" height="30" fill="#fff"><path d="M16.004 3C9.376 3 4 8.373 4 15c0 2.34.652 4.53 1.786 6.395L4 29l7.86-1.744A11.94 11.94 0 0 0 16.004 27C22.63 27 28 21.627 28 15S22.63 3 16.004 3zm0 21.75a9.7 9.7 0 0 1-4.95-1.354l-.355-.21-4.66 1.035 1.05-4.54-.232-.368A9.68 9.68 0 0 1 5.25 15c0-5.93 4.822-10.75 10.754-10.75S26.75 9.07 26.75 15 21.936 24.75 16.004 24.75zm5.55-7.98c-.304-.152-1.797-.887-2.076-.987-.28-.102-.484-.152-.687.152-.203.303-.786.986-.964 1.19-.177.202-.354.227-.658.075-.304-.152-1.284-.473-2.446-1.51-.904-.807-1.514-1.803-1.692-2.107-.177-.303-.019-.467.133-.618.137-.136.304-.354.456-.53.152-.178.203-.304.304-.507.101-.203.05-.38-.025-.532-.076-.152-.687-1.657-.941-2.27-.248-.596-.5-.516-.687-.526l-.586-.01c-.203 0-.532.076-.81.38-.279.303-1.065 1.04-1.065 2.537 0 1.497 1.09 2.944 1.242 3.146.152.203 2.147 3.28 5.202 4.6.727.314 1.294.502 1.737.642.73.232 1.394.2 1.92.121.586-.087 1.797-.734 2.05-1.443.254-.71.254-1.318.178-1.443-.076-.126-.279-.203-.583-.354z"/></svg>
    </a>
  );
}

function CheckoutModal({ onClose, onConfirmar, total }) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [enviando, setEnviando] = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!nombre.trim() || !telefono.trim()) return;
    setEnviando(true);
    await onConfirmar({ nombre: nombre.trim(), telefono: telefono.trim() });
    setEnviando(false);
  }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(28,29,31,0.45)", display: "flex", alignItems: "center", justifyContent: "center", padding: 16, zIndex: 55 }} onClick={onClose}>
      <div style={{ background: "#fff", borderRadius: 14, width: "100%", maxWidth: 360, padding: 20 }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14 }}>
          <div className="sg" style={{ fontSize: 16, fontWeight: 700 }}>Tus datos</div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer" }}><X size={18} /></button>
        </div>
        <form onSubmit={submit}>
          <div style={{ marginBottom: 10 }}>
            <label style={{ display: "block", fontSize: 12.5, color: "#6B6560", marginBottom: 4 }}>Nombre</label>
            <input autoFocus value={nombre} onChange={(e) => setNombre(e.target.value)} style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #E4E2DD", fontSize: 14, boxSizing: "border-box" }} required />
          </div>
          <div style={{ marginBottom: 14 }}>
            <label style={{ display: "block", fontSize: 12.5, color: "#6B6560", marginBottom: 4 }}>Teléfono / WhatsApp</label>
            <input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="11 2345 6789" style={{ width: "100%", padding: "9px 10px", borderRadius: 8, border: "1px solid #E4E2DD", fontSize: 14, boxSizing: "border-box" }} required />
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 14, textAlign: "right" }} className="sg">Total: {fmtMoney(total)}</div>
          <button type="submit" disabled={enviando} style={{ width: "100%", background: "#0F6B5C", color: "#fff", border: "none", borderRadius: 9, padding: 11, fontSize: 14, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 6 }}>
            <MessageCircle size={15} /> {enviando ? "Generando…" : "Confirmar y enviar por WhatsApp"}
          </button>
        </form>
      </div>
    </div>
  );
}

function PaginaServicios({ whatsapp }) {
  const bloques = [
    {
      icono: Wrench,
      titulo: "Reparación",
      items: ["Reparación de PC", "Reparación de Notebook", "Reparación de Impresoras"],
    },
    {
      icono: Server,
      titulo: "Redes e Infraestructura",
      items: ["Cableado estructurado de redes informáticas", "Configuración de servidor de datos", "Conexión de router · Configuración de PC"],
    },
  ];

  const itemsMantenimiento = [
    "Mantenimiento y reparación de equipos informáticos",
    "Auditoría informática",
    "Configuración y mantenimiento de redes",
    "Configuración y optimización de sistemas operativos",
    "Actualización de software",
    "Seguridad en sistemas informáticos para empresas y videovigilancia",
    "Método de realización del servicio",
    "Soporte técnico telefónico",
  ];

  const mensajeWpp = encodeURIComponent("¡Hola! Quiero consultar por sus servicios técnicos.");

  return (
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "48px 24px 60px" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&display=swap');
        .servicios-mantenimiento { display: grid; grid-template-columns: minmax(240px, 1fr) minmax(260px, 1.1fr); gap: 32px; }
        @media (max-width: 700px) { .servicios-mantenimiento { grid-template-columns: 1fr; } }
      `}</style>

      <div style={{ textAlign: "center", marginBottom: 40 }}>
        <div style={{ display: "inline-block", fontSize: 11.5, fontWeight: 700, letterSpacing: 1.5, color: "#0F6B5C", background: "#EEF5F3", padding: "5px 14px", borderRadius: 999, marginBottom: 14, textTransform: "uppercase" }}>
          Servicio técnico
        </div>
        <h1 className="sg" style={{ fontSize: 32, fontWeight: 700, color: "#1C1D1F", margin: "0 0 10px" }}>Nuestros Servicios</h1>
        <p style={{ fontSize: 15, color: "#6B6560", maxWidth: 560, margin: "0 auto" }}>
          Soporte técnico integral para tu equipo, tu red y tu negocio — desde una reparación puntual hasta el mantenimiento continuo de toda tu infraestructura.
        </p>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: 20, marginBottom: 28 }}>
        {bloques.map((b, i) => {
          const Icono = b.icono;
          return (
            <div key={i} style={{ background: "#fff", border: "1px solid #E4E2DD", borderRadius: 16, padding: 28 }}>
              <div style={{ width: 46, height: 46, borderRadius: 12, background: "#1C1D1F", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
                <Icono size={22} color="#fff" />
              </div>
              <div className="sg" style={{ fontSize: 17, fontWeight: 700, marginBottom: 12 }}>{b.titulo}</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {b.items.map((it, j) => (
                  <div key={j} style={{ display: "flex", alignItems: "flex-start", gap: 8, fontSize: 13.5, color: "#4A4642" }}>
                    <span style={{ width: 5, height: 5, borderRadius: 999, background: "#0F6B5C", marginTop: 7, flexShrink: 0 }} />
                    {it}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <div className="servicios-mantenimiento" style={{ background: "#1C1D1F", borderRadius: 18, padding: "36px 32px", color: "#fff" }}>
        <div>
          <div style={{ width: 46, height: 46, borderRadius: 12, background: "rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 18 }}>
            <ShieldCheck size={22} color="#fff" />
          </div>
          <div className="sg" style={{ fontSize: 20, fontWeight: 700, marginBottom: 14 }}>Servicio de Mantenimiento</div>
          <p style={{ fontSize: 13.5, color: "#B7B3AC", lineHeight: 1.65, margin: 0 }}>
            Los servicios de mantenimiento se encargan de prevenir y solucionar averías en equipos, máquinas e instalaciones, con el fin de garantizar su óptimo funcionamiento.
            Brindamos asistencia al personal de la empresa o a los clientes: ejecutamos diagnósticos en hardware o software defectuoso, reemplazamos las piezas de hardware dañadas según sea necesario, y redactamos informes sobre el estado de todo el hardware y software de la empresa.
          </p>
        </div>
        <div>
          <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
            {itemsMantenimiento.map((it, i) => (
              <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                <CheckCircle size={16} color="#4FD1B3" style={{ flexShrink: 0, marginTop: 1 }} />
                <span style={{ fontSize: 13.5, fontWeight: 500 }}>{it}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 12, background: "#EEF5F3", border: "1px solid #CFE3DD", borderRadius: 14, padding: "16px 22px", marginTop: 24, flexWrap: "wrap" }}>
        <ClipboardList size={20} color="#0F6B5C" style={{ flexShrink: 0 }} />
        <span style={{ fontSize: 13.5, color: "#1C1D1F" }}><strong>El valor del trabajo se basará en la cantidad de equipos.</strong> Escribinos y te pasamos un presupuesto a medida.</span>
      </div>

      {whatsapp && (
        <div style={{ textAlign: "center", marginTop: 36 }}>
          <a
            href={`https://wa.me/${whatsapp}?text=${mensajeWpp}`}
            target="_blank"
            rel="noreferrer"
            style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "#0F6B5C", color: "#fff", textDecoration: "none", borderRadius: 999, padding: "13px 28px", fontSize: 14, fontWeight: 600 }}
          >
            <Headphones size={17} /> Consultar por WhatsApp
          </a>
        </div>
      )}
    </div>
  );
}

function TiendaFooter({ tienda }) {
  if (!tienda) return null;
  const tieneRedes = tienda.facebookUrl || tienda.youtubeUrl || tienda.instagram;
  const tieneDatos = tienda.direccion || tienda.horario || tienda.telefono || tienda.email || tienda.instagram;
  if (!tieneRedes && !tieneDatos) return null;

  return (
    <div style={{ marginTop: 30 }}>
      <div style={{ background: "#fff", borderTop: "1px solid #E4E2DD", padding: "14px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          {tienda.logoUrl ? (
            <img src={tienda.logoUrl} alt={tienda.nombreNegocio || ""} style={{ height: 36, objectFit: "contain" }} />
          ) : (
            <span className="sg" style={{ fontSize: 15, fontWeight: 700 }}>{tienda.nombreNegocio}</span>
          )}
        </div>
        {tieneRedes && (
          <div style={{ display: "flex", gap: 14 }}>
            {tienda.facebookUrl && <a href={tienda.facebookUrl} target="_blank" rel="noreferrer" style={{ color: "#4A4642" }}><Facebook size={18} /></a>}
            {tienda.youtubeUrl && <a href={tienda.youtubeUrl} target="_blank" rel="noreferrer" style={{ color: "#4A4642" }}><Youtube size={18} /></a>}
            {tienda.instagram && <a href={`https://instagram.com/${tienda.instagram.replace(/^@/, "")}`} target="_blank" rel="noreferrer" style={{ color: "#4A4642" }}><Instagram size={18} /></a>}
          </div>
        )}
      </div>
      {tieneDatos && (
        <div style={{ background: "#6B6560", color: "#fff", padding: "16px 24px" }}>
          <div style={{ maxWidth: 1100, margin: "0 auto", display: "flex", flexDirection: "column", gap: 8, fontSize: 13.5 }}>
            {tienda.direccion && (
              <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(tienda.direccion)}`}
                target="_blank"
                rel="noreferrer"
                style={{ display: "flex", alignItems: "center", gap: 8, color: "#fff", textDecoration: "none" }}
                onMouseEnter={(e) => (e.currentTarget.style.textDecoration = "underline")}
                onMouseLeave={(e) => (e.currentTarget.style.textDecoration = "none")}
              >
                <MapPin size={15} /> {tienda.direccion}
              </a>
            )}
            {tienda.horario && <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Clock size={15} /> {tienda.horario}</div>}
            {tienda.telefono && <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Phone size={15} /> {tienda.telefono}</div>}
            {tienda.email && <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Mail size={15} /> {tienda.email}</div>}
            {tienda.instagram && <div style={{ display: "flex", alignItems: "center", gap: 8 }}><Instagram size={15} /> {tienda.instagram}</div>}
          </div>
        </div>
      )}
    </div>
  );
}

function BannerCarrusel({ imagenes }) {
  const [indice, setIndice] = useState(0);

  useEffect(() => {
    if (imagenes.length <= 1) return;
    const t = setInterval(() => setIndice((i) => (i + 1) % imagenes.length), 4000);
    return () => clearInterval(t);
  }, [imagenes.length]);

  if (imagenes.length === 0) return null;

  return (
    <div style={{ width: "100%", height: 320, position: "relative", overflow: "hidden", background: "#EFEDE8" }}>
      {imagenes.map((url, i) => (
        <img
          key={i}
          src={url}
          alt=""
          style={{
            position: "absolute",
            inset: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            opacity: i === indice ? 1 : 0,
            transition: "opacity 0.9s ease",
          }}
        />
      ))}
      {imagenes.length > 1 && (
        <div style={{ position: "absolute", bottom: 12, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 6 }}>
          {imagenes.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndice(i)}
              style={{
                width: 8,
                height: 8,
                borderRadius: 999,
                border: "none",
                cursor: "pointer",
                background: i === indice ? "#fff" : "rgba(255,255,255,0.5)",
                boxShadow: "0 0 0 1px rgba(0,0,0,0.15)",
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}
