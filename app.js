const CLAVE_DB = "inventario_db_v2";
const CLAVE_SESION = "inventario_sesion_v2";

const RolUsuario = Object.freeze({
  ADMINISTRADOR: "ADMINISTRADOR",
  BODEGUERO: "BODEGUERO",
  VENDEDOR: "VENDEDOR"
});

const EstadoLote = Object.freeze({
  VIGENTE: "VIGENTE",
  PROXIMO_A_VENCER: "PROXIMO_A_VENCER",
  VENCIDO: "VENCIDO"
});

class StockInsuficienteError extends Error {}
class PermisoDenegadoError extends Error {}

function hoyISO() {
  return new Date().toISOString().slice(0, 10);
}

function sumarDias(iso, dias) {
  const fecha = new Date(iso);
  fecha.setDate(fecha.getDate() + dias);
  return fecha.toISOString().slice(0, 10);
}

function formatoMoneda(valor) {
  return "$" + Math.round(valor).toLocaleString("es-CO");
}

function formatoFecha(iso) {
  if (!iso) return "—";
  const [a, m, d] = iso.split("-");
  return `${d}/${m}/${a}`;
}

function etiquetaEstado(estado) {
  if (estado === EstadoLote.VIGENTE) return "vigente";
  if (estado === EstadoLote.PROXIMO_A_VENCER) return "próximo a vencer";
  return "vencido";
}

function insigniaEstado(estado) {
  const clase = estado === EstadoLote.VIGENTE ? "insignia-vigente"
    : estado === EstadoLote.PROXIMO_A_VENCER ? "insignia-proximo" : "insignia-vencido";
  return `<span class="insignia ${clase}">${etiquetaEstado(estado)}</span>`;
}

function etiquetaRol(rol) {
  if (rol === RolUsuario.ADMINISTRADOR) return "Administrador";
  if (rol === RolUsuario.BODEGUERO) return "Bodeguero";
  return "Vendedor";
}

class Usuario {
  #id;
  #nombre;
  #correo;
  #clave;
  #rol;

  constructor(id, nombre, correo, clave, rol) {
    this.#id = id;
    this.#nombre = nombre;
    this.#correo = correo;
    this.#clave = clave;
    this.#rol = rol;
  }

