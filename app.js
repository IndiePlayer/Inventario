const CLAVE_DB = "inventario_db_v1";
const CLAVE_SESION = "inventario_sesion_v1";

const PERMISOS = {
  ADMINISTRADOR: {
    vistas: ["dashboard", "productos", "movimientos", "vencimientos", "reportes", "usuarios"],
    productosEscribir: true,
    productosEliminar: true,
    movimientosRegistrar: true,
    vencimientosEvaluar: true,
    usuariosGestionar: true
  },
  BODEGUERO: {
    vistas: ["dashboard", "productos", "movimientos", "vencimientos", "reportes"],
    productosEscribir: true,
    productosEliminar: false,
    movimientosRegistrar: true,
    vencimientosEvaluar: true,
    usuariosGestionar: false
  },
  VENDEDOR: {
    vistas: ["dashboard", "productos"],
    productosEscribir: false,
    productosEliminar: false,
    movimientosRegistrar: false,
    vencimientosEvaluar: false,
    usuariosGestionar: false
  }
};

const ETIQUETAS_VISTA = {
  dashboard: ["Panel", "Indicadores generales del inventario"],
  productos: ["Productos", "Consulta, registro y edición de productos"],
  movimientos: ["Movimientos", "Entradas y salidas de stock por lote"],
  vencimientos: ["Vencimientos", "Clasificación automática de lotes y alertas"],
  reportes: ["Reportes", "Valorización, riesgo de vencimiento e historial"],
  usuarios: ["Usuarios", "Gestión de usuarios y roles del sistema"]
};

let db = null;
let sesionActual = null;
let vistaActual = "dashboard";
let filtroProductoTexto = "";
let filtroProductoEstado = "TODOS";

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function formatoMoneda(valor) {
  return "$" + Math.round(valor).toLocaleString("es-CO");
}

