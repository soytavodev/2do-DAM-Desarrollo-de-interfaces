/**
 * intUIción · librería de interfaz
 *
 * Namespace técnico: intuicion.iu  (igual que jocarsa-iu usa jocarsa.iu)
 *
 * Idea de diseño: componentes que guían al usuario para que no tenga que pensar.
 *  - Todo se puede hacer con teclado (atajos + paleta de comandos).
 *  - Los formularios avisan mientras escribes, no después.
 *  - Las acciones destructivas se pueden deshacer.
 *  - La interfaz recuerda cómo la dejaste.
 *
 * A diferencia de la base (jocarsa-ui-modal-drawer), los componentes flotantes
 * (modal, drawer, toasts, paleta) crean su propio HTML: basta con instanciarlos,
 * no hace falta copiar su marcado en cada página.
 */
window.intuicion = window.intuicion || {};
window.intuicion.iu = window.intuicion.iu || {};

(() => {
  "use strict";

  /* =======================================================
     Utilidades
     ======================================================= */
  class DOM {
    static uno(selector, contexto = document) {
      return contexto.querySelector(selector);
    }

    static todos(selector, contexto = document) {
      return [...contexto.querySelectorAll(selector)];
    }

    /** Crea un elemento: DOM.crear("button", { class: "iu-btn", type: "button" }, "Texto") */
    static crear(etiqueta, atributos = {}, contenido = "") {
      const elemento = document.createElement(etiqueta);

      for (const [clave, valor] of Object.entries(atributos)) {
        if (valor === false || valor === null || valor === undefined) continue;
        if (clave.startsWith("on") && typeof valor === "function") {
          elemento.addEventListener(clave.slice(2), valor);
        } else {
          elemento.setAttribute(clave, valor === true ? "" : valor);
        }
      }

      if (contenido instanceof Node) elemento.appendChild(contenido);
      else if (contenido !== "") elemento.textContent = contenido;

      return elemento;
    }

    static enfocables(contenedor) {
      return DOM.todos(
        'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        contenedor
      ).filter((nodo) => nodo.offsetParent !== null || nodo === document.activeElement);
    }

    /** Dentro de un modal o drawer, Tab no puede escaparse fuera */
    static atraparFoco(contenedor, evento) {
      if (evento.key !== "Tab") return;

      const enfocables = DOM.enfocables(contenedor);
      if (!enfocables.length) return;

      const primero = enfocables[0];
      const ultimo = enfocables[enfocables.length - 1];

      if (evento.shiftKey && document.activeElement === primero) {
        evento.preventDefault();
        ultimo.focus();
      } else if (!evento.shiftKey && document.activeElement === ultimo) {
        evento.preventDefault();
        primero.focus();
      }
    }
  }

  class Utilidades {
    static escapar(texto) {
      return String(texto ?? "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
    }

    /** Minúsculas y sin tildes: "Aviónica" → "avionica" */
    static normalizar(texto) {
      return String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
    }

    static iniciales(texto) {
      return String(texto || "?")
        .split(/[\s@.]+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((parte) => parte.charAt(0).toUpperCase())
        .join("");
    }

    static hashTexto(texto) {
      let hash = 0;
      for (const caracter of String(texto)) {
        hash = caracter.charCodeAt(0) + ((hash << 5) - hash);
      }
      return Math.abs(hash);
    }

    /**
     * Búsqueda difusa: "nvped" encuentra "Nuevo pedido".
     * Devuelve { puntos, posiciones } o null si no coincide.
     */
    static coincidencia(consulta, texto) {
      const q = Utilidades.normalizar(consulta).replace(/\s+/g, "");
      const t = Utilidades.normalizar(texto);

      if (!q) return { puntos: 0, posiciones: [] };

      const posiciones = [];
      let puntos = 0;
      let desde = 0;

      for (const caracter of q) {
        const indice = t.indexOf(caracter, desde);
        if (indice === -1) return null;

        const anterior = posiciones[posiciones.length - 1];
        if (anterior === indice - 1) puntos += 5;               // letras seguidas
        if (indice === 0 || t[indice - 1] === " ") puntos += 8; // inicio de palabra
        puntos -= Math.min(indice - desde, 4);                  // huecos penalizan

        posiciones.push(indice);
        desde = indice + 1;
      }

      return { puntos, posiciones };
    }

    /** Devuelve HTML con <b> en las letras que coinciden */
    static resaltarPosiciones(texto, posiciones) {
      const marcadas = new Set(posiciones);
      return [...String(texto)]
        .map((c, i) => (marcadas.has(i) ? `<b>${Utilidades.escapar(c)}</b>` : Utilidades.escapar(c)))
        .join("");
    }

    /** Devuelve HTML con <mark> en las apariciones literales del filtro */
    static resaltarFiltro(texto, filtro) {
      const original = String(texto ?? "");
      if (!filtro) return Utilidades.escapar(original);

      const normal = Utilidades.normalizar(original);
      const buscado = Utilidades.normalizar(filtro);
      let resultado = "";
      let desde = 0;
      let indice = normal.indexOf(buscado);

      while (indice !== -1 && buscado) {
        resultado += Utilidades.escapar(original.slice(desde, indice));
        resultado += `<mark>${Utilidades.escapar(original.slice(indice, indice + buscado.length))}</mark>`;
        desde = indice + buscado.length;
        indice = normal.indexOf(buscado, desde);
      }

      return resultado + Utilidades.escapar(original.slice(desde));
    }
  }

  class Formato {
    static moneda(valor, compacto = false) {
      return new Intl.NumberFormat("es-ES", {
        style: "currency",
        currency: "EUR",
        maximumFractionDigits: compacto ? 1 : 0,
        notation: compacto ? "compact" : "standard"
      }).format(Number(valor) || 0);
    }

    static numero(valor) {
      return new Intl.NumberFormat("es-ES").format(Number(valor) || 0);
    }

    static fecha(valor) {
      if (!valor) return "";
      const fecha = new Date(`${valor}T00:00:00`);
      if (Number.isNaN(fecha.getTime())) return valor;
      return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "short", year: "numeric" }).format(fecha);
    }
  }

  /** localStorage con espacio de nombres y a prueba de navegadores que lo bloquean */
  class Almacen {
    constructor(prefijo = "intuicion") {
      this.prefijo = prefijo;
    }

    leer(clave, defecto = null) {
      try {
        const valor = localStorage.getItem(`${this.prefijo}:${clave}`);
        return valor === null ? defecto : JSON.parse(valor);
      } catch {
        return defecto;
      }
    }

    guardar(clave, valor) {
      try {
        localStorage.setItem(`${this.prefijo}:${clave}`, JSON.stringify(valor));
      } catch {
        /* sin almacenamiento: la interfaz sigue funcionando, solo no recuerda */
      }
    }

    borrar(clave) {
      try {
        localStorage.removeItem(`${this.prefijo}:${clave}`);
      } catch {
        /* nada que borrar */
      }
    }

    borrarPorPrefijo(inicio) {
      try {
        Object.keys(localStorage)
          .filter((clave) => clave.startsWith(`${this.prefijo}:${inicio}`))
          .forEach((clave) => localStorage.removeItem(clave));
      } catch {
        /* nada que borrar */
      }
    }
  }

  class OrigenDatos {
    static async cargarJSON(url) {
      const respuesta = await fetch(url);
      if (!respuesta.ok) throw new Error(`${url} (${respuesta.status})`);
      return respuesta.json();
    }
  }

  /* =======================================================
     Preferencias de apariencia (propiedades de la librería)
     ======================================================= */
  class PreferenciasIU {
    static ACENTOS = [
      { nombre: "Rojo REDKYBER", h: 357 },
      { nombre: "Ámbar cabina", h: 34 },
      { nombre: "Verde radar", h: 152 },
      { nombre: "Cian", h: 190 },
      { nombre: "Violeta", h: 262 }
    ];

    static DEFECTO = { tema: "oscuro", acento: 357, densidad: "normal", radio: 10 };

    constructor(almacen) {
      this.almacen = almacen;
      this.valores = { ...PreferenciasIU.DEFECTO, ...almacen.leer("preferencias", {}) };
      this.aplicar();
    }

    cambiar(clave, valor) {
      this.valores[clave] = valor;
      this.almacen.guardar("preferencias", this.valores);
      this.aplicar();
      document.dispatchEvent(new CustomEvent("iu:preferencias", { detail: { ...this.valores } }));
    }

    alternarTema() {
      this.cambiar("tema", this.valores.tema === "oscuro" ? "claro" : "oscuro");
    }

    restablecer() {
      this.valores = { ...PreferenciasIU.DEFECTO };
      this.almacen.borrar("preferencias");
      this.aplicar();
      document.dispatchEvent(new CustomEvent("iu:preferencias", { detail: { ...this.valores } }));
    }

    aplicar() {
      const raiz = document.documentElement;
      raiz.dataset.tema = this.valores.tema;
      raiz.dataset.densidad = this.valores.densidad;
      raiz.style.setProperty("--acento-h", this.valores.acento);
      raiz.style.setProperty("--radio", `${this.valores.radio}px`);
    }
  }

  /* =======================================================
     Toasts
     ======================================================= */
  class ToastIU {
    static ICONOS = { ok: "✓", info: "i", aviso: "!", peligro: "×" };

    constructor() {
      this.pila = DOM.crear("div", { class: "iu-toasts", "aria-live": "polite", role: "status" });
      document.body.appendChild(this.pila);
    }

    /**
     * toast.mostrar({ tipo: "ok", titulo: "Guardado", texto: "...",
     *                 accion: { texto: "Deshacer", alPulsar: () => {} }, duracion: 6000 })
     */
    mostrar({ tipo = "info", titulo = "Información", texto = "", accion = null, duracion = 5000 } = {}) {
      const toast = DOM.crear("article", { class: `iu-toast ${tipo}` });
      toast.style.setProperty("--duracion", `${duracion}ms`);
      toast.innerHTML = `
        <div class="iu-toast-icono" aria-hidden="true">${ToastIU.ICONOS[tipo] || "i"}</div>
        <div>
          <p class="iu-toast-titulo">${Utilidades.escapar(titulo)}</p>
          <p class="iu-toast-texto">${Utilidades.escapar(texto)}</p>
        </div>
        <div class="iu-toast-acciones"></div>
        <div class="iu-toast-tiempo"></div>
      `;

      const acciones = DOM.uno(".iu-toast-acciones", toast);
      let cerrado = false;

      const cerrar = () => {
        if (cerrado) return;
        cerrado = true;
        toast.classList.add("saliendo");
        setTimeout(() => toast.remove(), 200);
      };

      if (accion) {
        acciones.appendChild(
          DOM.crear("button", {
            class: "iu-toast-accion",
            type: "button",
            onclick: () => {
              accion.alPulsar();
              cerrar();
            }
          }, accion.texto)
        );
      }

      acciones.appendChild(
        DOM.crear("button", { class: "iu-cerrar", type: "button", "aria-label": "Cerrar aviso", onclick: cerrar }, "×")
      );

      // El cierre automático lo marca la barra de tiempo: si se pausa con el ratón, el toast espera.
      DOM.uno(".iu-toast-tiempo", toast).addEventListener("animationend", cerrar);

      this.pila.appendChild(toast);
      return { cerrar };
    }

    ok(titulo, texto, extra = {}) { return this.mostrar({ tipo: "ok", titulo, texto, ...extra }); }
    info(titulo, texto, extra = {}) { return this.mostrar({ tipo: "info", titulo, texto, ...extra }); }
    aviso(titulo, texto, extra = {}) { return this.mostrar({ tipo: "aviso", titulo, texto, ...extra }); }
    error(titulo, texto, extra = {}) { return this.mostrar({ tipo: "peligro", titulo, texto, ...extra }); }
  }

  /* =======================================================
     Modal
     ======================================================= */
  class ModalIU {
    constructor() {
      this.capa = DOM.crear("div", { class: "iu-capa", "aria-hidden": "true" });
      this.capa.innerHTML = `
        <div class="iu-fondo-modal" data-cerrar></div>
        <section class="iu-modal" role="dialog" aria-modal="true" aria-labelledby="iuModalTitulo">
          <header class="iu-modal-cabecera">
            <h2 id="iuModalTitulo"></h2>
            <button class="iu-cerrar" type="button" data-cerrar aria-label="Cerrar">×</button>
          </header>
          <div class="iu-modal-cuerpo"></div>
          <footer class="iu-modal-acciones"></footer>
        </section>
      `;
      document.body.appendChild(this.capa);

      this.titulo = DOM.uno("h2", this.capa);
      this.cuerpo = DOM.uno(".iu-modal-cuerpo", this.capa);
      this.acciones = DOM.uno(".iu-modal-acciones", this.capa);
      this.resolver = null;
      this.focoPrevio = null;

      DOM.todos("[data-cerrar]", this.capa).forEach((nodo) => nodo.addEventListener("click", () => this.cerrar(null)));
      this.capa.addEventListener("keydown", (evento) => {
        DOM.atraparFoco(DOM.uno(".iu-modal", this.capa), evento);
        if (evento.key === "Escape") {
          evento.stopPropagation();
          this.cerrar(null);
        }
      });
    }

    get abierto() {
      return this.capa.classList.contains("abierto");
    }

    /**
     * Abre el modal y devuelve una promesa con el valor del botón pulsado
     * (null si se cierra con ×, Escape o clic fuera).
     */
    abrir({ titulo, contenido = "", acciones = [{ texto: "Aceptar", valor: true }] }) {
      if (this.resolver) this.resolver(null);

      this.focoPrevio = document.activeElement;
      this.titulo.textContent = titulo;
      this.cuerpo.replaceChildren();
      if (contenido instanceof Node) this.cuerpo.appendChild(contenido);
      else this.cuerpo.innerHTML = contenido;

      this.acciones.replaceChildren(
        ...acciones.map((accion) =>
          DOM.crear("button", {
            class: `iu-btn ${accion.clase || ""}`,
            type: "button",
            onclick: () => this.cerrar(accion.valor)
          }, accion.texto)
        )
      );
      this.acciones.hidden = acciones.length === 0;

      this.capa.classList.add("abierto");
      this.capa.setAttribute("aria-hidden", "false");

      // El foco va al botón principal (el último), que es lo que el usuario quiere hacer casi siempre
      requestAnimationFrame(() => (DOM.uno(".iu-btn:last-child", this.acciones) || DOM.uno(".iu-cerrar", this.capa)).focus());

      return new Promise((resolver) => (this.resolver = resolver));
    }

    /** Confirmación de una acción: devuelve true/false */
    async confirmar(titulo, texto, { aceptar = "Aceptar", cancelar = "Cancelar", peligro = false } = {}) {
      const respuesta = await this.abrir({
        titulo,
        contenido: `<p>${Utilidades.escapar(texto)}</p>`,
        acciones: [
          { texto: cancelar, clase: "secundario", valor: false },
          { texto: aceptar, clase: peligro ? "peligro" : "", valor: true }
        ]
      });
      return respuesta === true;
    }

    cerrar(valor = null) {
      if (!this.abierto) return;

      this.capa.classList.remove("abierto");
      this.capa.setAttribute("aria-hidden", "true");

      const resolver = this.resolver;
      this.resolver = null;
      this.focoPrevio?.focus?.();
      resolver?.(valor);
    }
  }

  /* =======================================================
     Drawer (panel lateral redimensionable)
     ======================================================= */
  class DrawerIU {
    constructor(almacen) {
      this.almacen = almacen;
      this.anchoMinimo = 340;
      this.antesDeCerrar = null;
      this.focoPrevio = null;

      this.velo = DOM.crear("div", { class: "iu-velo", "aria-hidden": "true" });
      this.panel = DOM.crear("aside", { class: "iu-drawer", "aria-hidden": "true", role: "dialog", "aria-labelledby": "iuDrawerTitulo" });
      this.panel.innerHTML = `
        <div class="iu-drawer-tirador" title="Arrastra para cambiar el ancho (doble clic: ancho por defecto)"></div>
        <header class="iu-drawer-cabecera">
          <div>
            <small></small>
            <h2 id="iuDrawerTitulo"></h2>
          </div>
          <button class="iu-cerrar" type="button" aria-label="Cerrar panel">×</button>
        </header>
        <div class="iu-drawer-cuerpo"></div>
        <footer class="iu-drawer-pie"></footer>
      `;
      document.body.append(this.velo, this.panel);

      this.modo = DOM.uno("small", this.panel);
      this.titulo = DOM.uno("h2", this.panel);
      this.cuerpo = DOM.uno(".iu-drawer-cuerpo", this.panel);
      this.pie = DOM.uno(".iu-drawer-pie", this.panel);
      this.tirador = DOM.uno(".iu-drawer-tirador", this.panel);

      const ancho = this.almacen.leer("drawer:ancho");
      if (ancho) this.panel.style.setProperty("--ancho-drawer", `${ancho}px`);

      DOM.uno(".iu-cerrar", this.panel).addEventListener("click", () => this.solicitarCierre());
      this.velo.addEventListener("click", () => this.solicitarCierre());
      this.panel.addEventListener("keydown", (evento) => {
        DOM.atraparFoco(this.panel, evento);
        if (evento.key === "Escape") {
          evento.stopPropagation();
          this.solicitarCierre();
        }
      });
      this.tirador.addEventListener("pointerdown", (evento) => this.iniciarRedimension(evento));
      this.tirador.addEventListener("dblclick", () => this.fijarAncho(460));
      window.addEventListener("resize", () => this.fijarAncho(this.panel.getBoundingClientRect().width, false));
    }

    get abierto() {
      return this.panel.classList.contains("abierto");
    }

    get anchoMaximo() {
      return Math.max(this.anchoMinimo, window.innerWidth * 0.6);
    }

    /** abrir({ modo: "CREAR", titulo, contenido: Node, pie: [Node], antesDeCerrar: async () => bool }) */
    abrir({ modo = "", titulo = "", contenido, pie = [], antesDeCerrar = null }) {
      this.focoPrevio = this.abierto ? this.focoPrevio : document.activeElement;
      this.modo.textContent = modo;
      this.titulo.textContent = titulo;
      this.cuerpo.replaceChildren(contenido);
      this.pie.replaceChildren(...pie);
      this.antesDeCerrar = antesDeCerrar;

      this.fijarAncho(this.panel.getBoundingClientRect().width || 460, false);
      this.panel.classList.add("abierto");
      this.velo.classList.add("abierto");
      this.panel.setAttribute("aria-hidden", "false");
      document.body.classList.add("iu-con-drawer");

      setTimeout(() => DOM.uno("input, select, textarea", this.cuerpo)?.focus(), 280);
    }

    /** Cierre que respeta antesDeCerrar (p. ej. "tienes cambios sin guardar") */
    async solicitarCierre() {
      if (!this.abierto) return;
      if (this.antesDeCerrar && !(await this.antesDeCerrar())) return;
      this.cerrar();
    }

    cerrar() {
      this.panel.classList.remove("abierto");
      this.velo.classList.remove("abierto");
      this.panel.setAttribute("aria-hidden", "true");
      this.antesDeCerrar = null;
      document.body.classList.remove("iu-con-drawer");
      this.focoPrevio?.focus?.();
    }

    fijarAncho(ancho, guardar = true) {
      const limitado = Math.min(this.anchoMaximo, Math.max(this.anchoMinimo, ancho));
      this.panel.style.setProperty("--ancho-drawer", `${limitado}px`);
      // Más de 560 px: el formulario pasa a dos columnas
      this.panel.classList.toggle("dos-columnas", limitado >= 560);
      if (guardar) this.almacen.guardar("drawer:ancho", Math.round(limitado));
    }

    iniciarRedimension(evento) {
      evento.preventDefault();
      const inicio = evento.clientX;
      const anchoInicial = this.panel.getBoundingClientRect().width;

      this.tirador.setPointerCapture(evento.pointerId);
      this.panel.style.transition = "none";
      document.body.classList.add("redimensionando");

      const mover = (e) => this.fijarAncho(anchoInicial + (inicio - e.clientX), false);
      const terminar = () => {
        this.tirador.removeEventListener("pointermove", mover);
        this.panel.style.transition = "";
        document.body.classList.remove("redimensionando");
        this.fijarAncho(this.panel.getBoundingClientRect().width);
      };

      this.tirador.addEventListener("pointermove", mover);
      this.tirador.addEventListener("pointerup", terminar, { once: true });
      this.tirador.addEventListener("pointercancel", terminar, { once: true });
    }
  }

  /* =======================================================
     Validación en vivo
     ======================================================= */
  class ValidadorIU {
    /** Devuelve el mensaje de error o "" si el valor es correcto */
    static mensaje(campo, valor) {
      const texto = String(valor ?? "").trim();

      if (campo.requerido && texto === "") return "Este campo es obligatorio";
      if (texto === "") return "";

      if (campo.tipo === "email" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(texto)) {
        return "Falta algo: debe ser como nombre@empresa.com";
      }
      if (campo.min && texto.length < campo.min) {
        return `Escribe al menos ${campo.min} caracteres (llevas ${texto.length})`;
      }
      if (campo.tipo === "number") {
        const numero = Number(texto);
        if (Number.isNaN(numero)) return "Tiene que ser un número";
        if (campo.minimo !== undefined && numero < campo.minimo) {
          return `El mínimo es ${Formato.numero(campo.minimo)}`;
        }
      }
      if (campo.patron && !new RegExp(campo.patron).test(texto)) {
        return campo.ayuda || "El formato no es válido";
      }
      return "";
    }
  }

  /* =======================================================
     Formulario generado a partir de una definición JSON
     ======================================================= */
  class FormularioIU {
    /**
     * @param campos      definición de campos (ver data/*.json)
     * @param registro    valores iniciales (null = crear)
     * @param referencias { clientes: [...], proveedores: [...] } para los desplegables de claves ajenas
     */
    constructor(campos, registro = null, referencias = {}) {
      this.campos = campos;
      this.registro = registro;
      this.referencias = referencias;
      this.sucio = false;
      this.elemento = DOM.crear("form", { class: "iu-form", novalidate: true });
      this.construir();
    }

    construir() {
      this.campos.forEach((campo, indice) => {
        const id = `campo-${campo.nombre}-${indice}`;
        const control = DOM.crear("label", { class: `iu-control ${campo.tipo === "textarea" ? "iu-completo" : ""}`, for: id });
        const etiqueta = DOM.crear("span", {}, campo.etiqueta);
        if (campo.requerido) etiqueta.appendChild(DOM.crear("span", { class: "iu-requerido", "aria-hidden": "true" }, "*"));

        const entrada = this.crearEntrada(campo, id);
        const ayuda = DOM.crear("small", { class: "iu-ayuda", id: `${id}-ayuda` }, campo.ayuda || "");
        entrada.setAttribute("aria-describedby", ayuda.id);

        control.append(etiqueta, entrada, ayuda);
        this.elemento.appendChild(control);

        // Validación en vivo: tras salir del campo la primera vez, se revalida en cada tecla
        entrada.addEventListener("blur", () => {
          entrada.dataset.tocado = "1";
          this.validarCampo(campo, entrada);
        });
        entrada.addEventListener("input", () => {
          this.sucio = true;
          if (entrada.dataset.tocado) this.validarCampo(campo, entrada);
        });
      });
    }

    crearEntrada(campo, id) {
      const valor = this.registro?.[campo.nombre] ?? "";
      const comun = { id, name: campo.nombre, required: campo.requerido || false };

      if (campo.tipo === "select" || campo.tipo === "referencia") {
        const select = DOM.crear("select", comun);
        select.appendChild(DOM.crear("option", { value: "" }, "Elige una opción…"));

        const opciones = campo.tipo === "select"
          ? campo.opciones.map((o) => ({ valor: o, texto: o }))
          : (this.referencias[campo.entidad] || []).map((r) => ({ valor: r.identificador, texto: r[campo.mostrar] }));

        opciones.forEach((opcion) => {
          select.appendChild(
            DOM.crear("option", { value: opcion.valor, selected: String(opcion.valor) === String(valor) }, opcion.texto)
          );
        });
        return select;
      }

      if (campo.tipo === "textarea") {
        const area = DOM.crear("textarea", comun);
        area.value = valor;
        return area;
      }

      const entrada = DOM.crear("input", {
        ...comun,
        type: campo.tipo === "number" ? "number" : campo.tipo,
        min: campo.minimo,
        step: campo.tipo === "number" ? "any" : null,
        autocomplete: "off"
      });
      entrada.value = valor;

      if (campo.sugerencias) {
        const lista = DOM.crear("datalist", { id: `${id}-lista` });
        campo.sugerencias.forEach((s) => lista.appendChild(DOM.crear("option", { value: s })));
        this.elemento.appendChild(lista);
        entrada.setAttribute("list", lista.id);
      }
      return entrada;
    }

    validarCampo(campo, entrada) {
      const control = entrada.closest(".iu-control");
      const ayuda = DOM.uno(".iu-ayuda", control);
      const mensaje = ValidadorIU.mensaje(campo, entrada.value);

      control.classList.toggle("invalido", Boolean(mensaje));
      control.classList.toggle("valido", !mensaje && entrada.value !== "");
      entrada.setAttribute("aria-invalid", mensaje ? "true" : "false");
      ayuda.textContent = mensaje || campo.ayuda || "";
      return !mensaje;
    }

    /** Valida todo; si algo falla, lleva el foco al primer error */
    validar() {
      let primero = null;

      this.campos.forEach((campo) => {
        const entrada = this.elemento.elements[campo.nombre];
        entrada.dataset.tocado = "1";
        if (!this.validarCampo(campo, entrada) && !primero) primero = entrada;
      });

      primero?.focus();
      return !primero;
    }

    leer() {
      const datos = {};
      this.campos.forEach((campo) => {
        const valor = this.elemento.elements[campo.nombre].value.trim();
        const numerico = campo.tipo === "number" || campo.tipo === "referencia";
        datos[campo.nombre] = numerico && valor !== "" ? Number(valor) : valor;
      });
      return datos;
    }
  }

  /* =======================================================
     Tabla: ordenación, filtro resaltado, totales y estado vacío
     ======================================================= */
  class TablaIU {
    static NUMERICOS = ["moneda", "numero", "stock"];

    static ESTADOS = {
      Pendiente: "aviso",
      Confirmado: "info",
      "En fabricación": "proceso",
      Entregado: "ok"
    };

    /**
     * new TablaIU({ definicion, registros, referencias, filtro, orden,
     *               alEditar(registro), alBorrar(registro), alOrdenar(orden), alLimpiar() })
     */
    constructor(opciones) {
      Object.assign(this, opciones);
      this.orden = this.orden || { campo: null, sentido: 1 };
    }

    filas() {
      const filtro = Utilidades.normalizar(this.filtro);
      let filas = this.registros.filter((registro) =>
        !filtro || this.definicion.columnas.some((c) => Utilidades.normalizar(this.textoCelda(c, registro)).includes(filtro))
      );

      if (this.orden.campo) {
        const columna = this.definicion.columnas.find((c) => c.campo === this.orden.campo);
        const numerica = TablaIU.NUMERICOS.includes(columna?.formato) || columna?.campo === "identificador";
        filas = [...filas].sort((a, b) => {
          const va = numerica ? Number(a[columna.campo]) : this.textoCelda(columna, a);
          const vb = numerica ? Number(b[columna.campo]) : this.textoCelda(columna, b);
          return (numerica ? va - vb : String(va).localeCompare(String(vb), "es")) * this.orden.sentido;
        });
      }
      return filas;
    }

    /** Texto plano de una celda (también se usa para filtrar y ordenar) */
    textoCelda(columna, registro) {
      const valor = registro[columna.campo];
      switch (columna.formato) {
        case "moneda": return Formato.moneda(valor);
        case "numero":
        case "stock": return Formato.numero(valor);
        case "fecha": return Formato.fecha(valor);
        case "referencia": {
          const campo = this.definicion.campos.find((c) => c.nombre === columna.campo);
          const relacionado = (this.referencias[campo.entidad] || []).find((r) => r.identificador === valor);
          return relacionado ? relacionado[campo.mostrar] : `#${valor}`;
        }
        default: return valor ?? "";
      }
    }

    htmlCelda(columna, registro) {
      const texto = this.textoCelda(columna, registro);
      const resaltado = Utilidades.resaltarFiltro(texto, this.filtro);

      switch (columna.formato) {
        case "estado":
          return `<span class="iu-insignia ${TablaIU.ESTADOS[texto] || ""}">${resaltado}</span>`;
        case "etiqueta":
          return `<span class="iu-insignia neutra">${resaltado}</span>`;
        case "stock": {
          const bajo = Number(registro[columna.campo]) < 50;
          return bajo ? `<span class="iu-insignia aviso" title="Stock bajo">${resaltado}</span>` : resaltado;
        }
        case "mono":
          return `<span class="iu-mono">${resaltado}</span>`;
        case "email":
          return `<span class="iu-tenue">${resaltado}</span>`;
        default:
          return resaltado;
      }
    }

    render() {
      const filas = this.filas();
      const columnas = this.definicion.columnas;
      const marco = DOM.crear("div", { class: "iu-tabla-marco" });

      if (!filas.length) {
        marco.appendChild(this.renderVacio());
        return marco;
      }

      const tabla = DOM.crear("table", { class: "iu-tabla" });
      const esNum = (c) => TablaIU.NUMERICOS.includes(c.formato);

      tabla.innerHTML = `
        <caption class="iu-oculto-accesible">${Utilidades.escapar(this.definicion.titulo)}. Pulsa una fila para editarla.</caption>
        <thead><tr>
          ${columnas.map((c) => `
            <th scope="col" class="${esNum(c) ? "num" : ""}"
                aria-sort="${this.orden.campo === c.campo ? (this.orden.sentido > 0 ? "ascending" : "descending") : "none"}">
              <button type="button" data-campo="${c.campo}">${Utilidades.escapar(c.etiqueta)}</button>
            </th>`).join("")}
          <th class="acciones"><span class="iu-oculto-accesible">Acciones</span></th>
        </tr></thead>
        <tbody></tbody>
        <tfoot><tr>
          ${columnas.map((c, i) => {
            if (i === 0) return `<td>${filas.length} de ${this.registros.length}</td>`;
            if (c.sumar) {
              const total = filas.reduce((suma, r) => suma + (Number(r[c.campo]) || 0), 0);
              return `<td class="${esNum(c) ? "num" : ""}">${c.formato === "moneda" ? Formato.moneda(total) : Formato.numero(total)}</td>`;
            }
            return "<td></td>";
          }).join("")}
          <td></td>
        </tr></tfoot>
      `;

      const cuerpo = DOM.uno("tbody", tabla);
      filas.forEach((registro) => {
        const fila = DOM.crear("tr", { tabindex: "0", "data-id": registro.identificador });
        fila.innerHTML = columnas
          .map((c) => `<td class="${esNum(c) ? "num" : ""}">${this.htmlCelda(c, registro)}</td>`)
          .join("") + `<td class="acciones"><button type="button" title="Eliminar" aria-label="Eliminar">🗑</button></td>`;

        fila.addEventListener("click", (evento) => {
          if (evento.target.closest(".acciones")) return;
          this.alEditar(registro);
        });
        fila.addEventListener("keydown", (evento) => {
          if (evento.key === "Enter") this.alEditar(registro);
          if (evento.key === "Delete") this.alBorrar(registro);
          if (evento.key === "ArrowDown") fila.nextElementSibling?.focus();
          if (evento.key === "ArrowUp") fila.previousElementSibling?.focus();
        });
        DOM.uno(".acciones button", fila).addEventListener("click", () => this.alBorrar(registro));
        cuerpo.appendChild(fila);
      });

      DOM.todos("thead button", tabla).forEach((boton) => {
        boton.addEventListener("click", () => {
          const campo = boton.dataset.campo;
          // Primer clic ascendente, segundo descendente, tercero sin ordenar
          if (this.orden.campo !== campo) this.orden = { campo, sentido: 1 };
          else if (this.orden.sentido === 1) this.orden = { campo, sentido: -1 };
          else this.orden = { campo: null, sentido: 1 };
          this.alOrdenar(this.orden);
        });
      });

      marco.appendChild(tabla);
      return marco;
    }

    renderVacio() {
      const vacio = DOM.crear("div", { class: "iu-vacio" });

      if (this.filtro) {
        vacio.innerHTML = `
          <div class="iu-vacio-icono">⌕</div>
          <strong>Nada coincide con «${Utilidades.escapar(this.filtro)}»</strong>
          <span>Prueba con otra palabra o quita el filtro para ver los ${this.registros.length} registros.</span>
        `;
        vacio.appendChild(DOM.crear("button", { class: "iu-btn secundario", type: "button", onclick: () => this.alLimpiar() }, "Quitar filtro"));
      } else {
        vacio.innerHTML = `
          <div class="iu-vacio-icono">+</div>
          <strong>Todavía no hay ${Utilidades.escapar(this.definicion.titulo.toLowerCase())}</strong>
          <span>Crea el primero con el botón Nuevo o pulsando la tecla <kbd>N</kbd>.</span>
        `;
      }
      return vacio;
    }
  }

  /* =======================================================
     Atajos de teclado
     ======================================================= */
  class AtajosIU {
    constructor() {
      this.lista = [];
      document.addEventListener("keydown", (evento) => this.gestionar(evento));
    }

    /**
     * registrar("ctrl+k", "Abrir la paleta de comandos", accion, { global: true })
     * global: funciona aunque el foco esté en un campo de texto
     */
    registrar(combinacion, descripcion, accion, { global = false, visible = true } = {}) {
      this.lista.push({ combinacion: combinacion.toLowerCase(), descripcion, accion, global, visible });
    }

    static describir(evento) {
      const partes = [];
      if (evento.ctrlKey || evento.metaKey) partes.push("ctrl");
      if (evento.altKey) partes.push("alt");
      let tecla = evento.key.toLowerCase();
      if (evento.altKey && /^digit\d$/i.test(evento.code)) tecla = evento.code.slice(5);
      partes.push(tecla);
      return partes.join("+");
    }

    gestionar(evento) {
      const combinacion = AtajosIU.describir(evento);
      const enCampo = evento.target.closest?.("input, textarea, select, [contenteditable]");
      const atajo = this.lista.find((a) => a.combinacion === combinacion && (a.global || !enCampo));

      if (!atajo) return;
      evento.preventDefault();
      atajo.accion(evento);
    }

    /** Texto de una combinación con teclas: "ctrl+k" → <kbd>Ctrl</kbd><kbd>K</kbd> */
    static teclas(combinacion) {
      const nombres = { ctrl: "Ctrl", alt: "Alt", escape: "Esc", delete: "Supr", enter: "↵", arrowup: "↑", arrowdown: "↓" };
      return combinacion
        .split("+")
        .map((parte) => `<kbd>${Utilidades.escapar(nombres[parte] || parte.toUpperCase())}</kbd>`)
        .join("");
    }
  }

  /* =======================================================
     Paleta de comandos (Ctrl + K)
     ======================================================= */
  class PaletaComandosIU {
    /** @param proveedor función (consulta) que devuelve [{ grupo, texto, icono, pista, atajo, accion }] */
    constructor(proveedor) {
      this.proveedor = proveedor;
      this.resultados = [];
      this.seleccion = 0;
      this.focoPrevio = null;

      this.capa = DOM.crear("div", { class: "iu-capa paleta", "aria-hidden": "true" });
      this.capa.innerHTML = `
        <div class="iu-fondo-modal"></div>
        <section class="iu-modal" role="dialog" aria-modal="true" aria-label="Paleta de comandos">
          <div class="iu-paleta-entrada">
            <span aria-hidden="true">⌕</span>
            <input type="text" role="combobox" aria-expanded="true" aria-controls="iuPaletaLista"
                   aria-autocomplete="list" placeholder="¿Qué quieres hacer? Prueba «nuevo», «tema», «pedidos»…">
            <kbd>Esc</kbd>
          </div>
          <ul class="iu-paleta-lista" id="iuPaletaLista" role="listbox"></ul>
          <div class="iu-paleta-pie">
            <span><kbd>↑</kbd> <kbd>↓</kbd> moverse</span>
            <span><kbd>↵</kbd> ejecutar</span>
            <span><kbd>Esc</kbd> cerrar</span>
          </div>
        </section>
      `;
      document.body.appendChild(this.capa);

      this.entrada = DOM.uno("input", this.capa);
      this.lista = DOM.uno("ul", this.capa);

      DOM.uno(".iu-fondo-modal", this.capa).addEventListener("click", () => this.cerrar());
      this.entrada.addEventListener("input", () => this.filtrar());
      this.entrada.addEventListener("keydown", (evento) => this.teclear(evento));
    }

    get abierta() {
      return this.capa.classList.contains("abierto");
    }

    abrir(texto = "") {
      this.focoPrevio = document.activeElement;
      this.capa.classList.add("abierto");
      this.capa.setAttribute("aria-hidden", "false");
      this.entrada.value = texto;
      this.filtrar();
      // Foco inmediato (no en el siguiente fotograma): quien teclea rápido tras Ctrl+K no pierde letras
      this.entrada.focus();
    }

    cerrar(devolverFoco = true) {
      this.capa.classList.remove("abierto");
      this.capa.setAttribute("aria-hidden", "true");
      if (devolverFoco) this.focoPrevio?.focus?.();
    }

    alternar() {
      if (this.abierta) this.cerrar();
      else this.abrir();
    }

    filtrar() {
      const consulta = this.entrada.value;
      this.resultados = this.proveedor(consulta)
        .map((comando) => {
          const coincide = Utilidades.coincidencia(consulta, `${comando.texto} ${comando.claves || ""}`);
          return coincide && { ...comando, ...coincide };
        })
        .filter(Boolean)
        .sort((a, b) => (consulta ? b.puntos - a.puntos : 0));

      this.seleccion = 0;
      this.pintar(consulta);
    }

    pintar(consulta) {
      this.lista.replaceChildren();

      if (!this.resultados.length) {
        this.lista.innerHTML = `<li class="iu-vacio"><strong>Sin resultados</strong><span>Prueba con menos letras: la búsqueda admite saltos, «nped» encuentra «Nuevo pedido».</span></li>`;
        return;
      }

      let grupo = null;
      this.resultados.forEach((comando, indice) => {
        // Sin consulta se agrupan; con consulta manda la relevancia
        if (!consulta && comando.grupo !== grupo) {
          grupo = comando.grupo;
          this.lista.appendChild(DOM.crear("li", { class: "iu-paleta-grupo", role: "presentation" }, grupo));
        }

        const posiciones = (comando.posiciones || []).filter((p) => p < comando.texto.length);
        const opcion = DOM.crear("li", {
          class: "iu-paleta-opcion",
          role: "option",
          id: `iu-opcion-${indice}`,
          "aria-selected": indice === this.seleccion ? "true" : "false"
        });
        opcion.innerHTML = `
          <span class="iu-ficha">${Utilidades.escapar(comando.icono || "›")}</span>
          <span class="iu-etiqueta">${Utilidades.resaltarPosiciones(comando.texto, posiciones)}</span>
          ${comando.pista ? `<small>${Utilidades.escapar(comando.pista)}</small>` : ""}
          ${comando.atajo ? AtajosIU.teclas(comando.atajo) : ""}
        `;
        opcion.addEventListener("mousemove", () => this.marcar(indice));
        opcion.addEventListener("click", () => this.ejecutar(indice));
        this.lista.appendChild(opcion);
      });

      this.entrada.setAttribute("aria-activedescendant", `iu-opcion-${this.seleccion}`);
    }

    marcar(indice) {
      if (indice === this.seleccion) return;
      this.seleccion = indice;
      DOM.todos(".iu-paleta-opcion", this.lista).forEach((opcion, i) =>
        opcion.setAttribute("aria-selected", i === indice ? "true" : "false")
      );
      DOM.uno(`#iu-opcion-${indice}`, this.lista)?.scrollIntoView({ block: "nearest" });
      this.entrada.setAttribute("aria-activedescendant", `iu-opcion-${indice}`);
    }

    teclear(evento) {
      const total = this.resultados.length;
      if (evento.key === "ArrowDown") {
        evento.preventDefault();
        this.marcar((this.seleccion + 1) % total);
      } else if (evento.key === "ArrowUp") {
        evento.preventDefault();
        this.marcar((this.seleccion - 1 + total) % total);
      } else if (evento.key === "Enter") {
        evento.preventDefault();
        this.ejecutar(this.seleccion);
      } else if (evento.key === "Escape") {
        evento.preventDefault();
        evento.stopPropagation();
        this.cerrar();
      } else if (evento.key === "Tab") {
        evento.preventDefault();
      }
    }

    ejecutar(indice) {
      const comando = this.resultados[indice];
      if (!comando) return;
      this.cerrar(false);
      comando.accion();
    }
  }

  /* =======================================================
     Columnas: minimizar y redimensionar (con ratón y teclado)
     ======================================================= */
  class GestorColumnasIU {
    constructor(almacen) {
      this.almacen = almacen;
      this.anchoMinimo = 150;
      this.anchoMaximo = 420;
      this.estado = almacen.leer("columnas", {});
    }

    activar() {
      DOM.todos(".iu-columna").forEach((columna) => {
        const guardado = this.estado[columna.id] || {};
        if (guardado.ancho) this.fijarAncho(columna, guardado.ancho, false);
        if (guardado.compacto) this.compactar(columna, true, false);

        DOM.uno(".iu-minimizar", columna)?.addEventListener("click", () =>
          this.compactar(columna, !columna.classList.contains("compacto"))
        );
      });

      DOM.todos(".iu-separador").forEach((separador) => {
        separador.addEventListener("pointerdown", (evento) => this.iniciarRedimension(separador, evento));
        separador.addEventListener("dblclick", () => this.restablecer(separador.previousElementSibling));
        // Accesible: con el foco en el separador, las flechas cambian el ancho
        separador.addEventListener("keydown", (evento) => {
          const columna = separador.previousElementSibling;
          const paso = evento.shiftKey ? 40 : 10;
          if (evento.key === "ArrowLeft") this.fijarAncho(columna, columna.getBoundingClientRect().width - paso);
          if (evento.key === "ArrowRight") this.fijarAncho(columna, columna.getBoundingClientRect().width + paso);
        });
      });
    }

    guardar(columna, cambios) {
      this.estado[columna.id] = { ...this.estado[columna.id], ...cambios };
      this.almacen.guardar("columnas", this.estado);
    }

    compactar(columna, compacto, guardar = true) {
      const boton = DOM.uno(".iu-minimizar", columna);
      columna.classList.toggle("compacto", compacto);
      if (boton) {
        boton.textContent = compacto ? "»" : "« Contraer";
        boton.setAttribute("aria-expanded", String(!compacto));
        boton.title = compacto ? "Expandir columna" : "Contraer columna";
      }
      if (guardar) this.guardar(columna, { compacto });
    }

    fijarAncho(columna, ancho, guardar = true) {
      if (columna.classList.contains("compacto")) return;
      const limitado = Math.round(Math.min(this.anchoMaximo, Math.max(this.anchoMinimo, ancho)));
      columna.style.width = `${limitado}px`;
      columna.style.flexBasis = `${limitado}px`;
      if (guardar) this.guardar(columna, { ancho: limitado });
    }

    restablecer(columna) {
      columna.style.width = "";
      columna.style.flexBasis = "";
      this.guardar(columna, { ancho: null });
    }

    iniciarRedimension(separador, evento) {
      const columna = separador.previousElementSibling;
      if (!columna || columna.classList.contains("compacto")) return;

      evento.preventDefault();
      const inicio = evento.clientX;
      const anchoInicial = columna.getBoundingClientRect().width;

      separador.setPointerCapture(evento.pointerId);
      document.body.classList.add("redimensionando");

      const mover = (e) => this.fijarAncho(columna, anchoInicial + e.clientX - inicio, false);
      const terminar = () => {
        separador.removeEventListener("pointermove", mover);
        document.body.classList.remove("redimensionando");
        this.fijarAncho(columna, columna.getBoundingClientRect().width);
      };

      separador.addEventListener("pointermove", mover);
      separador.addEventListener("pointerup", terminar, { once: true });
      separador.addEventListener("pointercancel", terminar, { once: true });
    }
  }

  Object.assign(window.intuicion.iu, {
    DOM,
    Utilidades,
    Formato,
    Almacen,
    OrigenDatos,
    PreferenciasIU,
    ToastIU,
    ModalIU,
    DrawerIU,
    ValidadorIU,
    FormularioIU,
    TablaIU,
    AtajosIU,
    PaletaComandosIU,
    GestorColumnasIU
  });
})();