  get id() { return this.#id; }
  get nombre() { return this.#nombre; }
  set nombre(valor) { this.#nombre = valor; }
  get correo() { return this.#correo; }
  set correo(valor) { this.#correo = valor; }
  get clave() { return this.#clave; }
  set clave(valor) { this.#clave = valor; }
  get rol() { return this.#rol; }
  set rol(valor) { this.#rol = valor; }

  esAdministrador() {
    return this.#rol === RolUsuario.ADMINISTRADOR;
  }

  toJSON() {
    return { id: this.#id, nombre: this.#nombre, correo: this.#correo, clave: this.#clave, rol: this.#rol };
  }

  static desde(plano) {
    return new Usuario(plano.id, plano.nombre, plano.correo, plano.clave, plano.rol);
  }
}

class Lote {
  #id;
  #cantidad;
  #fechaVencimiento;
  #estado;

  constructor(id, cantidad, fechaVencimiento) {
    this.#id = id;
    this.#cantidad = cantidad;
    this.#fechaVencimiento = fechaVencimiento || null;
    this.#estado = EstadoLote.VIGENTE;
  }

  get id() { return this.#id; }
  get cantidad() { return this.#cantidad; }
  set cantidad(valor) { this.#cantidad = valor; }
  get fechaVencimiento() { return this.#fechaVencimiento; }
  set fechaVencimiento(valor) { this.#fechaVencimiento = valor; }
  get estado() { return this.#estado; }

  actualizarEstado(umbralDias) {
    this.#estado = Lote.calcularEstado(this.#fechaVencimiento, umbralDias);
  }

  static calcularEstado(fechaVencimiento, umbralDias) {
    if (!fechaVencimiento) return EstadoLote.VIGENTE;
    const hoy = new Date(hoyISO());
    const vence = new Date(fechaVencimiento);
    const limite = new Date(hoy);
    limite.setDate(limite.getDate() + umbralDias);
    if (vence < hoy) return EstadoLote.VENCIDO;
    if (vence <= limite) return EstadoLote.PROXIMO_A_VENCER;
    return EstadoLote.VIGENTE;
  }

  toJSON() {
    return { id: this.#id, cantidad: this.#cantidad, fechaVencimiento: this.#fechaVencimiento, estado: this.#estado };
  }

  static desde(plano) {
    const lote = new Lote(plano.id, plano.cantidad, plano.fechaVencimiento);
    lote.#estado = plano.estado;
    return lote;
  }
}

class Producto {
  #codigo;
  #nombre;
  #descripcion;
  #precio;
  #esPerecedero;
  #lotes;

  constructor(codigo, nombre, descripcion, precio, esPerecedero) {
    this.#codigo = codigo;
    this.#nombre = nombre;
    this.#descripcion = descripcion;
    this.#precio = precio;
    this.#esPerecedero = esPerecedero;
    this.#lotes = [];
  }

  get codigo() { return this.#codigo; }
  get nombre() { return this.#nombre; }
  set nombre(valor) { this.#nombre = valor; }
  get descripcion() { return this.#descripcion; }
  set descripcion(valor) { this.#descripcion = valor; }
  get precio() { return this.#precio; }
  set precio(valor) { this.#precio = valor; }
  get esPerecedero() { return this.#esPerecedero; }
  set esPerecedero(valor) { this.#esPerecedero = valor; }
  get lotes() { return [...this.#lotes]; }

  agregarLote(lote) {
    this.#lotes.push(lote);
  }

  getStockTotal() {
    return this.#lotes.reduce((suma, lote) => suma + lote.cantidad, 0);
  }

  getValorizacion() {
    return this.getStockTotal() * this.#precio;
  }

  peorEstado() {
    if (this.#lotes.some((l) => l.estado === EstadoLote.VENCIDO)) return EstadoLote.VENCIDO;
    if (this.#lotes.some((l) => l.estado === EstadoLote.PROXIMO_A_VENCER)) return EstadoLote.PROXIMO_A_VENCER;
    return EstadoLote.VIGENTE;
  }

  toJSON() {
    return {
      codigo: this.#codigo,
      nombre: this.#nombre,
      descripcion: this.#descripcion,
      precio: this.#precio,
      esPerecedero: this.#esPerecedero,
      lotes: this.#lotes.map((l) => l.toJSON())
    };
  }

  static desde(plano) {
    const producto = new Producto(plano.codigo, plano.nombre, plano.descripcion, plano.precio, plano.esPerecedero);
    plano.lotes.forEach((l) => producto.#lotes.push(Lote.desde(l)));
    return producto;
  }
}

class EfectoMovimiento {
  aplicar(cantidadActual, cantidad) {
    throw new Error("Debe implementarse en la subclase");
  }
  getNombre() {
    throw new Error("Debe implementarse en la subclase");
  }
}

class EntradaMovimiento extends EfectoMovimiento {
  aplicar(cantidadActual, cantidad) {
    return cantidadActual + cantidad;
  }
  getNombre() {
    return "ENTRADA";
  }
}

class SalidaMovimiento extends EfectoMovimiento {
  aplicar(cantidadActual, cantidad) {
    if (cantidadActual - cantidad < 0) {
      throw new StockInsuficienteError(`Stock insuficiente: solo hay ${cantidadActual} unidades.`);
    }
    return cantidadActual - cantidad;
  }
  getNombre() {
    return "SALIDA";
  }
}

class DevolucionMovimiento extends EfectoMovimiento {
  aplicar(cantidadActual, cantidad) {
    return cantidadActual + cantidad;
  }
  getNombre() {
    return "DEVOLUCION";
  }
}

const EFECTOS_MOVIMIENTO = {
  ENTRADA: new EntradaMovimiento(),
  SALIDA: new SalidaMovimiento(),
  DEVOLUCION: new DevolucionMovimiento()
};

class Movimiento {
  #id;
  #producto;
  #lote;
  #efecto;
  #cantidad;
  #fecha;
  #usuarioResponsable;

  constructor(id, producto, lote, efecto, cantidad, usuarioResponsable) {
    this.#id = id;
    this.#producto = producto;
    this.#lote = lote;
    this.#efecto = efecto;
    this.#cantidad = cantidad;
    this.#usuarioResponsable = usuarioResponsable;
    this.#fecha = hoyISO();
  }

  get id() { return this.#id; }
  get producto() { return this.#producto; }
  get lote() { return this.#lote; }
  get efecto() { return this.#efecto; }
  get cantidad() { return this.#cantidad; }
  get fecha() { return this.#fecha; }
  get usuarioResponsable() { return this.#usuarioResponsable; }

  toJSON() {
    return {
      id: this.#id,
      codigoProducto: this.#producto.codigo,
      nombreProducto: this.#producto.nombre,
      loteId: this.#lote.id,
      tipo: this.#efecto.getNombre(),
      cantidad: this.#cantidad,
      fecha: this.#fecha,
      usuario: this.#usuarioResponsable.nombre
    };
  }
}

class Alerta {
  #id;
  #codigoProducto;
  #nombreProducto;
  #loteId;
  #estado;
  #mensaje;
  #fecha;
  #atendida;

  constructor(id, codigoProducto, nombreProducto, loteId, estado, mensaje) {
    this.#id = id;
    this.#codigoProducto = codigoProducto;
    this.#nombreProducto = nombreProducto;
    this.#loteId = loteId;
    this.#estado = estado;
    this.#mensaje = mensaje;
    this.#fecha = hoyISO();
    this.#atendida = false;
  }

  get id() { return this.#id; }
  get codigoProducto() { return this.#codigoProducto; }
  get nombreProducto() { return this.#nombreProducto; }
  get loteId() { return this.#loteId; }
  get estado() { return this.#estado; }
  get mensaje() { return this.#mensaje; }
  get fecha() { return this.#fecha; }
  get atendida() { return this.#atendida; }

  marcarComoAtendida() {
    this.#atendida = true;
  }

  toJSON() {
    return {
      id: this.#id,
      codigoProducto: this.#codigoProducto,
      nombreProducto: this.#nombreProducto,
      loteId: this.#loteId,
      estado: this.#estado,
      mensaje: this.#mensaje,
      fecha: this.#fecha,
      atendida: this.#atendida
    };
  }

  static desde(plano) {
    const alerta = new Alerta(plano.id, plano.codigoProducto, plano.nombreProducto, plano.loteId, plano.estado, plano.mensaje);
    alerta.#fecha = plano.fecha;
    alerta.#atendida = plano.atendida;
    return alerta;
  }
}

class Reporte {
  generar(productos, movimientos) {
    throw new Error("Debe implementarse en la subclase");
  }
  getNombre() {
    throw new Error("Debe implementarse en la subclase");
  }
}

class ReporteValorizacion extends Reporte {
  generar(productos) {
    return productos.reduce((suma, producto) => suma + producto.getValorizacion(), 0);
  }
  getNombre() {
    return "VALORIZACION";
  }
}

class ReporteVencimientos extends Reporte {
  generar(productos) {
    const enRiesgo = [];
    productos.forEach((producto) => {
      producto.lotes.forEach((lote) => {
        if (lote.estado !== EstadoLote.VIGENTE) enRiesgo.push({ producto, lote });
      });
    });
    return enRiesgo;
  }
  getNombre() {
    return "VENCIMIENTOS";
  }
}

class ReporteMovimientos extends Reporte {
  generar(productos, movimientos) {
    return movimientos;
  }
  getNombre() {
    return "MOVIMIENTOS";
  }
}

class InventarioService {
  #productos = [];
  #movimientos = [];
  #siguienteIdLote = 1;
  #siguienteIdMovimiento = 1;

  registrarProducto(producto) {
    this.#productos.push(producto);
  }

  eliminarProducto(producto, usuario) {
    if (!usuario.esAdministrador()) {
      throw new PermisoDenegadoError("Solo el administrador puede eliminar productos.");
    }
    this.#productos = this.#productos.filter((p) => p.codigo !== producto.codigo);
  }

  buscarProducto(codigo) {
    return this.#productos.find((p) => p.codigo === codigo) || null;
  }

  registrarLote(producto, cantidad, fechaVencimiento) {
    if (producto.esPerecedero && !fechaVencimiento) {
      throw new Error("Los productos perecederos requieren fecha de vencimiento.");
    }
    const lote = new Lote(this.#siguienteIdLote++, cantidad, producto.esPerecedero ? fechaVencimiento : null);
    producto.agregarLote(lote);
    return lote;
  }

  registrarMovimiento(producto, lote, efecto, cantidad, usuario) {
    lote.cantidad = efecto.aplicar(lote.cantidad, cantidad);
    const movimiento = new Movimiento(this.#siguienteIdMovimiento++, producto, lote, efecto, cantidad, usuario);
    this.#movimientos.push(movimiento.toJSON());
    return movimiento;
  }

  get productos() { return [...this.#productos]; }
  get movimientos() { return [...this.#movimientos]; }

  cargarProductos(productos, siguienteIdLote) {
    this.#productos = productos;
    this.#siguienteIdLote = siguienteIdLote;
  }

  cargarMovimientos(movimientos, siguienteIdMovimiento) {
    this.#movimientos = movimientos;
    this.#siguienteIdMovimiento = siguienteIdMovimiento;
  }

  get siguienteIdLote() { return this.#siguienteIdLote; }
  get siguienteIdMovimiento() { return this.#siguienteIdMovimiento; }
}

class VencimientoService {
  #umbralDias = 30;
  #alertas = [];
  #siguienteIdAlerta = 1;

  get umbralDias() { return this.#umbralDias; }
  set umbralDias(dias) { this.#umbralDias = dias; }

  evaluarVencimientos(productos) {
    productos.forEach((producto) => {
      producto.lotes.forEach((lote) => {
        const anterior = lote.estado;
        lote.actualizarEstado(this.#umbralDias);
        if (lote.estado !== anterior &&
            (lote.estado === EstadoLote.PROXIMO_A_VENCER || lote.estado === EstadoLote.VENCIDO)) {
          this.#alertas.unshift(new Alerta(
            this.#siguienteIdAlerta++,
            producto.codigo,
            producto.nombre,
            lote.id,
            lote.estado,
            `El lote #${lote.id} de "${producto.nombre}" pasó a estado ${etiquetaEstado(lote.estado)}`
          ));
        }
      });
    });
  }

  get alertas() { return this.#alertas.map((a) => a.toJSON()); }

  cargarAlertas(alertas, siguienteIdAlerta, umbralDias) {
    this.#alertas = alertas;
    this.#siguienteIdAlerta = siguienteIdAlerta;
    this.#umbralDias = umbralDias;
  }
}

class UsuarioService {
  #usuarios = [];
  #siguienteId = 1;

  registrarUsuario(nombre, correo, clave, rol) {
    const usuario = new Usuario(this.#siguienteId++, nombre, correo, clave, rol);
    this.#usuarios.push(usuario);
    return usuario;
  }

  autenticar(correo, clave) {
    return this.#usuarios.find((u) => u.correo === correo && u.clave === clave) || null;
  }

  eliminarUsuario(objetivo, solicitante) {
    if (!solicitante.esAdministrador()) {
      throw new PermisoDenegadoError("Solo el administrador puede eliminar usuarios.");
    }
    this.#usuarios = this.#usuarios.filter((u) => u.id !== objetivo.id);
  }

  existeCorreo(correo) {
    return this.#usuarios.some((u) => u.correo === correo);
  }

  get usuarios() { return [...this.#usuarios]; }

  cargarUsuarios(usuarios, siguienteId) {
    this.#usuarios = usuarios;
    this.#siguienteId = siguienteId;
  }
}

class ReporteService {
  generar(reporte, productos, movimientos) {
    return reporte.generar(productos, movimientos);
  }
}

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

const inventarioService = new InventarioService();
const vencimientoService = new VencimientoService();
const usuarioService = new UsuarioService();
const reporteService = new ReporteService();

let sesionActual = null;
let vistaActual = "dashboard";
let filtroProductoTexto = "";
let filtroProductoEstado = "TODOS";

function sembrarDatosIniciales() {
  usuarioService.registrarUsuario("Ana Ríos", "admin@demo.com", "admin123", RolUsuario.ADMINISTRADOR);
  usuarioService.registrarUsuario("Luis Bodega", "bodega@demo.com", "bodega123", RolUsuario.BODEGUERO);
  usuarioService.registrarUsuario("Sara Ventas", "ventas@demo.com", "ventas123", RolUsuario.VENDEDOR);

  const yogur = new Producto("P-001", "Yogur natural 1L", "Lácteo refrigerado", 8500, true);
  inventarioService.registrarProducto(yogur);
  inventarioService.registrarLote(yogur, 40, sumarDias(hoyISO(), 5));
  inventarioService.registrarLote(yogur, 15, sumarDias(hoyISO(), -2));

  const arroz = new Producto("P-002", "Arroz premium 1kg", "Grano seco, no perecedero", 4200, false);
  inventarioService.registrarProducto(arroz);
  inventarioService.registrarLote(arroz, 120, null);

  const queso = new Producto("P-003", "Queso campesino 500g", "Lácteo refrigerado", 11900, true);
  inventarioService.registrarProducto(queso);
  inventarioService.registrarLote(queso, 8, sumarDias(hoyISO(), 25));

  vencimientoService.evaluarVencimientos(inventarioService.productos);
}

function guardarEstado() {
  const estado = {
    usuarios: usuarioService.usuarios.map((u) => u.toJSON()),
    siguienteIdUsuario: usuarioService.usuarios.reduce((max, u) => Math.max(max, u.id + 1), 1),
    productos: inventarioService.productos.map((p) => p.toJSON()),
    siguienteIdLote: inventarioService.siguienteIdLote,
    movimientos: inventarioService.movimientos,
    siguienteIdMovimiento: inventarioService.siguienteIdMovimiento,
    alertas: vencimientoService.alertas,
    siguienteIdAlerta: vencimientoService.alertas.reduce((max, a) => Math.max(max, a.id + 1), 1),
    umbralDias: vencimientoService.umbralDias
  };
  localStorage.setItem(CLAVE_DB, JSON.stringify(estado));
}

function cargarEstado() {
  const guardado = localStorage.getItem(CLAVE_DB);
  if (!guardado) {
    sembrarDatosIniciales();
    guardarEstado();
    return;
  }
  const estado = JSON.parse(guardado);
  usuarioService.cargarUsuarios(estado.usuarios.map((u) => Usuario.desde(u)), estado.siguienteIdUsuario);
  inventarioService.cargarProductos(estado.productos.map((p) => Producto.desde(p)), estado.siguienteIdLote);
  inventarioService.cargarMovimientos(estado.movimientos, estado.siguienteIdMovimiento);
  vencimientoService.cargarAlertas(estado.alertas.map((a) => Alerta.desde(a)), estado.siguienteIdAlerta, estado.umbralDias);
}

function iniciarSesion(correo, clave) {
  const usuario = usuarioService.autenticar(correo, clave);
  if (!usuario) return null;
  sesionActual = usuario;
  sessionStorage.setItem(CLAVE_SESION, String(usuario.id));
  return usuario;
}

function restaurarSesion() {
  const idGuardado = sessionStorage.getItem(CLAVE_SESION);
  if (!idGuardado) return false;
  const usuario = usuarioService.usuarios.find((u) => u.id === Number(idGuardado));
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
  const productos = inventarioService.productos;
  const valorTotal = reporteService.generar(new ReporteValorizacion(), productos, inventarioService.movimientos);
  const bajoStock = productos.filter((p) => p.getStockTotal() <= 10).length;
  const enRiesgo = reporteService.generar(new ReporteVencimientos(), productos, inventarioService.movimientos);
  const proximos = enRiesgo.filter((r) => r.lote.estado === EstadoLote.PROXIMO_A_VENCER).length;
  const vencidos = enRiesgo.filter((r) => r.lote.estado === EstadoLote.VENCIDO).length;
  const alertas = vencimientoService.alertas;

  seccion.innerHTML = `
    <div class="tarjetas-kpi">
      <div class="kpi acento-teal"><p>Valor total del inventario</p><p class="kpi-valor">${formatoMoneda(valorTotal)}</p></div>
      <div class="kpi"><p>Productos con bajo stock (≤10)</p><p class="kpi-valor">${bajoStock}</p></div>
      <div class="kpi acento-amber"><p>Lotes próximos a vencer</p><p class="kpi-valor">${proximos}</p></div>
      <div class="kpi acento-rojo"><p>Lotes vencidos</p><p class="kpi-valor">${vencidos}</p></div>
    </div>
    <div class="panel">
      <p class="panel-titulo">Alertas recientes</p>
      ${alertas.length === 0
        ? `<p class="mensaje-vacio">Aún no se han generado alertas. Ve a "Vencimientos" y evalúa el inventario.</p>`
        : `<table><thead><tr><th>Fecha</th><th>Producto</th><th>Lote</th><th>Estado</th><th>Mensaje</th></tr></thead><tbody>
            ${alertas.slice(0, 8).map((a) => `
              <tr><td>${formatoFecha(a.fecha)}</td><td>${a.nombreProducto}</td><td>#${a.loteId}</td><td>${insigniaEstado(a.estado)}</td><td>${a.mensaje}</td></tr>
            `).join("")}
          </tbody></table>`}
    </div>
  `;
}

function productosFiltrados() {
  return inventarioService.productos.filter((p) => {
    const coincideTexto = !filtroProductoTexto ||
      p.nombre.toLowerCase().includes(filtroProductoTexto) ||
      p.codigo.toLowerCase().includes(filtroProductoTexto);
    const coincideEstado = filtroProductoEstado === "TODOS" ||
      p.lotes.some((l) => l.estado === filtroProductoEstado);
    return coincideTexto && coincideEstado;
  });
}

function renderProductos(seccion) {
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
          ${lista.map((p) => `
            <tr>
              <td>${p.codigo}</td>
              <td>${p.nombre}${p.esPerecedero ? ' <span class="insignia insignia-proximo">perecedero</span>' : ""}</td>
              <td>${formatoMoneda(p.precio)}</td>
              <td>${p.getStockTotal()}</td>
              <td>${insigniaEstado(p.peorEstado())}</td>
              ${permisos.productosEscribir ? `
              <td class="acciones-fila">
                <button data-accion="lote" data-codigo="${p.codigo}">+ Lote</button>
                <button data-accion="editar" data-codigo="${p.codigo}">Editar</button>
                ${permisos.productosEliminar ? `<button class="boton-peligro" data-accion="eliminar" data-codigo="${p.codigo}">Eliminar</button>` : ""}
              </td>` : ""}
            </tr>
          `).join("")}
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
      const producto = inventarioService.buscarProducto(boton.dataset.codigo);
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

    if (!esEdicion && inventarioService.buscarProducto(codigo)) {
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
      inventarioService.registrarProducto(new Producto(codigo, nombre, descripcion, precio, esPerecedero));
    }
    guardarEstado();
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
    try {
      inventarioService.registrarLote(producto, cantidad, fecha);
    } catch (err) {
      error.textContent = err.message;
      return;
    }
    vencimientoService.evaluarVencimientos(inventarioService.productos);
    guardarEstado();
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
    try {
      inventarioService.eliminarProducto(producto, sesionActual);
    } catch (err) {
      cerrarModal();
      alert(err.message);
      return;
    }
    guardarEstado();
    cerrarModal();
    renderVista();
  });
}

function opcionesLote(producto) {
  return producto.lotes.map((l) => `<option value="${l.id}">Lote #${l.id} — ${l.cantidad} u. — ${formatoFecha(l.fechaVencimiento)}</option>`).join("");
}

function renderMovimientos(seccion) {
  const productos = inventarioService.productos;
  const movimientos = inventarioService.movimientos;

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
      ${movimientos.length === 0 ? `<p class="mensaje-vacio">Todavía no hay movimientos registrados.</p>` : `
      <table>
        <thead><tr><th>Fecha</th><th>Producto</th><th>Lote</th><th>Tipo</th><th>Cantidad</th><th>Usuario</th></tr></thead>
        <tbody>
          ${movimientos.slice().reverse().map((m) => `
            <tr><td>${formatoFecha(m.fecha)}</td><td>${m.nombreProducto}</td><td>#${m.loteId}</td><td>${m.tipo}</td><td>${m.cantidad}</td><td>${m.usuario}</td></tr>
          `).join("")}
        </tbody>
      </table>`}
    </div>
  `;

  const selectProducto = document.getElementById("select-producto-mov");
  const selectLote = document.getElementById("select-lote-mov");
  const actualizarLotes = () => {
    const producto = inventarioService.buscarProducto(selectProducto.value);
    selectLote.innerHTML = producto ? opcionesLote(producto) : "";
  };
  selectProducto.addEventListener("change", actualizarLotes);
  actualizarLotes();

  document.getElementById("form-movimiento").addEventListener("submit", (e) => {
    e.preventDefault();
    const datos = new FormData(e.target);
    const producto = inventarioService.buscarProducto(datos.get("producto"));
    const loteId = Number(datos.get("lote"));
    const lote = producto.lotes.find((l) => l.id === loteId);
    const efecto = EFECTOS_MOVIMIENTO[datos.get("tipo")];
    const cantidad = Number(datos.get("cantidad"));
    const error = document.getElementById("error-movimiento");

    if (!lote) {
      error.textContent = "Selecciona un lote válido.";
      return;
    }

    try {
      inventarioService.registrarMovimiento(producto, lote, efecto, cantidad, sesionActual);
    } catch (err) {
      error.textContent = err.message;
      return;
    }

    guardarEstado();
    renderVista();
  });
}

function renderVencimientos(seccion) {
  const permisos = permisosActuales();
  const productos = inventarioService.productos;
  const enRiesgo = reporteService.generar(new ReporteVencimientos(), productos, inventarioService.movimientos);

  seccion.innerHTML = `
    <div class="panel">
      <div class="fila-herramientas">
        <label style="color:var(--texto-muted);font-size:13px">Umbral "próximo a vencer" (días)</label>
        <input type="number" id="input-umbral" min="1" value="${vencimientoService.umbralDias}" style="width:90px" ${permisos.vencimientosEvaluar ? "" : "disabled"}>
        ${permisos.vencimientosEvaluar ? `<button class="boton boton-primario" id="boton-evaluar">Evaluar vencimientos ahora</button>` : ""}
      </div>
      <div class="nota-regla">El umbral es configurable (ej. 30, 15 o 7 días). Un lote vencido siempre queda marcado como VENCIDO, sin importar el umbral.</div>
      ${enRiesgo.length === 0 ? `<p class="mensaje-vacio">No hay lotes próximos a vencer ni vencidos.</p>` : `
      <table>
        <thead><tr><th>Producto</th><th>Lote</th><th>Cantidad</th><th>Vence</th><th>Estado</th></tr></thead>
        <tbody>
          ${enRiesgo.map((r) => `
            <tr><td>${r.producto.nombre}</td><td>#${r.lote.id}</td><td>${r.lote.cantidad}</td><td>${formatoFecha(r.lote.fechaVencimiento)}</td><td>${insigniaEstado(r.lote.estado)}</td></tr>
          `).join("")}
        </tbody>
      </table>`}
    </div>
  `;

  const botonEvaluar = document.getElementById("boton-evaluar");
  if (botonEvaluar) {
    botonEvaluar.addEventListener("click", () => {
      vencimientoService.umbralDias = Number(document.getElementById("input-umbral").value) || vencimientoService.umbralDias;
      vencimientoService.evaluarVencimientos(inventarioService.productos);
      guardarEstado();
      renderVista();
    });
  }
}

function renderReportes(seccion) {
  const productos = inventarioService.productos;
  const movimientos = inventarioService.movimientos;
  const valorTotal = reporteService.generar(new ReporteValorizacion(), productos, movimientos);

  seccion.innerHTML = `
    <div class="panel">
      <p class="panel-titulo">Valorización del inventario</p>
      <table>
        <thead><tr><th>Producto</th><th>Stock</th><th>Precio unitario</th><th>Valorización</th></tr></thead>
        <tbody>
          ${productos.map((p) => `
            <tr><td>${p.nombre}</td><td>${p.getStockTotal()}</td><td>${formatoMoneda(p.precio)}</td><td>${formatoMoneda(p.getValorizacion())}</td></tr>
          `).join("")}
        </tbody>
        <tfoot><tr><td colspan="3" style="text-align:right;color:var(--texto-muted)">Total</td><td style="font-weight:700">${formatoMoneda(valorTotal)}</td></tr></tfoot>
      </table>
    </div>

    <div class="panel">
      <p class="panel-titulo">Historial de movimientos por producto</p>
      <select id="filtro-reporte-producto" style="margin-bottom:14px;background:var(--panel-alt);border:1px solid var(--borde);color:var(--texto);border-radius:7px;padding:8px 10px">
        <option value="TODOS">Todos los productos</option>
        ${productos.map((p) => `<option value="${p.codigo}">${p.nombre}</option>`).join("")}
      </select>
      <div id="tabla-historial"></div>
    </div>
  `;

  const pintarHistorial = (codigo) => {
    const todos = reporteService.generar(new ReporteMovimientos(), productos, movimientos);
    const filtrados = codigo === "TODOS" ? todos : todos.filter((m) => m.codigoProducto === codigo);
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
  const usuarios = usuarioService.usuarios;
  seccion.innerHTML = `
    <div class="panel">
      <div class="fila-herramientas">
        <button class="boton boton-primario" id="boton-nuevo-usuario">Registrar usuario</button>
      </div>
      <table>
        <thead><tr><th>Nombre</th><th>Correo</th><th>Rol</th><th></th></tr></thead>
        <tbody>
          ${usuarios.map((u) => `
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
      const objetivo = usuarioService.usuarios.find((u) => u.id === Number(boton.dataset.id));
      try {
        usuarioService.eliminarUsuario(objetivo, sesionActual);
      } catch (err) {
        alert(err.message);
        return;
      }
      guardarEstado();
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
    if (usuarioService.existeCorreo(correo)) {
      error.textContent = "Ya existe un usuario con ese correo.";
      return;
    }
    usuarioService.registrarUsuario(datos.get("nombre").trim(), correo, datos.get("clave"), datos.get("rol"));
    guardarEstado();
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

cargarEstado();
if (restaurarSesion()) {
  mostrarApp();
}