function formatoFecha(iso) {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function cargarDB() {
  const guardado = localStorage.getItem(CLAVE_DB);
  if (guardado) {
    db = JSON.parse(guardado);
  } else {
    db = crearDatosIniciales();
    guardarDB();
  }
}

function guardarDB() {
  localStorage.setItem(CLAVE_DB, JSON.stringify(db));
}

function crearDatosIniciales() {
  const base = {
    usuarios: [
      { id: 1, nombre: "Martin Ríos", correo: "admin@demo.com", clave: "admin123", rol: "ADMINISTRADOR" },
      { id: 2, nombre: "Damir Bodega", correo: "bodega@demo.com", clave: "bodega123", rol: "BODEGUERO" },
      { id: 3, nombre: "Tafur Ventas", correo: "ventas@demo.com", clave: "ventas123", rol: "VENDEDOR" }
    ],
    productos: [
      {
        codigo: "P-001",
        nombre: "Yogur natural 1L",
        descripcion: "Lácteo refrigerado",
        precio: 8500,
        esPerecedero: true,
        lotes: [
          { id: 1, cantidad: 40, fechaVencimiento: sumarDias(hoyISO(), 5), estado: "VIGENTE" },
          { id: 2, cantidad: 15, fechaVencimiento: sumarDias(hoyISO(), -2), estado: "VIGENTE" }
        ]
      },
      {
        codigo: "P-002",
        nombre: "Arroz premium 1kg",
        descripcion: "Grano seco, no perecedero",
        precio: 4200,
        esPerecedero: false,
        lotes: [
          { id: 3, cantidad: 120, fechaVencimiento: null, estado: "VIGENTE" }
        ]
      },
      {
        codigo: "P-003",
        nombre: "Queso campesino 500g",
        descripcion: "Lácteo refrigerado",
        precio: 11900,
        esPerecedero: true,
        lotes: [
          { id: 4, cantidad: 8, fechaVencimiento: sumarDias(hoyISO(), 25), estado: "VIGENTE" }
        ]
      }
    ],
    movimientos: [],
    alertas: [],
    config: { umbralDias: 30 },
    contadores: { lote: 5, movimiento: 1, alerta: 1, usuario: 4 }
  };
  recalcularEstados(base, false);
  return base;
}

function sumarDias(iso, dias) {
  const fecha = new Date(iso);
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function calcularEstadoLote(fechaVencimiento, umbralDias) {
  if (!fechaVencimiento) return "VIGENTE";
  const hoy = new Date(hoyISO());
  const vence = new Date(fechaVencimiento);
  const limite = new Date(hoy);
  limite.setDate(limite.getDate() + umbralDias);
  if (vence < hoy) return "VENCIDO";
  if (vence <= limite) return "PROXIMO_A_VENCER";
  return "VIGENTE";
}

function recalcularEstados(base, generarAlertas) {
  const destino = base || db;
  destino.productos.forEach((producto) => {
    producto.lotes.forEach((lote) => {
      const anterior = lote.estado;
      lote.estado = calcularEstadoLote(lote.fechaVencimiento, destino.config.umbralDias);
      if (generarAlertas && lote.estado !== anterior &&
          (lote.estado === "PROXIMO_A_VENCER" || lote.estado === "VENCIDO")) {
        destino.alertas.unshift({
          id: destino.contadores.alerta++,
          codigoProducto: producto.codigo,
          nombreProducto: producto.nombre,
          loteId: lote.id,
          estado: lote.estado,
          mensaje: `El lote #${lote.id} de "${producto.nombre}" pasó a estado ${etiquetaEstado(lote.estado)}`,
          fecha: hoyISO()
        });
      }
    });
  });
}

function etiquetaEstado(estado) {
  if (estado === "VIGENTE") return "vigente";
  if (estado === "PROXIMO_A_VENCER") return "próximo a vencer";
  return "vencido";
}

function insigniaEstado(estado) {
  const clase = estado === "VIGENTE" ? "insignia-vigente" : estado === "PROXIMO_A_VENCER" ? "insignia-proximo" : "insignia-vencido";
  return `<span class="insignia ${clase}">${etiquetaEstado(estado)}</span>`;
}

function stockTotal(producto) {
  return producto.lotes.reduce((suma, lote) => suma + lote.cantidad, 0);
}

function valorizacionProducto(producto) {
  return stockTotal(producto) * producto.precio;
}

function iniciarSesion(correo, clave) {
  const usuario = db.usuarios.find((u) => u.correo === correo && u.clave === clave);
  if (!usuario) return null;
  sesionActual = usuario;
  sessionStorage.setItem(CLAVE_SESION, String(usuario.id));
  return usuario;
}

function restaurarSesion() {
  const idGuardado = sessionStorage.getItem(CLAVE_SESION);
  if (!idGuardado) return false;
  const usuario = db.usuarios.find((u) => u.id === Number(idGuardado));
  if (!usuario) return false;
  sesionActual = usuario;
  return true;
}

function cerrarSesion() {
  sesionActual = null;
  sessionStorage.removeItem(CLAVE_SESION);
  document.getElementById("app").classList.add("oculto");
  document.getElementById("pantalla-login").classList.remove("oculto");
  document.getElementById("form-login").reset();
}

function permisosActuales() {
  return PERMISOS[sesionActual.rol];
}

function mostrarApp() {
  document.getElementById("pantalla-login").classList.add("oculto");
  document.getElementById("app").classList.remove("oculto");
  document.getElementById("usuario-nombre").textContent = sesionActual.nombre;
  document.getElementById("usuario-rol").textContent = etiquetaRol(sesionActual.rol);
  const vistasPermitidas = permisosActuales().vistas;
  vistaActual = vistasPermitidas.includes(vistaActual) ? vistaActual : vistasPermitidas[0];
  renderNav();
  renderVista();
}

function etiquetaRol(rol) {
  if (rol === "ADMINISTRADOR") return "Administrador";
  if (rol === "BODEGUERO") return "Bodeguero";
  return "Vendedor";
}

function renderNav() {
  const nav = document.getElementById("nav-principal");
  const vistas = permisosActuales().vistas;
  nav.innerHTML = vistas.map((v) => {
    const activo = v === vistaActual ? "activo" : "";
    return `<button class="nav-item ${activo}" data-vista="${v}">${ETIQUETAS_VISTA[v][0]}</button>`;
  }).join("");
  nav.querySelectorAll(".nav-item").forEach((boton) => {
    boton.addEventListener("click", () => {
      vistaActual = boton.dataset.vista;
      renderNav();
      renderVista();
    });
  });
}

function renderVista() {
  document.querySelectorAll(".vista").forEach((s) => s.classList.remove("activa"));
  document.getElementById("titulo-vista").textContent = ETIQUETAS_VISTA[vistaActual][0];
  document.getElementById("subtitulo-vista").textContent = ETIQUETAS_VISTA[vistaActual][1];
  const seccion = document.getElementById("vista-" + vistaActual);
  seccion.classList.add("activa");

  if (vistaActual === "dashboard") renderDashboard(seccion);
  if (vistaActual === "productos") renderProductos(seccion);
  if (vistaActual === "movimientos") renderMovimientos(seccion);
  if (vistaActual === "vencimientos") renderVencimientos(seccion);
  if (vistaActual === "reportes") renderReportes(seccion);
  if (vistaActual === "usuarios") renderUsuarios(seccion);
}

function renderDashboard(seccion) {
  recalcularEstados(db, false);
  const valorTotal = db.productos.reduce((s, p) => s + valorizacionProducto(p), 0);
  const bajoStock = db.productos.filter((p) => stockTotal(p) <= 10).length;
  const proximos = db.productos.reduce((s, p) => s + p.lotes.filter((l) => l.estado === "PROXIMO_A_VENCER").length, 0);
  const vencidos = db.productos.reduce((s, p) => s + p.lotes.filter((l) => l.estado === "VENCIDO").length, 0);

  seccion.innerHTML = `
    <div class="tarjetas-kpi">
      <div class="kpi acento-teal"><p>Valor total del inventario</p><p class="kpi-valor">${formatoMoneda(valorTotal)}</p></div>
      <div class="kpi"><p>Productos con bajo stock (≤10)</p><p class="kpi-valor">${bajoStock}</p></div>
      <div class="kpi acento-amber"><p>Lotes próximos a vencer</p><p class="kpi-valor">${proximos}</p></div>
      <div class="kpi acento-rojo"><p>Lotes vencidos</p><p class="kpi-valor">${vencidos}</p></div>
    </div>
    <div class="panel">
      <p class="panel-titulo">Alertas recientes</p>
      ${db.alertas.length === 0
        ? `<p class="mensaje-vacio">Aún no se han generado alertas. Ve a "Vencimientos" y evalúa el inventario.</p>`
        : `<table><thead><tr><th>Fecha</th><th>Producto</th><th>Lote</th><th>Estado</th><th>Mensaje</th></tr></thead><tbody>
            ${db.alertas.slice(0, 8).map((a) => `
              <tr><td>${formatoFecha(a.fecha)}</td><td>${a.nombreProducto}</td><td>#${a.loteId}</td><td>${insigniaEstado(a.estado)}</td><td>${a.mensaje}</td></tr>
            `).join("")}
          </tbody></table>`}
    </div>
  `;
}

function productosFiltrados() {
  return db.productos.filter((p) => {
    const coincideTexto = !filtroProductoTexto ||
      p.nombre.toLowerCase().includes(filtroProductoTexto) ||
      p.codigo.toLowerCase().includes(filtroProductoTexto);
    const coincideEstado = filtroProductoEstado === "TODOS" ||
      p.lotes.some((l) => l.estado === filtroProductoEstado);
    return coincideTexto && coincideEstado;
  });
}

function renderProductos(seccion) {
  recalcularEstados(db, false);
  const permisos = permisosActuales();
  const lista = productosFiltrados();

  seccion.innerHTML = `
    <div class="panel">
      <div class="fila-herramientas">
        <input type="text" id="buscador-producto" placeholder="Buscar por código o nombre" value="${filtroProductoTexto}">
        <select id="filtro-estado-producto">
          <option value="TODOS">Todos los estados</option>
          <option value="VIGENTE">Vigente</option>
          <option value="PROXIMO_A_VENCER">Próximo a vencer</option>
          <option value="VENCIDO">Vencido</option>
        </select>
        ${permisos.productosEscribir ? `<button class="boton boton-primario" id="boton-nuevo-producto">Registrar producto</button>` : ""}
      </div>
      ${lista.length === 0 ? `<p class="mensaje-vacio">No hay productos que coincidan con la búsqueda.</p>` : `
      <table>
        <thead><tr><th>Código</th><th>Nombre</th><th>Precio</th><th>Stock</th><th>Estado</th>${permisos.productosEscribir ? "<th></th>" : ""}</tr></thead>
        <tbody>
          ${lista.map((p) => {
            const peorEstado = p.lotes.some((l) => l.estado === "VENCIDO") ? "VENCIDO"
              : p.lotes.some((l) => l.estado === "PROXIMO_A_VENCER") ? "PROXIMO_A_VENCER" : "VIGENTE";
            return `
            <tr>
              <td>${p.codigo}</td>
              <td>${p.nombre}${p.esPerecedero ? ' <span class="insignia insignia-proximo">perecedero</span>' : ""}</td>
              <td>${formatoMoneda(p.precio)}</td>
              <td>${stockTotal(p)}</td>
              <td>${insigniaEstado(peorEstado)}</td>
              ${permisos.productosEscribir ? `
              <td class="acciones-fila">
                <button data-accion="lote" data-codigo="${p.codigo}">+ Lote</button>
                <button data-accion="editar" data-codigo="${p.codigo}">Editar</button>
                ${permisos.productosEliminar ? `<button class="boton-peligro" data-accion="eliminar" data-codigo="${p.codigo}">Eliminar</button>` : ""}
              </td>` : ""}
            </tr>`;
          }).join("")}
        </tbody>
      </table>`}
    </div>
  `;

  document.getElementById("buscador-producto").addEventListener("input", (e) => {
    filtroProductoTexto = e.target.value.toLowerCase();
    renderProductos(seccion);
  });
  document.getElementById("filtro-estado-producto").value = filtroProductoEstado;
  document.getElementById("filtro-estado-producto").addEventListener("change", (e) => {
    filtroProductoEstado = e.target.value;
    renderProductos(seccion);
  });

  const botonNuevo = document.getElementById("boton-nuevo-producto");
  if (botonNuevo) botonNuevo.addEventListener("click", () => abrirFormularioProducto());

  seccion.querySelectorAll("[data-accion]").forEach((boton) => {
    boton.addEventListener("click", () => {
      const codigo = boton.dataset.codigo;
      const producto = db.productos.find((p) => p.codigo === codigo);
      if (boton.dataset.accion === "editar") abrirFormularioProducto(producto);
      if (boton.dataset.accion === "lote") abrirFormularioLote(producto);
      if (boton.dataset.accion === "eliminar") confirmarEliminarProducto(producto);
    });
  });
}

function abrirModal(html) {
  document.getElementById("modal-caja").innerHTML = html;
  document.getElementById("modal-fondo").classList.remove("oculto");
}

function cerrarModal() {
  document.getElementById("modal-fondo").classList.add("oculto");
}

document.addEventListener("click", (e) => {
  if (e.target.id === "modal-fondo") cerrarModal();
});

function abrirFormularioProducto(producto) {
  const esEdicion = Boolean(producto);
  abrirModal(`
    <h3>${esEdicion ? "Editar producto" : "Registrar producto"}</h3>
    <form id="form-producto">
      <div class="formulario-grid">
        <div class="campo"><label>Código</label><input name="codigo" value="${esEdicion ? producto.codigo : ""}" ${esEdicion ? "disabled" : ""} required></div>
        <div class="campo"><label>Nombre</label><input name="nombre" value="${esEdicion ? producto.nombre : ""}" required></div>
        <div class="campo"><label>Precio</label><input name="precio" type="number" min="0" step="1" value="${esEdicion ? producto.precio : ""}" required></div>
        <div class="campo campo-check"><input type="checkbox" name="esPerecedero" id="check-perecedero" ${esEdicion && producto.esPerecedero ? "checked" : ""}><label for="check-perecedero">Es perecedero</label></div>
      </div>
      <div class="campo"><label>Descripción</label><input name="descripcion" value="${esEdicion ? producto.descripcion : ""}"></div>
      <p class="mensaje-error" id="error-producto"></p>
      <div class="modal-acciones">
        <button type="button" class="boton boton-secundario" id="cancelar-producto">Cancelar</button>
        <button type="submit" class="boton boton-primario">Guardar</button>
      </div>
    </form>
  `);
  document.getElementById("cancelar-producto").addEventListener("click", cerrarModal);
  document.getElementById("form-producto").addEventListener("submit", (e) => {
    e.preventDefault();
    const datos = new FormData(e.target);
    const codigo = (datos.get("codigo") || "").trim();
    const nombre = datos.get("nombre").trim();
    const precio = Number(datos.get("precio"));
    const esPerecedero = datos.get("esPerecedero") === "on";
    const descripcion = datos.get("descripcion").trim();
    const error = document.getElementById("error-producto");

    if (!esEdicion && db.productos.some((p) => p.codigo === codigo)) {
      error.textContent = "Ya existe un producto con ese código.";
      return;
    }
    if (precio <= 0) {
      error.textContent = "El precio debe ser mayor a cero.";
      return;
    }

    if (esEdicion) {
      producto.nombre = nombre;
      producto.precio = precio;
      producto.esPerecedero = esPerecedero;
      producto.descripcion = descripcion;
    } else {
      db.productos.push({ codigo, nombre, descripcion, precio, esPerecedero, lotes: [] });
    }
    guardarDB();
    cerrarModal();
    renderVista();
  });
}

function abrirFormularioLote(producto) {
  abrirModal(`
    <h3>Nuevo lote — ${producto.nombre}</h3>
    <div class="nota-regla">${producto.esPerecedero ? "Este producto es perecedero: la fecha de vencimiento es obligatoria." : "Este producto no es perecedero: no requiere fecha de vencimiento."}</div>
    <form id="form-lote">
      <div class="formulario-grid">
        <div class="campo"><label>Cantidad</label><input name="cantidad" type="number" min="1" step="1" required></div>
        ${producto.esPerecedero ? `<div class="campo"><label>Fecha de vencimiento</label><input name="fecha" type="date" required></div>` : ""}
      </div>
      <p class="mensaje-error" id="error-lote"></p>
      <div class="modal-acciones">
        <button type="button" class="boton boton-secundario" id="cancelar-lote">Cancelar</button>
        <button type="submit" class="boton boton-primario">Guardar</button>
      </div>
    </form>
  `);
  document.getElementById("cancelar-lote").addEventListener("click", cerrarModal);
  document.getElementById("form-lote").addEventListener("submit", (e) => {
    e.preventDefault();
    const datos = new FormData(e.target);
    const cantidad = Number(datos.get("cantidad"));
    const fecha = datos.get("fecha") || null;
    const error = document.getElementById("error-lote");

    if (cantidad <= 0) {
      error.textContent = "La cantidad debe ser mayor a cero.";
      return;
    }
    if (producto.esPerecedero && !fecha) {
      error.textContent = "Debes indicar la fecha de vencimiento.";
      return;
    }

    producto.lotes.push({
      id: db.contadores.lote++,
      cantidad,
      fechaVencimiento: producto.esPerecedero ? fecha : null,
      estado: "VIGENTE"
    });
    recalcularEstados(db, false);
    guardarDB();
    cerrarModal();
    renderVista();
  });
}

function confirmarEliminarProducto(producto) {
  abrirModal(`
    <h3>Eliminar producto</h3>
    <p>¿Seguro que quieres eliminar "${producto.nombre}" (${producto.codigo})? Esta acción no se puede deshacer.</p>
    <div class="modal-acciones">
      <button class="boton boton-secundario" id="cancelar-eliminar">Cancelar</button>
      <button class="boton" style="background:var(--rojo);color:#fff" id="confirmar-eliminar">Eliminar</button>
    </div>
  `);
  document.getElementById("cancelar-eliminar").addEventListener("click", cerrarModal);
  document.getElementById("confirmar-eliminar").addEventListener("click", () => {
    db.productos = db.productos.filter((p) => p.codigo !== producto.codigo);
    guardarDB();
    cerrarModal();
    renderVista();
  });
}

function opcionesLote(producto) {
  return producto.lotes.map((l) => `<option value="${l.id}">Lote #${l.id} — ${l.cantidad} u. — ${formatoFecha(l.fechaVencimiento)}</option>`).join("");
}

function renderMovimientos(seccion) {
  const productos = db.productos;
  seccion.innerHTML = `
    <div class="panel">
      <p class="panel-titulo">Registrar movimiento</p>
      <div class="nota-regla">El stock nunca puede quedar en cantidades negativas: una salida se rechaza si supera el stock del lote.</div>
      <form id="form-movimiento">
        <div class="formulario-grid">
          <div class="campo">
            <label>Producto</label>
            <select id="select-producto-mov" name="producto">
              ${productos.map((p) => `<option value="${p.codigo}">${p.codigo} — ${p.nombre}</option>`).join("")}
            </select>
          </div>
          <div class="campo">
            <label>Lote</label>
            <select id="select-lote-mov" name="lote"></select>
          </div>
          <div class="campo">
            <label>Tipo de movimiento</label>
            <select name="tipo">
              <option value="ENTRADA">Entrada</option>
              <option value="SALIDA">Salida</option>
              <option value="DEVOLUCION">Devolución</option>
            </select>
          </div>
          <div class="campo"><label>Cantidad</label><input name="cantidad" type="number" min="1" step="1" required></div>
        </div>
        <p class="mensaje-error" id="error-movimiento"></p>
        <button type="submit" class="boton boton-primario">Registrar</button>
      </form>
    </div>
    <div class="panel">
      <p class="panel-titulo">Historial de movimientos</p>
      ${db.movimientos.length === 0 ? `<p class="mensaje-vacio">Todavía no hay movimientos registrados.</p>` : `
      <table>
        <thead><tr><th>Fecha</th><th>Producto</th><th>Lote</th><th>Tipo</th><th>Cantidad</th><th>Usuario</th></tr></thead>
        <tbody>
          ${db.movimientos.slice().reverse().map((m) => `
            <tr><td>${formatoFecha(m.fecha)}</td><td>${m.nombreProducto}</td><td>#${m.loteId}</td><td>${m.tipo}</td><td>${m.cantidad}</td><td>${m.usuario}</td></tr>
          `).join("")}
        </tbody>
      </table>`}
    </div>
  `;

  const selectProducto = document.getElementById("select-producto-mov");
  const selectLote = document.getElementById("select-lote-mov");
  const actualizarLotes = () => {
    const producto = db.productos.find((p) => p.codigo === selectProducto.value);
    selectLote.innerHTML = producto ? opcionesLote(producto) : "";
  };
  selectProducto.addEventListener("change", actualizarLotes);
  actualizarLotes();

  document.getElementById("form-movimiento").addEventListener("submit", (e) => {
    e.preventDefault();
    const datos = new FormData(e.target);
    const codigoProducto = datos.get("producto");
    const loteId = Number(datos.get("lote"));
    const tipo = datos.get("tipo");
    const cantidad = Number(datos.get("cantidad"));
    const error = document.getElementById("error-movimiento");

    const producto = db.productos.find((p) => p.codigo === codigoProducto);
    const lote = producto.lotes.find((l) => l.id === loteId);

    if (!lote) {
      error.textContent = "Selecciona un lote válido.";
      return;
    }
    if (tipo === "SALIDA" && lote.cantidad - cantidad < 0) {
      error.textContent = `Stock insuficiente: el lote #${lote.id} solo tiene ${lote.cantidad} unidades.`;
      return;
    }

    lote.cantidad = tipo === "SALIDA" ? lote.cantidad - cantidad : lote.cantidad + cantidad;

    db.movimientos.push({
      id: db.contadores.movimiento++,
      codigoProducto,
      nombreProducto: producto.nombre,
      loteId,
      tipo,
      cantidad,
      fecha: hoyISO(),
      usuario: sesionActual.nombre
    });

    guardarDB();
    renderVista();
  });
}

function renderVencimientos(seccion) {
  recalcularEstados(db, false);
  const permisos = permisosActuales();
  const lotesRiesgo = [];
  db.productos.forEach((p) => p.lotes.forEach((l) => {
    if (l.estado !== "VIGENTE") lotesRiesgo.push({ ...l, producto: p });
  }));

  seccion.innerHTML = `
    <div class="panel">
      <div class="fila-herramientas">
        <label style="color:var(--texto-muted);font-size:13px">Umbral "próximo a vencer" (días)</label>
        <input type="number" id="input-umbral" min="1" value="${db.config.umbralDias}" style="width:90px" ${permisos.vencimientosEvaluar ? "" : "disabled"}>
        ${permisos.vencimientosEvaluar ? `<button class="boton boton-primario" id="boton-evaluar">Evaluar vencimientos ahora</button>` : ""}
      </div>
      <div class="nota-regla">El umbral es configurable (ej. 30, 15 o 7 días). Un lote vencido siempre queda marcado como VENCIDO, sin importar el umbral.</div>
      ${lotesRiesgo.length === 0 ? `<p class="mensaje-vacio">No hay lotes próximos a vencer ni vencidos.</p>` : `
      <table>
        <thead><tr><th>Producto</th><th>Lote</th><th>Cantidad</th><th>Vence</th><th>Estado</th></tr></thead>
        <tbody>
          ${lotesRiesgo.map((l) => `
            <tr><td>${l.producto.nombre}</td><td>#${l.id}</td><td>${l.cantidad}</td><td>${formatoFecha(l.fechaVencimiento)}</td><td>${insigniaEstado(l.estado)}</td></tr>
          `).join("")}
        </tbody>
      </table>`}
    </div>
  `;

  const botonEvaluar = document.getElementById("boton-evaluar");
  if (botonEvaluar) {
    botonEvaluar.addEventListener("click", () => {
      db.config.umbralDias = Number(document.getElementById("input-umbral").value) || db.config.umbralDias;
      recalcularEstados(db, true);
      guardarDB();
      renderVista();
    });
  }
}

function renderReportes(seccion) {
  recalcularEstados(db, false);
  const valorTotal = db.productos.reduce((s, p) => s + valorizacionProducto(p), 0);

  seccion.innerHTML = `
    <div class="panel">
      <p class="panel-titulo">Valorización del inventario</p>
      <table>
        <thead><tr><th>Producto</th><th>Stock</th><th>Precio unitario</th><th>Valorización</th></tr></thead>
        <tbody>
          ${db.productos.map((p) => `
            <tr><td>${p.nombre}</td><td>${stockTotal(p)}</td><td>${formatoMoneda(p.precio)}</td><td>${formatoMoneda(valorizacionProducto(p))}</td></tr>
          `).join("")}
        </tbody>
        <tfoot><tr><td colspan="3" style="text-align:right;color:var(--texto-muted)">Total</td><td style="font-weight:700">${formatoMoneda(valorTotal)}</td></tr></tfoot>
      </table>
    </div>

    <div class="panel">
      <p class="panel-titulo">Historial de movimientos por producto</p>
      <select id="filtro-reporte-producto" style="margin-bottom:14px;background:var(--panel-alt);border:1px solid var(--borde);color:var(--texto);border-radius:7px;padding:8px 10px">
        <option value="TODOS">Todos los productos</option>
        ${db.productos.map((p) => `<option value="${p.codigo}">${p.nombre}</option>`).join("")}
      </select>
      <div id="tabla-historial"></div>
    </div>
  `;

  const pintarHistorial = (codigo) => {
    const filtrados = codigo === "TODOS" ? db.movimientos : db.movimientos.filter((m) => m.codigoProducto === codigo);
    document.getElementById("tabla-historial").innerHTML = filtrados.length === 0
      ? `<p class="mensaje-vacio">Sin movimientos para este filtro.</p>`
      : `<table><thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th></tr></thead><tbody>
          ${filtrados.slice().reverse().map((m) => `<tr><td>${formatoFecha(m.fecha)}</td><td>${m.nombreProducto}</td><td>${m.tipo}</td><td>${m.cantidad}</td></tr>`).join("")}
        </tbody></table>`;
  };
  pintarHistorial("TODOS");
  document.getElementById("filtro-reporte-producto").addEventListener("change", (e) => pintarHistorial(e.target.value));
}

function renderUsuarios(seccion) {
  seccion.innerHTML = `
    <div class="panel">
      <div class="fila-herramientas">
        <button class="boton boton-primario" id="boton-nuevo-usuario">Registrar usuario</button>
      </div>
      <table>
        <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th></th></tr></thead>
        <tbody>
          ${db.usuarios.map((u) => `
            <tr>
              <td>${u.nombre}</td><td>${u.correo}</td><td>${etiquetaRol(u.rol)}</td>
              <td class="acciones-fila">
                ${u.id === sesionActual.id ? "" : `<button class="boton-peligro" data-id="${u.id}">Eliminar</button>`}
              </td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </div>
  `;

  document.getElementById("boton-nuevo-usuario").addEventListener("click", abrirFormularioUsuario);
  seccion.querySelectorAll("[data-id]").forEach((boton) => {
    boton.addEventListener("click", () => {
      const id = Number(boton.dataset.id);
      db.usuarios = db.usuarios.filter((u) => u.id !== id);
      guardarDB();
      renderVista();
    });
  });
}

function abrirFormularioUsuario() {
  abrirModal(`
    <h3>Registrar usuario</h3>
    <form id="form-usuario">
      <div class="formulario-grid">
        <div class="campo"><label>Nombre</label><input name="nombre" required></div>
        <div class="campo"><label>Correo</label><input name="correo" type="email" required></div>
        <div class="campo"><label>Contraseña</label><input name="clave" type="password" required></div>
        <div class="campo">
          <label>Rol</label>
          <select name="rol">
            <option value="ADMINISTRADOR">Administrador</option>
            <option value="BODEGUERO">Bodeguero</option>
            <option value="VENDEDOR">Vendedor</option>
          </select>
        </div>
      </div>
      <p class="mensaje-error" id="error-usuario"></p>
      <div class="modal-acciones">
        <button type="button" class="boton boton-secundario" id="cancelar-usuario">Cancelar</button>
        <button type="submit" class="boton boton-primario">Guardar</button>
      </div>
    </form>
  `);
  document.getElementById("cancelar-usuario").addEventListener("click", cerrarModal);
  document.getElementById("form-usuario").addEventListener("submit", (e) => {
    e.preventDefault();
    const datos = new FormData(e.target);
    const correo = datos.get("correo").trim();
    const error = document.getElementById("error-usuario");
    if (db.usuarios.some((u) => u.correo === correo)) {
      error.textContent = "Ya existe un usuario con ese correo.";
      return;
    }
    db.usuarios.push({
      id: db.contadores.usuario++,
      nombre: datos.get("nombre").trim(),
      correo,
      clave: datos.get("clave"),
      rol: datos.get("rol")
    });
    guardarDB();
    cerrarModal();
    renderVista();
  });
}

document.getElementById("form-login").addEventListener("submit", (e) => {
  e.preventDefault();
  const correo = document.getElementById("input-correo").value.trim();
  const clave = document.getElementById("input-clave").value;
  const usuario = iniciarSesion(correo, clave);
  const error = document.getElementById("login-error");
  if (!usuario) {
    error.textContent = "Correo o contraseña incorrectos.";
    return;
  }
  error.textContent = "";
  mostrarApp();
});

document.getElementById("boton-salir").addEventListener("click", cerrarSesion);

cargarDB();
if (restaurarSesion()) {
  mostrarApp();
}
