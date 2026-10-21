/**
 * REDKYBER · aplicación construida con la librería intUIción
 *
 * Los datos vienen de mi ERP de Sistemas de gestión empresarial (REDKYBER),
 * importados a JSON con herramientas/importar_redkyber.py.
 */
(() => {
  "use strict";

  const {
    DOM, Utilidades, Formato, Almacen, OrigenDatos, PreferenciasIU, ToastIU, ModalIU,
    DrawerIU, FormularioIU, TablaIU, AtajosIU, PaletaComandosIU, GestorColumnasIU
  } = window.intuicion.iu;

  const ENTIDADES = ["pedidos", "clientes", "productos", "componentes", "proveedores", "empleados"];

  class AplicacionRedkyber {
    constructor() {
      this.almacen = new Almacen("intuicion");
      this.preferencias = new PreferenciasIU(this.almacen);
      this.toast = new ToastIU();
      this.modal = new ModalIU();
      this.drawer = new DrawerIU(this.almacen);
      this.atajos = new AtajosIU();
      this.columnas = new GestorColumnasIU(this.almacen);
      this.paleta = new PaletaComandosIU((consulta) => this.comandos(consulta));

      this.escenario = DOM.uno("#escenario");
      this.estado = {
        modulos: [],
        entidades: {},
        modulo: null,
        vista: null,
        filtros: {},
        ordenes: this.almacen.leer("ordenes", {}),
        ultimaPorModulo: this.almacen.leer("ultimaPorModulo", {})
      };
    }

    /* ---------------- Arranque ---------------- */
    async iniciar() {
      try {
        const [modulos, ...entidades] = await Promise.all([
          OrigenDatos.cargarJSON("data/modulos.json"),
          ...ENTIDADES.map((e) => OrigenDatos.cargarJSON(`data/${e}.json`))
        ]);

        this.estado.modulos = modulos;
        entidades.forEach((definicion) => {
          // Si el usuario ya modificó los datos, se usan los guardados en el navegador
          const guardados = this.almacen.leer(`datos:${definicion.entidad}`);
          if (guardados) definicion.registros = guardados;
          this.estado.entidades[definicion.entidad] = definicion;
        });
      } catch (error) {
        this.escenario.innerHTML = `
          <div class="iu-vacio">
            <div class="iu-vacio-icono">!</div>
            <strong>No se pudieron cargar los datos</strong>
            <span>Abre la carpeta con un servidor: <code class="iu-mono">python3 -m http.server 8000</code></span>
            <code class="iu-mono">${Utilidades.escapar(error.message)}</code>
          </div>`;
        return;
      }

      this.pintarUsuario();
      this.columnas.activar();
      this.registrarAtajos();
      this.activarEventos();

      const ultima = this.almacen.leer("ultimaVista", { modulo: "panel", vista: "resumen" });
      const existe = this.buscarVista(ultima.modulo, ultima.vista);
      this.irVista(existe ? ultima.modulo : "panel", existe ? ultima.vista : "resumen");

      if (!this.almacen.leer("bienvenida")) {
        this.almacen.guardar("bienvenida", true);
        this.toast.info("Bienvenido a intUIción", "Pulsa Ctrl + K para buscar cualquier cosa, o ? para ver los atajos.", { duracion: 9000 });
      }
    }

    pintarUsuario() {
      const usuario = this.almacen.leer("usuario", { nombre: "Gustavo Delnardo", email: "gustavo@redkyber.aero" });
      DOM.uno("#usuarioNombre").textContent = usuario.nombre;
      DOM.uno("#avatar").textContent = Utilidades.iniciales(usuario.nombre);
      DOM.uno("#avatar").title = usuario.email;
    }

    /* ---------------- Navegación ---------------- */
    get moduloActual() {
      return this.estado.modulos.find((m) => m.id === this.estado.modulo);
    }

    get vistaActual() {
      return this.buscarVista(this.estado.modulo, this.estado.vista);
    }

    buscarVista(moduloId, vistaId) {
      return this.estado.modulos.find((m) => m.id === moduloId)?.vistas.find((v) => v.id === vistaId);
    }

    irModulo(moduloId) {
      const modulo = this.estado.modulos.find((m) => m.id === moduloId);
      // Al volver a un módulo se abre la vista en la que estabas, no siempre la primera
      const recordada = this.estado.ultimaPorModulo[moduloId];
      const vista = modulo.vistas.find((v) => v.id === recordada) || modulo.vistas[0];
      this.irVista(moduloId, vista.id);
    }

    irVista(moduloId, vistaId, { filtro } = {}) {
      this.estado.modulo = moduloId;
      this.estado.vista = vistaId;
      if (filtro !== undefined) this.estado.filtros[vistaId] = filtro;

      this.estado.ultimaPorModulo[moduloId] = vistaId;
      this.almacen.guardar("ultimaPorModulo", this.estado.ultimaPorModulo);
      this.almacen.guardar("ultimaVista", { modulo: moduloId, vista: vistaId });

      this.pintarModulos();
      this.pintarVistas();
      this.pintarEscenario();
    }

    /** Busca en qué módulo está una vista: irA("componentes") */
    irA(vistaId, opciones) {
      const modulo = this.estado.modulos.find((m) => m.vistas.some((v) => v.id === vistaId));
      this.irVista(modulo.id, vistaId, opciones);
    }

    crearItem({ texto, icono, activo, contador, pista }) {
      const nodo = DOM.uno("#tpl-item").content.firstElementChild.cloneNode(true);
      DOM.uno(".iu-ficha", nodo).textContent = icono || texto.charAt(0).toUpperCase();
      DOM.uno(".iu-etiqueta", nodo).textContent = texto;
      nodo.dataset.etiqueta = texto;
      nodo.setAttribute("aria-label", contador !== undefined ? `${texto}, ${contador} registros` : texto);
      nodo.classList.toggle("activo", Boolean(activo));
      if (activo) nodo.setAttribute("aria-current", "page");
      if (contador !== undefined) nodo.appendChild(DOM.crear("span", { class: "iu-contador", "aria-label": `${contador} registros` }, String(contador)));
      if (pista) nodo.insertAdjacentHTML("beforeend", `<span class="iu-kbd">${pista}</span>`);
      return nodo;
    }

    pintarModulos() {
      const contenedor = DOM.uno("#navegacion .iu-columna-contenido");
      contenedor.replaceChildren(
        ...this.estado.modulos.map((modulo, indice) => {
          const item = this.crearItem({
            texto: modulo.texto,
            icono: modulo.icono,
            activo: modulo.id === this.estado.modulo,
            pista: `Alt ${indice + 1}`
          });
          item.addEventListener("click", () => this.irModulo(modulo.id));
          return item;
        })
      );
    }

    pintarVistas() {
      const modulo = this.moduloActual;
      DOM.uno("#tituloVistas").textContent = modulo.texto;

      const contenedor = DOM.uno("#vistas .iu-columna-contenido");
      contenedor.replaceChildren(
        ...modulo.vistas.map((vista) => {
          const definicion = this.estado.entidades[vista.id];
          const item = this.crearItem({
            texto: vista.texto,
            icono: vista.icono || definicion?.icono,
            activo: vista.id === this.estado.vista,
            contador: definicion?.registros.length
          });
          item.draggable = true;
          item.addEventListener("click", () => this.irVista(modulo.id, vista.id));
          item.addEventListener("dragstart", (evento) => evento.dataTransfer.setData("text/plain", `${modulo.id}/${vista.id}`));
          return item;
        })
      );
    }

    pintarEscenario() {
      const vista = this.vistaActual;
      this.escenario.replaceChildren();
      this.escenario.scrollTop = 0;

      const migas = DOM.crear("div", { class: "iu-migas" });
      migas.innerHTML = `<button type="button" data-ir="panel">REDKYBER</button><span>›</span><button type="button" data-modulo>${Utilidades.escapar(this.moduloActual.texto)}</button><span>›</span><span>${Utilidades.escapar(vista.texto)}</span>`;
      DOM.uno("[data-ir]", migas).addEventListener("click", () => this.irVista("panel", "resumen"));
      DOM.uno("[data-modulo]", migas).addEventListener("click", () => this.irVista(this.estado.modulo, this.moduloActual.vistas[0].id));
      this.escenario.appendChild(migas);

      const pintores = {
        entidad: () => this.vistaEntidad(vista.id),
        resumen: () => this.vistaResumen(),
        catalogo: () => this.vistaCatalogo(),
        apariencia: () => this.vistaApariencia(),
        atajos: () => this.vistaAtajos()
      };
      pintores[vista.tipo]();
      document.title = `${vista.texto} · intUIción`;
    }

    cabeceraVista(titulo, descripcion, ...herramientas) {
      const cabecera = DOM.crear("div", { class: "iu-vista-cabecera" });
      cabecera.innerHTML = `<div><h1>${Utilidades.escapar(titulo)}</h1><p>${Utilidades.escapar(descripcion)}</p></div>`;
      const barra = DOM.crear("div", { class: "iu-barra" });
      barra.append(...herramientas);
      cabecera.appendChild(barra);
      return cabecera;
    }

    /* ---------------- Vista de una entidad (tabla + CRUD) ---------------- */
    referencias() {
      return Object.fromEntries(Object.entries(this.estado.entidades).map(([id, d]) => [id, d.registros]));
    }

    crearTabla(entidadId) {
      return new TablaIU({
        definicion: this.estado.entidades[entidadId],
        registros: this.estado.entidades[entidadId].registros,
        referencias: this.referencias(),
        filtro: this.estado.filtros[entidadId] || "",
        orden: this.estado.ordenes[entidadId],
        alEditar: (registro) => this.abrirFormulario(entidadId, registro),
        alBorrar: (registro) => this.borrar(entidadId, registro),
        alOrdenar: (orden) => {
          this.estado.ordenes[entidadId] = orden;
          this.almacen.guardar("ordenes", this.estado.ordenes);
          this.pintarTabla(entidadId);
        },
        alLimpiar: () => {
          this.estado.filtros[entidadId] = "";
          DOM.uno("#filtro").value = "";
          this.pintarTabla(entidadId);
          DOM.uno("#filtro").focus();
        }
      });
    }

    vistaEntidad(entidadId) {
      const definicion = this.estado.entidades[entidadId];

      const busqueda = DOM.crear("label", { class: "iu-campo-busqueda" });
      busqueda.innerHTML = `
        <span class="iu-oculto-accesible">Filtrar ${Utilidades.escapar(definicion.titulo)}</span>
        <input id="filtro" type="search" placeholder="Filtrar ${Utilidades.escapar(definicion.titulo.toLowerCase())}…" autocomplete="off">
        <kbd>/</kbd>`;
      const entrada = DOM.uno("input", busqueda);
      entrada.value = this.estado.filtros[entidadId] || "";
      entrada.addEventListener("input", () => {
        this.estado.filtros[entidadId] = entrada.value;
        this.pintarTabla(entidadId);
      });
      entrada.addEventListener("keydown", (evento) => {
        if (evento.key === "Escape" && entrada.value) {
          evento.stopPropagation();
          entrada.value = "";
          entrada.dispatchEvent(new Event("input"));
        }
        if (evento.key === "ArrowDown") DOM.uno("#tablaEntidad tbody tr")?.focus();
      });

      const exportar = DOM.crear("button", { class: "iu-btn secundario", type: "button", title: "Exporta las filas visibles, con el filtro y el orden actuales", onclick: () => this.exportarCSV(entidadId) }, "Exportar CSV");
      const nuevo = DOM.crear("button", { class: "iu-btn", type: "button", onclick: () => this.abrirFormulario(entidadId, null) });
      nuevo.innerHTML = `+ Nuevo <kbd class="iu-kbd">N</kbd>`;

      this.escenario.append(
        this.cabeceraVista(definicion.titulo, definicion.descripcion, busqueda, exportar, nuevo),
        DOM.crear("div", { id: "tablaEntidad" })
      );
      this.pintarTabla(entidadId);
    }

    pintarTabla(entidadId, idResaltado = null) {
      const contenedor = DOM.uno("#tablaEntidad");
      if (!contenedor) return;
      contenedor.replaceChildren(this.crearTabla(entidadId).render());

      if (idResaltado !== null) {
        const fila = DOM.uno(`tr[data-id="${idResaltado}"]`, contenedor);
        fila?.classList.add("recien");
        fila?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      }
    }

    guardarDatos(entidadId) {
      this.almacen.guardar(`datos:${entidadId}`, this.estado.entidades[entidadId].registros);
      this.pintarVistas(); // los contadores de la columna se actualizan
    }

    nombreRegistro(entidadId, registro) {
      if (entidadId === "pedidos") {
        const cliente = this.estado.entidades.clientes.registros.find((c) => c.identificador === registro.cliente_id);
        return `Pedido nº ${registro.identificador}${cliente ? ` · ${cliente.nombre}` : ""}`;
      }
      if (entidadId === "empleados") return `${registro.nombre} ${registro.apellidos}`;
      return registro.nombre || `#${registro.identificador}`;
    }

    abrirFormulario(entidadId, registro) {
      const definicion = this.estado.entidades[entidadId];
      const crear = registro === null;
      const formulario = new FormularioIU(definicion.campos, registro, this.referencias());

      const guardar = () => {
        if (!formulario.validar()) {
          this.toast.aviso("Revisa los campos marcados", "El primer campo con error ya tiene el foco.");
          return;
        }

        const datos = formulario.leer();
        const registros = definicion.registros;
        let id;

        if (crear) {
          id = Math.max(0, ...registros.map((r) => r.identificador)) + 1;
          registros.push({ ...datos, identificador: id });
        } else {
          id = registro.identificador;
          Object.assign(registro, datos);
        }

        this.guardarDatos(entidadId);
        formulario.sucio = false;
        this.drawer.cerrar();

        if (this.estado.vista !== entidadId) this.irA(entidadId);
        this.pintarTabla(entidadId, id);
        this.toast.ok(crear ? "Registro creado" : "Cambios guardados", this.nombreRegistro(entidadId, crear ? registros.at(-1) : registro));
      };

      formulario.elemento.addEventListener("submit", (evento) => {
        evento.preventDefault();
        guardar();
      });
      formulario.elemento.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter" && (evento.ctrlKey || evento.metaKey)) {
          evento.preventDefault();
          guardar();
        }
      });

      const pie = [];
      if (!crear) {
        pie.push(DOM.crear("button", {
          class: "iu-btn peligro",
          type: "button",
          onclick: () => {
            formulario.sucio = false;
            this.drawer.cerrar();
            this.borrar(entidadId, registro);
          }
        }, "Eliminar"));
      }
      pie.push(
        DOM.crear("span", { class: "iu-espaciador" }),
        DOM.crear("button", { class: "iu-btn secundario", type: "button", onclick: () => this.drawer.solicitarCierre() }, "Cancelar")
      );
      const botonGuardar = DOM.crear("button", { class: "iu-btn", type: "button", onclick: guardar });
      botonGuardar.innerHTML = `${crear ? "Crear" : "Guardar"} <kbd class="iu-kbd">Ctrl</kbd><kbd class="iu-kbd">↵</kbd>`;
      pie.push(botonGuardar);

      this.drawer.abrir({
        modo: crear ? `NUEVO · ${definicion.titulo.toUpperCase()}` : `EDITAR · ${definicion.titulo.toUpperCase()}`,
        titulo: crear ? `Nuevo registro` : this.nombreRegistro(entidadId, registro),
        contenido: formulario.elemento,
        pie,
        // Nunca se pierden cambios sin preguntar
        antesDeCerrar: async () =>
          !formulario.sucio ||
          this.modal.confirmar("¿Descartar los cambios?", "Has modificado el formulario y no lo has guardado.", {
            aceptar: "Descartar",
            cancelar: "Seguir editando",
            peligro: true
          })
      });
    }

    /** Registros de otras entidades que apuntan a este (claves ajenas) */
    dependientes(entidadId, registro) {
      const resultado = [];
      Object.values(this.estado.entidades).forEach((definicion) => {
        definicion.campos
          .filter((c) => c.tipo === "referencia" && c.entidad === entidadId)
          .forEach((campo) => {
            const cuantos = definicion.registros.filter((r) => r[campo.nombre] === registro.identificador).length;
            if (cuantos) resultado.push(`${cuantos} ${definicion.titulo.toLowerCase()}`);
          });
      });
      return resultado;
    }

    async borrar(entidadId, registro) {
      const nombre = this.nombreRegistro(entidadId, registro);
      const dependientes = this.dependientes(entidadId, registro);

      // Solo se pregunta cuando de verdad hay algo que perder; si no, se borra y se ofrece deshacer
      if (dependientes.length) {
        const seguro = await this.modal.confirmar(
          `¿Eliminar ${nombre}?`,
          `Tiene ${dependientes.join(" y ")} asociados, que se quedarían sin referencia.`,
          { aceptar: "Eliminar igualmente", peligro: true }
        );
        if (!seguro) return;
      }

      const registros = this.estado.entidades[entidadId].registros;
      const posicion = registros.indexOf(registro);
      registros.splice(posicion, 1);
      this.guardarDatos(entidadId);
      this.pintarTabla(entidadId);

      this.toast.mostrar({
        tipo: "peligro",
        titulo: "Registro eliminado",
        texto: nombre,
        duracion: 7000,
        accion: {
          texto: "Deshacer",
          alPulsar: () => {
            registros.splice(posicion, 0, registro);
            this.guardarDatos(entidadId);
            this.pintarTabla(entidadId, registro.identificador);
            this.toast.ok("Recuperado", nombre);
          }
        }
      });
    }

    exportarCSV(entidadId) {
      const tabla = this.crearTabla(entidadId);
      const columnas = tabla.definicion.columnas;
      const filas = tabla.filas();
      const celda = (texto) => `"${String(texto).replaceAll('"', '""')}"`;

      const csv = [
        columnas.map((c) => celda(c.etiqueta)).join(";"),
        ...filas.map((r) => columnas.map((c) => celda(tabla.textoCelda(c, r))).join(";"))
      ].join("\r\n");

      const enlace = DOM.crear("a", {
        href: URL.createObjectURL(new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" })),
        download: `${entidadId}.csv`
      });
      enlace.click();
      URL.revokeObjectURL(enlace.href);
      this.toast.ok("CSV exportado", `${filas.length} filas de ${tabla.definicion.titulo.toLowerCase()}`);
    }

    /* ---------------- Resumen (panel) ---------------- */
    vistaResumen() {
      const { pedidos, clientes, componentes, empleados, productos } = this.estado.entidades;
      const facturacion = pedidos.registros.reduce((s, p) => s + Number(p.total || 0), 0);
      const pendientes = pedidos.registros.filter((p) => p.estado === "Pendiente").length;
      const stockBajo = componentes.registros.filter((c) => Number(c.stock) < 50).length;
      const masaSalarial = empleados.registros.reduce((s, e) => s + Number(e.salario || 0), 0);

      this.escenario.appendChild(this.cabeceraVista(
        "Resumen",
        "Lo importante de un vistazo. Cada tarjeta te lleva a su detalle."
      ));

      const kpis = DOM.crear("div", { class: "iu-rejilla kpis" });
      [
        { titulo: "Facturación total", valor: Formato.moneda(facturacion, true), nota: `${pedidos.registros.length} pedidos`, ir: () => this.irA("pedidos", { filtro: "" }) },
        { titulo: "Pedidos pendientes", valor: pendientes, nota: "Esperan confirmación", ir: () => this.irA("pedidos", { filtro: "Pendiente" }) },
        { titulo: "Componentes con stock bajo", valor: stockBajo, nota: "Menos de 50 unidades", ir: () => { this.estado.ordenes.componentes = { campo: "stock", sentido: 1 }; this.irA("componentes", { filtro: "" }); } },
        { titulo: "Plantilla", valor: empleados.registros.length, nota: `${Formato.moneda(masaSalarial, true)} al año`, ir: () => this.irA("empleados") }
      ].forEach((kpi) => {
        const boton = DOM.crear("button", { class: "iu-kpi", type: "button", onclick: kpi.ir });
        boton.innerHTML = `<span>${kpi.titulo}</span><strong>${kpi.valor}</strong><small>${kpi.nota} →</small>`;
        kpis.appendChild(boton);
      });

      // Pedidos por estado
      const porEstado = {};
      pedidos.registros.forEach((p) => (porEstado[p.estado] = (porEstado[p.estado] || 0) + 1));

      // Facturación por aerolínea (top 5)
      const porCliente = {};
      pedidos.registros.forEach((p) => (porCliente[p.cliente_id] = (porCliente[p.cliente_id] || 0) + Number(p.total || 0)));
      const top = Object.entries(porCliente)
        .map(([id, total]) => ({ nombre: clientes.registros.find((c) => c.identificador === Number(id))?.nombre || `#${id}`, total }))
        .sort((a, b) => b.total - a.total)
        .slice(0, 5);

      const graficas = DOM.crear("div", { class: "iu-rejilla" });
      graficas.style.marginTop = "var(--esp)";
      graficas.append(
        this.tarjetaBarras("Pedidos por estado", "Pulsa una barra para filtrar los pedidos.",
          Object.entries(porEstado).map(([estado, n]) => ({ etiqueta: estado, valor: n, texto: n, ir: () => this.irA("pedidos", { filtro: estado }) }))),
        this.tarjetaBarras("Facturación por aerolínea", "Las cinco que más han comprado.",
          top.map((c) => ({ etiqueta: c.nombre, valor: c.total, texto: Formato.moneda(c.total, true), ir: () => this.irA("pedidos", { filtro: c.nombre }) }))),
        this.tarjetaPrimerosPasos(productos.registros.length)
      );

      this.escenario.append(kpis, graficas);
    }

    tarjetaBarras(titulo, descripcion, datos) {
      const maximo = Math.max(...datos.map((d) => d.valor), 1);
      const tarjeta = DOM.crear("article", { class: "iu-tarjeta" });
      tarjeta.innerHTML = `<h3>${titulo}</h3><p class="iu-tenue">${descripcion}</p>`;
      const barras = DOM.crear("div", { class: "iu-barras" });

      datos.forEach((dato) => {
        const fila = DOM.crear("button", { class: "iu-barra-fila", type: "button", title: `Ver ${dato.etiqueta}`, onclick: dato.ir });
        fila.innerHTML = `
          <span>${Utilidades.escapar(dato.etiqueta)}</span>
          <span class="iu-barra-pista"><span class="iu-barra-relleno" style="--valor:${(dato.valor / maximo) * 100}%"></span></span>
          <span class="iu-mono">${dato.texto}</span>`;
        barras.appendChild(fila);
      });

      tarjeta.appendChild(barras);
      return tarjeta;
    }

    tarjetaPrimerosPasos(aeronaves) {
      const tarjeta = DOM.crear("article", { class: "iu-tarjeta" });
      tarjeta.innerHTML = `
        <h3>Atajos para ir más rápido</h3>
        <p class="iu-tenue">${aeronaves} modelos de aeronave en catálogo. No hace falta ratón:</p>
        <dl class="iu-lista-atajos">
          <div><dt>Buscar cualquier cosa</dt><dd>${AtajosIU.teclas("ctrl+k")}</dd></div>
          <div><dt>Nuevo registro</dt><dd>${AtajosIU.teclas("n")}</dd></div>
          <div><dt>Filtrar la tabla</dt><dd>${AtajosIU.teclas("/")}</dd></div>
          <div><dt>Cambiar de módulo</dt><dd>${AtajosIU.teclas("alt+1")}…${AtajosIU.teclas("5")}</dd></div>
          <div><dt>Todos los atajos</dt><dd>${AtajosIU.teclas("?")}</dd></div>
        </dl>`;
      return tarjeta;
    }

    /* ---------------- Librería: catálogo de componentes ---------------- */
    vistaCatalogo() {
      this.escenario.appendChild(this.cabeceraVista(
        "Componentes de intUIción",
        "Catálogo vivo: cada pieza funciona igual que dentro de la aplicación."
      ));

      const rejilla = DOM.crear("div", { class: "iu-rejilla" });
      const tarjeta = (titulo, texto, ...contenido) => {
        const t = DOM.crear("article", { class: "iu-tarjeta" });
        t.innerHTML = `<h3>${titulo}</h3><p class="iu-tenue">${texto}</p>`;
        const fila = DOM.crear("div", { class: "iu-barra" });
        fila.append(...contenido);
        t.appendChild(fila);
        rejilla.appendChild(t);
        return t;
      };
      const boton = (texto, clase, alPulsar) => DOM.crear("button", { class: `iu-btn ${clase}`, type: "button", onclick: alPulsar }, texto);

      tarjeta("Botones", "Principal, secundario, fantasma y peligro. Todos con foco visible.",
        boton("Principal", "", () => {}), boton("Secundario", "secundario", () => {}),
        boton("Fantasma", "fantasma", () => {}), boton("Peligro", "peligro", () => {}));

      const insignias = DOM.crear("div", { class: "iu-barra" });
      insignias.innerHTML = Object.entries(TablaIU.ESTADOS)
        .map(([estado, tipo]) => `<span class="iu-insignia ${tipo}">${estado}</span>`).join("");
      tarjeta("Insignias de estado", "El color nunca va solo: siempre acompaña a un texto.", insignias);

      tarjeta("Toasts", "Se pausan al pasar el ratón por encima. El de borrado ofrece deshacer.",
        boton("Éxito", "secundario", () => this.toast.ok("Guardado", "La operación se ha completado.")),
        boton("Aviso", "secundario", () => this.toast.aviso("Revisa los datos", "Hay campos incompletos.")),
        boton("Error", "secundario", () => this.toast.error("No se pudo guardar", "Comprueba la conexión.")),
        boton("Con deshacer", "", () => this.toast.mostrar({
          tipo: "peligro", titulo: "Elemento eliminado", texto: "Tienes 7 segundos para recuperarlo.", duracion: 7000,
          accion: { texto: "Deshacer", alPulsar: () => this.toast.ok("Recuperado", "No ha pasado nada.") }
        })));

      tarjeta("Modal", "Atrapa el foco, se cierra con Esc y devuelve el foco a donde estaba.",
        boton("Abrir modal", "secundario", () => this.modal.abrir({ titulo: "Ventana modal", contenido: "<p>Pulsa Tab: el foco no sale de aquí.</p>" })),
        boton("Confirmación", "", async () => {
          const ok = await this.modal.confirmar("¿Aterrizar ahora?", "La confirmación devuelve una promesa con la respuesta.", { aceptar: "Aterrizar" });
          this.toast.info("Respuesta", ok ? "Has aceptado" : "Has cancelado");
        }));

      tarjeta("Panel lateral", "Redimensionable desde el borde. Por encima de 560 px el formulario pasa a dos columnas, y recuerda el ancho.",
        boton("Nuevo pedido", "", () => this.abrirFormulario("pedidos", null)),
        boton("Editar Iberia", "secundario", () => this.abrirFormulario("clientes", this.estado.entidades.clientes.registros[0])));

      // Validación en vivo de un formulario suelto
      const formulario = new FormularioIU([
        { nombre: "email", etiqueta: "Email", tipo: "email", requerido: true },
        { nombre: "plazas", etiqueta: "Plazas", tipo: "number", minimo: 1, ayuda: "Al menos una" },
        { nombre: "matricula", etiqueta: "Matrícula", tipo: "text", patron: "^[A-Z]{1,2}-[A-Z]{3,4}$", ayuda: "Formato EC-ABC" }
      ]);
      formulario.elemento.addEventListener("submit", (e) => {
        e.preventDefault();
        if (formulario.validar()) this.toast.ok("Formulario correcto", JSON.stringify(formulario.leer()));
      });
      formulario.elemento.appendChild(DOM.crear("div", { class: "iu-completo" }, DOM.crear("button", { class: "iu-btn", type: "submit" }, "Validar")));
      const tarjetaForm = tarjeta("Validación en vivo", "Escribe y sal del campo: a partir de ahí te avisa en cada tecla.");
      tarjetaForm.appendChild(formulario.elemento);
      tarjetaForm.style.gridColumn = "1 / -1";

      const vacio = new TablaIU({ definicion: { titulo: "Inspecciones", columnas: [] }, registros: [], filtro: "" }).renderVacio();
      tarjeta("Estado vacío", "Una tabla sin datos explica qué hacer en lugar de quedarse en blanco.").appendChild(vacio);

      this.escenario.appendChild(rejilla);
    }

    /* ---------------- Librería: apariencia (propiedades) ---------------- */
    vistaApariencia() {
      const p = this.preferencias.valores;
      this.escenario.appendChild(this.cabeceraVista(
        "Apariencia",
        "Las propiedades de la librería son variables CSS: aquí se cambian en vivo y se recuerdan."
      ));

      const tarjeta = DOM.crear("article", { class: "iu-tarjeta" });
      tarjeta.style.maxWidth = "720px";

      const segmentado = (nombre, opciones, actual, alCambiar) => {
        const grupo = DOM.crear("div", { class: "iu-segmentado", role: "group", "aria-label": nombre });
        opciones.forEach(([valor, texto]) => {
          grupo.appendChild(DOM.crear("button", {
            type: "button",
            "aria-pressed": String(valor === actual),
            onclick: () => alCambiar(valor)
          }, texto));
        });
        return grupo;
      };

      const filas = [
        ["Tema", segmentado("Tema", [["oscuro", "Oscuro"], ["claro", "Claro"]], p.tema, (v) => this.cambiarPreferencia("tema", v))],
        ["Color de acento", (() => {
          const muestras = DOM.crear("div", { class: "iu-muestras", role: "group", "aria-label": "Color de acento" });
          PreferenciasIU.ACENTOS.forEach((a) => {
            const m = DOM.crear("button", { class: "iu-muestra", type: "button", title: a.nombre, "aria-label": a.nombre, "aria-pressed": String(a.h === p.acento), onclick: () => this.cambiarPreferencia("acento", a.h) });
            m.style.setProperty("--h", a.h);
            muestras.appendChild(m);
          });
          return muestras;
        })()],
        ["Densidad", segmentado("Densidad", [["compacta", "Compacta"], ["normal", "Normal"], ["amplia", "Amplia"]], p.densidad, (v) => this.cambiarPreferencia("densidad", v))],
        ["Radio de las esquinas", (() => {
          const control = DOM.crear("label", { class: "iu-barra" });
          control.innerHTML = `<input type="range" min="0" max="18" step="1" value="${p.radio}" aria-label="Radio de las esquinas" style="accent-color:var(--acento)"> <span class="iu-mono">${p.radio}px</span>`;
          const rango = DOM.uno("input", control);
          rango.addEventListener("input", () => {
            this.preferencias.cambiar("radio", Number(rango.value));
            DOM.uno("span", control).textContent = `${rango.value}px`;
          });
          return control;
        })()]
      ];

      filas.forEach(([titulo, control]) => {
        const fila = DOM.crear("div", { class: "iu-vista-cabecera" });
        fila.style.cssText = "align-items:center;margin:0;padding:14px 0;border-bottom:1px solid var(--borde)";
        fila.append(DOM.crear("strong", {}, titulo), control);
        tarjeta.appendChild(fila);
      });

      const acciones = DOM.crear("div", { class: "iu-barra" });
      acciones.style.marginTop = "18px";
      acciones.append(
        DOM.crear("button", { class: "iu-btn secundario", type: "button", onclick: () => { this.preferencias.restablecer(); this.pintarEscenario(); } }, "Apariencia por defecto"),
        DOM.crear("button", { class: "iu-btn secundario", type: "button", onclick: () => this.restablecerColumnas() }, "Restablecer columnas"),
        DOM.crear("button", { class: "iu-btn peligro", type: "button", onclick: () => this.restablecerDatos() }, "Restablecer datos de REDKYBER")
      );
      tarjeta.appendChild(acciones);
      this.escenario.appendChild(tarjeta);
    }

    cambiarPreferencia(clave, valor) {
      this.preferencias.cambiar(clave, valor);
      if (this.estado.vista === "apariencia") this.pintarEscenario();
    }

    restablecerColumnas() {
      this.almacen.borrar("columnas");
      DOM.todos(".iu-columna").forEach((columna) => {
        this.columnas.compactar(columna, false, false);
        columna.style.width = "";
        columna.style.flexBasis = "";
      });
      this.columnas.estado = {};
      this.toast.ok("Columnas restablecidas", "Vuelven al ancho original.");
    }

    async restablecerDatos() {
      const seguro = await this.modal.confirmar(
        "¿Restablecer los datos?",
        "Se pierden los registros creados, editados o borrados y se recargan los de REDKYBER.",
        { aceptar: "Restablecer", peligro: true }
      );
      if (!seguro) return;
      this.almacen.borrarPorPrefijo("datos:");
      location.reload();
    }

    /* ---------------- Librería: atajos ---------------- */
    vistaAtajos() {
      this.escenario.appendChild(this.cabeceraVista("Atajos de teclado", "Toda la aplicación se puede usar sin ratón."));
      const tarjeta = DOM.crear("article", { class: "iu-tarjeta" });
      tarjeta.style.maxWidth = "720px";
      tarjeta.appendChild(this.listaAtajos());
      this.escenario.appendChild(tarjeta);
    }

    listaAtajos() {
      const lista = DOM.crear("dl", { class: "iu-lista-atajos" });
      const extra = [
        ["ctrl+enter", "Guardar el formulario abierto"],
        ["escape", "Cerrar panel, modal o paleta / limpiar filtro"],
        ["arrowup+arrowdown", "Moverse por las filas de la tabla"],
        ["enter", "Editar la fila seleccionada"],
        ["delete", "Eliminar la fila seleccionada"]
      ];
      [...this.atajos.lista.filter((a) => a.visible).map((a) => [a.combinacion, a.descripcion]), ...extra]
        .forEach(([combinacion, descripcion]) => {
          const fila = DOM.crear("div");
          fila.innerHTML = `<dt>${Utilidades.escapar(descripcion)}</dt><dd>${AtajosIU.teclas(combinacion)}</dd>`;
          lista.appendChild(fila);
        });
      return lista;
    }

    /* ---------------- Paleta de comandos ---------------- */
    comandos(consulta) {
      const lista = [];

      this.estado.modulos.forEach((modulo) =>
        modulo.vistas.forEach((vista) => {
          lista.push({
            grupo: "Ir a",
            texto: vista.texto,
            claves: modulo.texto,
            pista: modulo.texto,
            icono: vista.icono || this.estado.entidades[vista.id]?.icono || modulo.icono,
            accion: () => this.irVista(modulo.id, vista.id)
          });
        })
      );

      ENTIDADES.forEach((id) => {
        const definicion = this.estado.entidades[id];
        lista.push({
          grupo: "Crear",
          texto: `Nuevo en ${definicion.titulo}`,
          claves: "nuevo crear añadir",
          icono: "+",
          accion: () => this.abrirFormulario(id, null)
        });
      });

      lista.push(
        { grupo: "Acciones", texto: "Cambiar tema claro / oscuro", claves: "modo noche dia", icono: "Aa", atajo: "t", accion: () => this.cambiarPreferencia("tema", this.preferencias.valores.tema === "oscuro" ? "claro" : "oscuro") },
        { grupo: "Acciones", texto: "Ver atajos de teclado", claves: "ayuda teclas", icono: "⌨", atajo: "?", accion: () => this.mostrarAtajos() },
        { grupo: "Acciones", texto: "Contraer o expandir los menús", claves: "columnas", icono: "«", atajo: "[", accion: () => this.alternarColumnas() },
        { grupo: "Acciones", texto: "Restablecer datos de REDKYBER", claves: "reiniciar demo", icono: "↺", accion: () => this.restablecerDatos() },
        { grupo: "Acciones", texto: "Cerrar sesión", claves: "salir logout", icono: "⎋", accion: () => this.cerrarSesion() }
      );

      if (this.vistaActual?.tipo === "entidad") {
        lista.push({ grupo: "Acciones", texto: `Exportar ${this.vistaActual.texto} a CSV`, claves: "descargar", icono: "⇩", accion: () => this.exportarCSV(this.estado.vista) });
      }

      // Con algo escrito, también se buscan registros: «iberia» abre la ficha de Iberia
      if (consulta.trim().length >= 2) {
        ENTIDADES.forEach((id) => {
          this.estado.entidades[id].registros.forEach((registro) => {
            lista.push({
              grupo: "Registros",
              texto: this.nombreRegistro(id, registro),
              pista: this.estado.entidades[id].titulo,
              icono: this.estado.entidades[id].icono,
              accion: () => {
                this.irA(id);
                this.abrirFormulario(id, registro);
              }
            });
          });
        });
      }

      return lista;
    }

    /* ---------------- Atajos y eventos ---------------- */
    registrarAtajos() {
      this.atajos.registrar("ctrl+k", "Abrir la paleta de comandos", () => this.paleta.alternar(), { global: true });
      this.atajos.registrar("n", "Nuevo registro en la vista actual", () => this.nuevo());
      this.atajos.registrar("/", "Filtrar la tabla", () => {
        const filtro = DOM.uno("#filtro");
        if (filtro) {
          filtro.focus();
          filtro.select();
        } else {
          this.paleta.abrir();
        }
      });
      this.atajos.registrar("t", "Cambiar tema claro / oscuro", () => this.cambiarPreferencia("tema", this.preferencias.valores.tema === "oscuro" ? "claro" : "oscuro"));
      this.atajos.registrar("[", "Contraer o expandir los menús", () => this.alternarColumnas());
      this.atajos.registrar("?", "Ver los atajos de teclado", () => this.mostrarAtajos());
      this.estado.modulos.forEach((modulo, indice) => {
        this.atajos.registrar(`alt+${indice + 1}`, `Ir a ${modulo.texto}`, () => this.irModulo(modulo.id), { global: true, visible: indice === 0 });
      });
      // La descripción del primero sirve para todos
      this.atajos.lista.find((a) => a.combinacion === "alt+1").descripcion = "Ir a un módulo (Alt + 1…5)";
    }

    nuevo() {
      if (this.vistaActual.tipo === "entidad") this.abrirFormulario(this.estado.vista, null);
      else this.paleta.abrir("nuevo ");
    }

    mostrarAtajos() {
      if (this.modal.abierto) return;
      this.modal.abrir({ titulo: "Atajos de teclado", contenido: this.listaAtajos(), acciones: [{ texto: "Entendido", valor: true }] });
    }

    alternarColumnas() {
      const columnas = DOM.todos(".iu-columna");
      const compactar = !columnas.every((c) => c.classList.contains("compacto"));
      columnas.forEach((c) => this.columnas.compactar(c, compactar));
    }

    cerrarSesion() {
      this.almacen.borrar("usuario");
      location.href = "login.html";
    }

    activarEventos() {
      DOM.uno("#lanzador").addEventListener("click", () => this.paleta.abrir());
      DOM.uno("#nuevo").addEventListener("click", () => this.nuevo());
      DOM.uno("#tema").addEventListener("click", () => this.cambiarPreferencia("tema", this.preferencias.valores.tema === "oscuro" ? "claro" : "oscuro"));
      DOM.uno("#salir").addEventListener("click", (evento) => {
        evento.preventDefault();
        this.cerrarSesion();
      });

      // Arrastrar una vista de la columna al escenario la abre (heredado de la base)
      this.escenario.addEventListener("dragover", (evento) => {
        evento.preventDefault();
        this.escenario.classList.add("drag-over");
      });
      this.escenario.addEventListener("dragleave", () => this.escenario.classList.remove("drag-over"));
      this.escenario.addEventListener("drop", (evento) => {
        evento.preventDefault();
        this.escenario.classList.remove("drag-over");
        const [modulo, vista] = evento.dataTransfer.getData("text/plain").split("/");
        if (this.buscarVista(modulo, vista)) this.irVista(modulo, vista);
      });

      // En pantallas estrechas las columnas se contraen solas
      const estrecha = window.matchMedia("(max-width: 900px)");
      const ajustar = () => {
        if (estrecha.matches) DOM.todos(".iu-columna").forEach((c) => this.columnas.compactar(c, true, false));
      };
      estrecha.addEventListener("change", ajustar);
      ajustar();
    }
  }

  window.intuicion.redkyber = AplicacionRedkyber;

  document.addEventListener("DOMContentLoaded", () => {
    window.intuicion.app = new AplicacionRedkyber();
    window.intuicion.app.iniciar();
  });
})();
