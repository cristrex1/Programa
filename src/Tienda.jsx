import React, { useState, useEffect, useMemo } from "react";
import { ShoppingCart, Plus, Minus, X, Search, Package, CheckCircle2, MessageCircle } from "lucide-react";
import { supabase } from "./supabaseClient";
import { jsPDF } from "jspdf";

function fmtMoney(n) {
  const num = Number(n) || 0;
  return num.toLocaleString("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });
}

const WHATSAPP_NUMERO = import.meta.env.VITE_WHATSAPP_NUMERO || "";

export default function Tienda() {
  const [catalogo, setCatalogo] = useState({ productos: [], categorias: [] });
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [carrito, setCarrito] = useState([]);
  const [showCarrito, setShowCarrito] = useState(false);
  const [showCheckout, setShowCheckout] = useState(false);
  const [pedidoConfirmado, setPedidoConfirmado] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("catalogo_publico").select("data").eq("id", 1).maybeSingle();
      if (data && data.data) setCatalogo({ productos: data.data.productos || [], categorias: data.data.categorias || [] });
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
    if (!q) return catalogo.productos;
    return catalogo.productos.filter((p) => p.nombre.toLowerCase().includes(q));
  }, [catalogo, query]);

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
      `}</style>

      <div style={{ background: "#1C1D1F", padding: "16px 24px", position: "sticky", top: 0, zIndex: 20 }}>
        <div style={{ maxWidth: 1000, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div className="sg" style={{ color: "#fff", fontSize: 18, fontWeight: 700 }}>Tienda</div>
          <button onClick={() => setShowCarrito(true)} style={{ position: "relative", background: "#0F6B5C", color: "#fff", border: "none", borderRadius: 10, padding: "8px 14px", display: "flex", alignItems: "center", gap: 6, fontSize: 13.5, fontWeight: 600, cursor: "pointer" }}>
            <ShoppingCart size={16} /> Carrito
            {cantidadItems > 0 && <span style={{ position: "absolute", top: -6, right: -6, background: "#B23A3A", color: "#fff", borderRadius: 999, fontSize: 10.5, width: 18, height: 18, display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700 }}>{cantidadItems}</span>}
          </button>
        </div>
      </div>

      <div style={{ maxWidth: 1000, margin: "0 auto", padding: "20px 24px" }}>
        <div style={{ position: "relative", marginBottom: 20 }}>
          <Search size={16} style={{ position: "absolute", left: 12, top: 12, color: "#A7A29A" }} />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar producto…" style={{ width: "100%", padding: "10px 12px 10px 36px", borderRadius: 10, border: "1px solid #E4E2DD", background: "#fff", fontSize: 14, boxSizing: "border-box" }} />
        </div>

        {loading ? (
          <div style={{ textAlign: "center", padding: 60, color: "#A7A29A" }}>Cargando productos…</div>
        ) : filtrados.length === 0 ? (
          <div style={{ textAlign: "center", padding: 60, color: "#A7A29A" }}>
            <Package size={32} style={{ marginBottom: 10 }} />
            <div>No hay productos disponibles todavía.</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: 14 }}>
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
                    <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 4 }}>{p.nombre}</div>
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
    </div>
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
