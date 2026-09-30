const CLAVE_DB = "inventario_db_v1";
const CLAVE_SESION = "inventario_sesion_v1";

const ETIQUETAS_VISTA = {
  dashboard: ["Panel", "Indicadores generales del inventario"],
  productos: ["Productos", "Consulta, registro y edición de productos"],
  movimientos: ["Movimientos", "Entradas y salidas de stock por lote"],
  vencimientos: ["Vencimientos", "Clasificación automática de lotes y alertas"],
  reportes: ["Reportes", "Valorización, riesgo de vencimiento e historial"],
  usuarios: ["Usuarios", "Gestión de usuarios y roles del sistema"]
};

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

function sumarDias(iso, dias) {
  const fecha = new Date(iso);
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().slice(0, 10);
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

class Lote {
  #id;
  #cantidad;
  #fechaVencimiento;
  #estado;

  constructor(id, cantidad, fechaVencimiento = null, estado = "VIGENTE") {
    this.#id = id;
    this.#cantidad = Number(cantidad);
    this.#fechaVencimiento = fechaVencimiento;
    this.#estado = estado;
  }

  get id() { return this.#id; }
  get cantidad() { return this.#cantidad; }
  get fechaVencimiento() { return this.#fechaVencimiento; }
  get estado() { return this.#estado; }

  set estado(nuevoEstado) { this.#estado = nuevoEstado; }

  incrementar(cant) {
    this.#cantidad += Number(cant);
  }

  decrementar(cant) {
    const valor = Number(cant);
    if (valor > this.#cantidad) {
      throw new Error(`Stock insuficiente: el lote #${this.#id} solo tiene ${this.#cantidad} unidades.`);
    }
    this.#cantidad -= valor;
  }

  toJSON() {
    return {
      id: this.#id,
      cantidad: this.#cantidad,
      fechaVencimiento: this.#fechaVencimiento,
      estado: this.#estado
    };
  }
}

class Producto {
  #codigo;
  #nombre;
  #descripcion;
  #precio;
  #lotes;

  constructor(codigo, nombre, descripcion, precio, lotes = []) {
    this.#codigo = codigo;
    this.#nombre = nombre;
    this.#descripcion = descripcion;
    this.#precio = Number(precio);
    this.#lotes = lotes.map(l => (l instanceof Lote ? l : new Lote(l.id, l.cantidad, l.fechaVencimiento, l.estado)));
  }

  get codigo() { return this.#codigo; }
  get nombre() { return this.#nombre; }
  set nombre(val) { this.#nombre = val; }
  get descripcion() { return this.#descripcion; }
  set descripcion(val) { this.#descripcion = val; }
  get precio() { return this.#precio; }
  set precio(val) { this.#precio = Number(val); }
  get lotes() { return this.#lotes; }

  get esPerecedero() { return false; }

  agregarLote(id, cantidad, fechaVencimiento) {
    const lote = new Lote(id, cantidad, this.validarFechaLote(fechaVencimiento));
    this.#lotes.push(lote);
    return lote;
  }

  validarFechaLote(fecha) {
    return null;
  }

  calcularEstadoLote(lote, umbralDias) {
    return "VIGENTE";
  }

  get stockTotal() {
    return this.#lotes.reduce((sum, l) => sum + l.cantidad, 0);
  }

  get valorizacion() {
    return this.stockTotal * this.#precio;
  }

  get peorEstado() {
    if (this.#lotes.some(l => l.estado === "VENCIDO")) return "VENCIDO";
    if (this.#lotes.some(l => l.estado === "PROXIMO_A_VENCER")) return "PROXIMO_A_VENCER";
    return "VIGENTE";
  }

  toJSON() {
    return {
      codigo: this.#codigo,
      nombre: this.#nombre,
      descripcion: this.#descripcion,
      precio: this.#precio,
      esPerecedero: this.esPerecedero,
      lotes: this.#lotes.map(l => l.toJSON())
    };
  }
}

class ProductoPerecedero extends Producto {
  get esPerecedero() { return true; }

  validarFechaLote(fecha) {
    if (!fecha) throw new Error("Debes indicar la fecha de vencimiento.");
    return fecha;
  }

  calcularEstadoLote(lote, umbralDias) {
    if (!lote.fechaVencimiento) return "VIGENTE";
    const hoy = new Date(hoyISO());
    const vence = new Date(lote.fechaVencimiento);
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + umbralDias);

    if (vence < hoy) return "VENCIDO";
    if (vence <= limite) return "PROXIMO_A_VENCER";
    return "VIGENTE";
  }
}

class ProductoNoPerecedero extends Producto {
  get esPerecedero() { return false; }
}

function crearProducto(datos) {
  if (datos.esPerecedero) {
    return new ProductoPerecedero(datos.codigo, datos.nombre, datos.descripcion, datos.precio, datos.lotes);
  }
  return new ProductoNoPerecedero(datos.codigo, datos.nombre, datos.descripcion, datos.precio, datos.lotes);
}

class Usuario {
  #id;
  #nombre;
  #correo;
  #clave;

  constructor(id, nombre, correo, clave) {
    this.#id = id;
    this.#nombre = nombre;
    this.#correo = correo;
    this.#clave = clave;
  }

  get id() { return this.#id; }
  get nombre() { return this.#nombre; }
  get correo() { return this.#correo; }
  get clave() { return this.#clave; }

  get rol() { return "USUARIO"; }
  get etiquetaRol() { return "Usuario"; }
  get vistasPermitidas() { return ["dashboard", "productos"]; }
  puedeEscribirProductos() { return false; }
  puedeEliminarProductos() { return false; }
  puedeRegistrarMovimientos() { return false; }
  puedeEvaluarVencimientos() { return false; }
  puedeGestionarUsuarios() { return false; }

  validarClave(claveIngresada) {
    return this.#clave === claveIngresada;
  }

  toJSON() {
    return {
      id: this.#id,
      nombre: this.#nombre,
      correo: this.#correo,
      clave: this.#clave,
      rol: this.rol
    };
  }
}

class Administrador extends Usuario {
  get rol() { return "ADMINISTRADOR"; }
  get etiquetaRol() { return "Administrador"; }
  get vistasPermitidas() {
    return ["dashboard", "productos", "movimientos", "vencimientos", "reportes", "usuarios"];
  }
  puedeEscribirProductos() { return true; }
  puedeEliminarProductos() { return true; }
  puedeRegistrarMovimientos() { return true; }
  puedeEvaluarVencimientos() { return true; }
  puedeGestionarUsuarios() { return true; }
}

class Bodeguero extends Usuario {
  get rol() { return "BODEGUERO"; }
  get etiquetaRol() { return "Bodeguero"; }
  get vistasPermitidas() {
    return ["dashboard", "productos", "movimientos", "vencimientos", "reportes"];
  }
  puedeEscribirProductos() { return true; }
  puedeEliminarProductos() { return false; }
  puedeRegistrarMovimientos() { return true; }
  puedeEvaluarVencimientos() { return true; }
  puedeGestionarUsuarios() { return false; }
}

class Vendedor extends Usuario {
  get rol() { return "VENDEDOR"; }
  get etiquetaRol() { return "Vendedor"; }
  get vistasPermitidas() {
    return ["dashboard", "productos"];
  }
}

function crearUsuario(datos) {
  switch (datos.rol) {
    case "ADMINISTRADOR":
      return new Administrador(datos.id, datos.nombre, datos.correo, datos.clave);
    case "BODEGUERO":
      return new Bodeguero(datos.id, datos.nombre, datos.correo, datos.clave);
    case "VENDEDOR":
      return new Vendedor(datos.id, datos.nombre, datos.correo, datos.clave);
    default:
      return new Usuario(datos.id, datos.nombre, datos.correo, datos.clave);
  }
}

class Movimiento {
  constructor(id, codigoProducto, nombreProducto, loteId, cantidad, usuario, fecha = hoyISO()) {
    this.id = id;
    this.codigoProducto = codigoProducto;
    this.nombreProducto = nombreProducto;
    this.loteId = loteId;
    this.cantidad = Number(cantidad);
    this.usuario = usuario;
    this.fecha = fecha;
  }

  aplicar(lote) {
    throw new Error("El método aplicar() debe ser implementado.");
  }

  toJSON() {
    return {
      id: this.id,
      codigoProducto: this.codigoProducto,
      nombreProducto: this.nombreProducto,
      loteId: this.loteId,
      tipo: this.tipo,
      cantidad: this.cantidad,
      fecha: this.fecha,
      usuario: this.usuario
    };
  }
}

class MovimientoEntrada extends Movimiento {
  get tipo() { return "ENTRADA"; }
  aplicar(lote) {
    lote.incrementar(this.cantidad);
  }
}

class MovimientoSalida extends Movimiento {
  get tipo() { return "SALIDA"; }
  aplicar(lote) {
    lote.decrementar(this.cantidad);
  }
}

class MovimientoDevolucion extends Movimiento {
  get tipo() { return "DEVOLUCION"; }
  aplicar(lote) {
    lote.incrementar(this.cantidad);
  }
}

function crearMovimiento(datos) {
  if (datos.tipo === "SALIDA") {
    return new MovimientoSalida(datos.id, datos.codigoProducto, datos.nombreProducto, datos.loteId, datos.cantidad, datos.usuario, datos.fecha);
  }
  if (datos.tipo === "DEVOLUCION") {
    return new MovimientoDevolucion(datos.id, datos.codigoProducto, datos.nombreProducto, datos.loteId, datos.cantidad, datos.usuario, datos.fecha);
  }
  return new MovimientoEntrada(datos.id, datos.codigoProducto, datos.nombreProducto, datos.loteId, datos.cantidad, datos.usuario, datos.fecha);
}

class SistemaInventario {
  #usuarios = [];
  #productos = [];
  #movimientos = [];
  #alertas = [];
  #config = { umbralDias: 30 };
  #contadores = { lote: 5, movimiento: 1, alerta: 1, usuario: 4 };

  get usuarios() { return this.#usuarios; }
  get productos() { return this.#productos; }
  get movimientos() { return this.#movimientos; }
  get alertas() { return this.#alertas; }
  get config() { return this.#config; }
  get contadores() { return this.#contadores; }

  cargarDesdeObjeto(data) {
    this.#config = data.config || { umbralDias: 30 };
    this.#contadores = data.contadores || { lote: 5, movimiento: 1, alerta: 1, usuario: 4 };
    this.#usuarios = (data.usuarios || []).map(crearUsuario);
    this.#productos = (data.productos || []).map(crearProducto);
    this.#movimientos = (data.movimientos || []).map(crearMovimiento);
    this.#alertas = data.alertas || [];
    this.recalcularEstados(false);
  }

  guardar() {
    const data = {
      usuarios: this.#usuarios.map(u => u.toJSON()),
      productos: this.#productos.map(p => p.toJSON()),
      movimientos: this.#movimientos.map(m => m.toJSON()),
      alertas: this.#alertas,
      config: this.#config,
      contadores: this.#contadores
    };
    localStorage.setItem(CLAVE_DB, JSON.stringify(data));
  }

  recalcularEstados(generarAlertas = false) {
    this.#productos.forEach(producto => {
      producto.lotes.forEach(lote => {
        const anterior = lote.estado;
        lote.estado = producto.calcularEstadoLote(lote, this.#config.umbralDias);

        if (generarAlertas && lote.estado !== anterior && (lote.estado === "PROXIMO_A_VENCER" || lote.estado === "VENCIDO")) {
          this.#alertas.unshift({
            id: this.#contadores.alerta++,
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

  registrarMovimiento(movimiento, lote) {
    movimiento.aplicar(lote);
    this.#movimientos.push(movimiento);
    this.guardar();
  }

  agregarProducto(producto) {
    this.#productos.push(producto);
    this.guardar();
  }

  eliminarProducto(codigo) {
    this.#productos = this.#productos.filter(p => p.codigo !== codigo);
    this.guardar();
  }

  agregarUsuario(usuario) {
    this.#usuarios.push(usuario);
    this.guardar();
  }

  eliminarUsuario(id) {
    this.#usuarios = this.#usuarios.filter(u => u.id !== id);
    this.guardar();
  }
}

const sistema = new SistemaInventario();
let sesionActual = null;
let vistaActual = "dashboard";
let filtroProductoTexto = "";
let filtroProductoEstado = "TODOS";

function cargarDB() {
  const guardado = localStorage.getItem(CLAVE_DB);
  if (guardado) {
    sistema.cargarDesdeObjeto(JSON.parse(guardado));
  } else {
    sistema.cargarDesdeObjeto(crearDatosIniciales());
    sistema.guardar();
  }
}

function crearDatosIniciales() {
  return {
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
}

function iniciarSesion(correo, clave) {
  const usuario = sistema.usuarios.find(u => u.correo === correo && u.validarClave(clave));
  if (!usuario) return null;
  sesionActual = usuario;
  sessionStorage.setItem(CLAVE_SESION, String(usuario.id));
  return usuario;
}

function restaurarSesion() {
  const idGuardado = sessionStorage.getItem(CLAVE_SESION);
  if (!idGuardado) return false;
  const usuario = sistema.usuarios.find(u => u.id === Number(idGuardado));
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

function mostrarApp() {
  document.getElementById("pantalla-login").classList.add("oculto");
  document.getElementById("app").classList.remove("oculto");
  document.getElementById("usuario-nombre").textContent = sesionActual.nombre;
  document.getElementById("usuario-rol").textContent = sesionActual.etiquetaRol;
  
  const vistasPermitidas = sesionActual.vistasPermitidas;
  vistaActual = vistasPermitidas.includes(vistaActual) ? vistaActual : vistasPermitidas[0];
  renderNav();
  renderVista();
}

function renderNav() {
  const nav = document.getElementById("nav-principal");
  const vistas = sesionActual.vistasPermitidas;
  nav.innerHTML = vistas.map(v => {
    const activo = v === vistaActual ? "activo" : "";
    return `<button class="nav-item ${activo}" data-vista="${v}">${ETIQUETAS_VISTA[v][0]}</button>`;
  }).join("");
  nav.querySelectorAll(".nav-item").forEach(boton => {
    boton.addEventListener("click", () => {
      vistaActual = boton.dataset.vista;
      renderNav();
      renderVista();
    });
  });
}

function renderVista() {
  document.querySelectorAll(".vista").forEach(s => s.classList.remove("activa"));
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
  sistema.recalcularEstados(false);
  const valorTotal = sistema.productos.reduce((s, p) => s + p.valorizacion, 0);
  const bajoStock = sistema.productos.filter(p => p.stockTotal <= 10).length;
  const proximos = sistema.productos.reduce((s, p) => s + p.lotes.filter(l => l.estado === "PROXIMO_A_VENCER").length, 0);
  const vencidos = sistema.productos.reduce((s, p) => s + p.lotes.filter(l => l.estado === "VENCIDO").length, 0);

  seccion.innerHTML = `
    <div class="tarjetas-kpi">
      <div class="kpi acento-teal"><p>Valor total del inventario</p><p class="kpi-valor">${formatoMoneda(valorTotal)}</p></div>
      <div class="kpi"><p>Productos con bajo stock (≤10)</p><p class="kpi-valor">${bajoStock}</p></div>
      <div class="kpi acento-amber"><p>Lotes próximos a vencer</p><p class="kpi-valor">${proximos}</p></div>
      <div class="kpi acento-rojo"><p>Lotes vencidos</p><p class="kpi-valor">${vencidos}</p></div>
    </div>
    <div class="panel">
      <p class="panel-titulo">Alertas recientes</p>
      ${sistema.alertas.length === 0
        ? `<p class="mensaje-vacio">Aún no se han generado alertas. Ve a "Vencimientos" y evalúa el inventario.</p>`
        : `<table><thead><tr><th>Fecha</th><th>Producto</th><th>Lote</th><th>Estado</th><th>Mensaje</th></tr></thead><tbody>
            ${sistema.alertas.slice(0, 8).map(a => `
              <tr><td>${formatoFecha(a.fecha)}</td><td>${a.nombreProducto}</td><td>#${a.loteId}</td><td>${insigniaEstado(a.estado)}</td><td>${a.mensaje}</td></tr>
            `).join("")}
          </tbody></table>`}
    </div>
  `;
}

function productosFiltrados() {
  return sistema.productos.filter(p => {
    const coincideTexto = !filtroProductoTexto ||
      p.nombre.toLowerCase().includes(filtroProductoTexto) ||
      p.codigo.toLowerCase().includes(filtroProductoTexto);
    const coincideEstado = filtroProductoEstado === "TODOS" ||
      p.lotes.some(l => l.estado === filtroProductoEstado);
    return coincideTexto && coincideEstado;
  });
}

function renderProductos(seccion) {
  sistema.recalcularEstados(false);
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
        ${sesionActual.puedeEscribirProductos() ? `<button class="boton boton-primario" id="boton-nuevo-producto">Registrar producto</button>` : ""}
      </div>
      ${lista.length === 0 ? `<p class="mensaje-vacio">No hay productos que coincidan con la búsqueda.</p>` : `
      <table>
        <thead><tr><th>Código</th><th>Nombre</th><th>Precio</th><th>Stock</th><th>Estado</th>${sesionActual.puedeEscribirProductos() ? "<th></th>" : ""}</tr></thead>
        <tbody>
          ${lista.map(p => `
            <tr>
              <td>${p.codigo}</td>
              <td>${p.nombre}${p.esPerecedero ? ' <span class="insignia insignia-proximo">perecedero</span>' : ""}</td>
              <td>${formatoMoneda(p.precio)}</td>
              <td>${p.stockTotal}</td>
              <td>${insigniaEstado(p.peorEstado)}</td>
              ${sesionActual.puedeEscribirProductos() ? `
              <td class="acciones-fila">
                <button data-accion="lote" data-codigo="${p.codigo}">+ Lote</button>
                <button data-accion="editar" data-codigo="${p.codigo}">Editar</button>
                ${sesionActual.puedeEliminarProductos() ? `<button class="boton-peligro" data-accion="eliminar" data-codigo="${p.codigo}">Eliminar</button>` : ""}
              </td>` : ""}
            </tr>`).join("")}
        </tbody>
      </table>`}
    </div>
  `;

  document.getElementById("buscador-producto").addEventListener("input", e => {
    filtroProductoTexto = e.target.value.toLowerCase();
    renderProductos(seccion);
  });
  document.getElementById("filtro-estado-producto").value = filtroProductoEstado;
  document.getElementById("filtro-estado-producto").addEventListener("change", e => {
    filtroProductoEstado = e.target.value;
    renderProductos(seccion);
  });

  const botonNuevo = document.getElementById("boton-nuevo-producto");
  if (botonNuevo) botonNuevo.addEventListener("click", () => abrirFormularioProducto());

  seccion.querySelectorAll("[data-accion]").forEach(boton => {
    boton.addEventListener("click", () => {
      const codigo = boton.dataset.codigo;
      const producto = sistema.productos.find(p => p.codigo === codigo);
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

document.addEventListener("click", e => {
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
  document.getElementById("form-producto").addEventListener("submit", e => {
    e.preventDefault();
    const datos = new FormData(e.target);
    const codigo = (datos.get("codigo") || "").trim();
    const nombre = datos.get("nombre").trim();
    const precio = Number(datos.get("precio"));
    const esPerecedero = datos.get("esPerecedero") === "on";
    const descripcion = datos.get("descripcion").trim();
    const error = document.getElementById("error-producto");

    if (!esEdicion && sistema.productos.some(p => p.codigo === codigo)) {
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
      producto.descripcion = descripcion;
      sistema.guardar();
    } else {
      const nuevo = crearProducto({ codigo, nombre, descripcion, precio, esPerecedero, lotes: [] });
      sistema.agregarProducto(nuevo);
    }

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
  document.getElementById("form-lote").addEventListener("submit", e => {
    e.preventDefault();
    const datos = new FormData(e.target);
    const cantidad = Number(datos.get("cantidad"));
    const fecha = datos.get("fecha") || null;
    const error = document.getElementById("error-lote");

    if (cantidad <= 0) {
      error.textContent = "La cantidad debe ser mayor a cero.";
      return;
    }

    try {
      producto.agregarLote(sistema.contadores.lote++, cantidad, fecha);
      sistema.recalcularEstados(false);
      sistema.guardar();
      cerrarModal();
      renderVista();
    } catch (err) {
      error.textContent = err.message;
    }
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
    sistema.eliminarProducto(producto.codigo);
    cerrarModal();
    renderVista();
  });
}

function opcionesLote(producto) {
  return producto.lotes.map(l => `<option value="${l.id}">Lote #${l.id} — ${l.cantidad} u. — ${formatoFecha(l.fechaVencimiento)}</option>`).join("");
}

function renderMovimientos(seccion) {
  const productos = sistema.productos;
  seccion.innerHTML = `
    <div class="panel">
      <p class="panel-titulo">Registrar movimiento</p>
      <div class="nota-regla">El stock nunca puede quedar en cantidades negativas: una salida se rechaza si supera el stock del lote.</div>
      <form id="form-movimiento">
        <div class="formulario-grid">
          <div class="campo">
            <label>Producto</label>
            <select id="select-producto-mov" name="producto">
              ${productos.map(p => `<option value="${p.codigo}">${p.codigo} —${p.nombre}</option>`).join("")}
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
      ${sistema.movimientos.length === 0 ? `<p class="mensaje-vacio">Todavía no hay movimientos registrados.</p>` : `
      <table>
        <thead><tr><th>Fecha</th><th>Producto</th><th>Lote</th><th>Tipo</th><th>Cantidad</th><th>Usuario</th></tr></thead>
        <tbody>
          ${sistema.movimientos.slice().reverse().map(m => `
            <tr><td>${formatoFecha(m.fecha)}</td><td>${m.nombreProducto}</td><td>#${m.loteId}</td><td>${m.tipo}</td><td>${m.cantidad}</td><td>${m.usuario}</td></tr>
          `).join("")}
        </tbody>
      </table>`}
    </div>
  `;

  const selectProducto = document.getElementById("select-producto-mov");
  const selectLote = document.getElementById("select-lote-mov");
  const actualizarLotes = () => {
    const producto = sistema.productos.find(p => p.codigo === selectProducto.value);
    selectLote.innerHTML = producto ? opcionesLote(producto) : "";
  };
  selectProducto.addEventListener("change", actualizarLotes);
  actualizarLotes();

  document.getElementById("form-movimiento").addEventListener("submit", e => {
    e.preventDefault();
    const datos = new FormData(e.target);
    const codigoProducto = datos.get("producto");
    const loteId = Number(datos.get("lote"));
    const tipo = datos.get("tipo");
    const cantidad = Number(datos.get("cantidad"));
    const error = document.getElementById("error-movimiento");

    const producto = sistema.productos.find(p => p.codigo === codigoProducto);
    const lote = producto ? producto.lotes.find(l => l.id === loteId) : null;

    if (!lote) {
      error.textContent = "Selecciona un lote válido.";
      return;
    }

    try {
      const movimiento = crearMovimiento({
        id: sistema.contadores.movimiento++,
        codigoProducto,
        nombreProducto: producto.nombre,
        loteId,
        tipo,
        cantidad,
        usuario: sesionActual.nombre
      });

      sistema.registrarMovimiento(movimiento, lote);
      renderVista();
    } catch (err) {
      error.textContent = err.message;
    }
  });
}

function renderVencimientos(seccion) {
  sistema.recalcularEstados(false);
  const lotesRiesgo = [];
  sistema.productos.forEach(p => p.lotes.forEach(l => {
    if (l.estado !== "VIGENTE") lotesRiesgo.push({ lote: l, producto: p });
  }));

  seccion.innerHTML = `
    <div class="panel">
      <div class="fila-herramientas">
        <label style="color:var(--texto-muted);font-size:13px">Umbral "próximo a vencer" (días)</label>
        <input type="number" id="input-umbral" min="1" value="${sistema.config.umbralDias}" style="width:90px" ${sesionActual.puedeEvaluarVencimientos() ? "" : "disabled"}>
        ${sesionActual.puedeEvaluarVencimientos() ? `<button class="boton boton-primario" id="boton-evaluar">Evaluar vencimientos ahora</button>` : ""}
      </div>
      <div class="nota-regla">El umbral es configurable (ej. 30, 15 o 7 días). Un lote vencido siempre queda marcado como VENCIDO, sin importar el umbral.</div>
      ${lotesRiesgo.length === 0 ? `<p class="mensaje-vacio">No hay lotes próximos a vencer ni vencidos.</p>` : `
      <table>
        <thead><tr><th>Producto</th><th>Lote</th><th>Cantidad</th><th>Vence</th><th>Estado</th></tr></thead>
        <tbody>
          ${lotesRiesgo.map(item => `
            <tr><td>${item.producto.nombre}</td><td>#${item.lote.id}</td><td>${item.lote.cantidad}</td><td>${formatoFecha(item.lote.fechaVencimiento)}</td><td>${insigniaEstado(item.lote.estado)}</td></tr>
          `).join("")}
        </tbody>
      </table>`}
    </div>
  `;

  const botonEvaluar = document.getElementById("boton-evaluar");
  if (botonEvaluar) {
    botonEvaluar.addEventListener("click", () => {
      sistema.config.umbralDias = Number(document.getElementById("input-umbral").value) || sistema.config.umbralDias;
      sistema.recalcularEstados(true);
      sistema.guardar();
      renderVista();
    });
  }
}

function renderReportes(seccion) {
  sistema.recalcularEstados(false);
  const valorTotal = sistema.productos.reduce((s, p) => s + p.valorizacion, 0);

  seccion.innerHTML = `
    <div class="panel">
      <p class="panel-titulo">Valorización del inventario</p>
      <table>
        <thead><tr><th>Producto</th><th>Stock</th><th>Precio unitario</th><th>Valorización</th></tr></thead>
        <tbody>
          ${sistema.productos.map(p => `
            <tr><td>${p.nombre}</td><td>${p.stockTotal}</td><td>${formatoMoneda(p.precio)}</td><td>${formatoMoneda(p.valorizacion)}</td></tr>
          `).join("")}
        </tbody>
        <tfoot><tr><td colspan="3" style="text-align:right;color:var(--texto-muted)">Total</td><td style="font-weight:700">${formatoMoneda(valorTotal)}</td></tr></tfoot>
      </table>
    </div>

    <div class="panel">
      <p class="panel-titulo">Historial de movimientos por producto</p>
      <select id="filtro-reporte-producto" style="margin-bottom:14px;background:var(--panel-alt);border:1px solid var(--borde);color:var(--texto);border-radius:7px;padding:8px 10px">
        <option value="TODOS">Todos los productos</option>
        ${sistema.productos.map(p => `<option value="${p.codigo}">${p.nombre}</option>`).join("")}
      </select>
      <div id="tabla-historial"></div>
    </div>
  `;

  const pintarHistorial = codigo => {
    const filtrados = codigo === "TODOS" ? sistema.movimientos : sistema.movimientos.filter(m => m.codigoProducto === codigo);
    document.getElementById("tabla-historial").innerHTML = filtrados.length === 0
      ? `<p class="mensaje-vacio">Sin movimientos para este filtro.</p>`
      : `<table><thead><tr><th>Fecha</th><th>Producto</th><th>Tipo</th><th>Cantidad</th></tr></thead><tbody>
          ${filtrados.slice().reverse().map(m => `<tr><td>${formatoFecha(m.fecha)}</td><td>${m.nombreProducto}</td><td>${m.tipo}</td><td>${m.cantidad}</td></tr>`).join("")}
        </tbody></table>`;
  };
  pintarHistorial("TODOS");
  document.getElementById("filtro-reporte-producto").addEventListener("change", e => pintarHistorial(e.target.value));
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
          ${sistema.usuarios.map(u => `
            <tr>
              <td>${u.nombre}</td><td>${u.correo}</td><td>${u.etiquetaRol}</td>
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
  seccion.querySelectorAll("[data-id]").forEach(boton => {
    boton.addEventListener("click", () => {
      const id = Number(boton.dataset.id);
      sistema.eliminarUsuario(id);
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
  document.getElementById("form-usuario").addEventListener("submit", e => {
    e.preventDefault();
    const datos = new FormData(e.target);
    const correo = datos.get("correo").trim();
    const error = document.getElementById("error-usuario");

    if (sistema.usuarios.some(u => u.correo === correo)) {
      error.textContent = "Ya existe un usuario con ese correo.";
      return;
    }

    const nuevo = crearUsuario({
      id: sistema.contadores.usuario++,
      nombre: datos.get("nombre").trim(),
      correo,
      clave: datos.get("clave"),
      rol: datos.get("rol")
    });

    sistema.agregarUsuario(nuevo);
    cerrarModal();
    renderVista();
  });
}

document.getElementById("form-login").addEventListener("submit", e => {
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