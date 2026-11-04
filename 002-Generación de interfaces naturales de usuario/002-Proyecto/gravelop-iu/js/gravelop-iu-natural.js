/**
 * gravelop-iu · módulo de interfaces naturales (unidad 2)
 *
 * Amplía el namespace gravelop.iu con cuatro componentes:
 *   MarkdownIU     convierte la respuesta del modelo (Markdown) en HTML seguro
 *   VozIU          Web Speech API: voz → texto (SpeechRecognition) y texto → voz (SpeechSynthesis)
 *   AsistenteIU    ventana flotante de conversación con el modelo local (Ollama)
 *   ComandosVozIU  manos libres: frases habladas que manejan el panel («ir a facturas»)
 *
 * Necesita js/gravelop-iu.js cargado antes.
 */
(() => {
  "use strict";

  const { DOM, Utilidades } = window.gravelop.iu;

  /* =======================================================
     Markdown → HTML seguro
     Todo el texto se escapa antes de convertirlo: lo que diga el
     modelo nunca se inserta como HTML.
     ======================================================= */
  class MarkdownIU {
    static enLinea(texto) {
      return Utilidades.escapar(texto)
        .replace(/`([^`]+)`/g, "<code>$1</code>")
        .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
        .replace(/(^|[^*])\*([^*\n]+)\*/g, "$1<em>$2</em>");
    }

    static aHTML(markdown) {
      // Los modelos pequeños a veces envuelven toda la respuesta en ```markdown … ```
      const limpio = String(markdown ?? "")
        .replace(/^\s*```(?:markdown|md)?\s*\n([\s\S]*?)\n```\s*$/i, "$1")
        .replace(/\r/g, "");

      const lineas = limpio.split("\n");
      const html = [];
      let lista = null;
      let tabla = null;
      let codigo = null;

      const cerrarLista = () => { if (lista) { html.push(`</${lista}>`); lista = null; } };
      const cerrarTabla = () => {
        if (!tabla) return;
        const [cabecera, ...filas] = tabla.filter((f) => !/^\s*\|?\s*:?-{2,}/.test(f.join("")));
        html.push(`<div class="iu-md-tabla"><table class="iu-tabla"><thead><tr>${cabecera.map((c) => `<th>${MarkdownIU.enLinea(c)}</th>`).join("")}</tr></thead><tbody>${filas.map((f) => `<tr>${f.map((c) => `<td>${MarkdownIU.enLinea(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`);
        tabla = null;
      };

      for (const linea of lineas) {
        if (codigo !== null) {
          if (/^\s*```/.test(linea)) { html.push(`<pre><code>${Utilidades.escapar(codigo.join("\n"))}</code></pre>`); codigo = null; }
          else codigo.push(linea);
          continue;
        }
        if (/^\s*```/.test(linea)) { cerrarLista(); cerrarTabla(); codigo = []; continue; }

        if (/^\s*\|.*\|\s*$/.test(linea)) {
          cerrarLista();
          tabla = tabla || [];
          tabla.push(linea.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim()));
          continue;
        }
        cerrarTabla();

        const titulo = linea.match(/^\s*(#{1,4})\s+(.*)/);
        const vineta = linea.match(/^\s*[-*•]\s+(.*)/);
        const numero = linea.match(/^\s*\d+[.)]\s+(.*)/);

        if (titulo) { cerrarLista(); html.push(`<h${titulo[1].length + 2}>${MarkdownIU.enLinea(titulo[2])}</h${titulo[1].length + 2}>`); }
        else if (vineta || numero) {
          const tipo = vineta ? "ul" : "ol";
          if (lista !== tipo) { cerrarLista(); html.push(`<${tipo}>`); lista = tipo; }
          html.push(`<li>${MarkdownIU.enLinea((vineta || numero)[1])}</li>`);
        } else if (linea.trim() === "") cerrarLista();
        else { cerrarLista(); html.push(`<p>${MarkdownIU.enLinea(linea)}</p>`); }
      }
      if (codigo !== null) html.push(`<pre><code>${Utilidades.escapar(codigo.join("\n"))}</code></pre>`);
      cerrarLista();
      cerrarTabla();
      return html.join("");
    }

    /** Texto sin símbolos para leerlo en voz alta */
    static aTexto(markdown) {
      return String(markdown ?? "")
        .replace(/```[\s\S]*?```/g, " ")
        .replace(/[#*`|>_]/g, " ")
        .replace(/-{3,}/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    }
  }

  /* =======================================================
     Voz: reconocimiento y síntesis
     ======================================================= */
  class VozIU {
    constructor(idioma = "es-ES") {
      this.idioma = idioma;
      this.Reconocimiento = window.SpeechRecognition || window.webkitSpeechRecognition;
      this.reconocimiento = null;
    }

    /** Firefox no tiene SpeechRecognition: la interfaz lo comprueba antes de ofrecer el micrófono */
    get puedeEscuchar() { return Boolean(this.Reconocimiento); }
    get puedeHablar() { return "speechSynthesis" in window; }
    get escuchando() { return this.reconocimiento !== null; }

    /**
     * escuchar({ continuo, alParcial(texto), alFinal(texto), alError(codigo), alTerminar() })
     * continuo = true sigue escuchando frase tras frase (modo manos libres).
     */
    escuchar({ continuo = false, alParcial, alFinal, alError, alTerminar } = {}) {
      if (!this.puedeEscuchar) { alError?.("no-soportado"); return; }
      this.detener();

      const r = new this.Reconocimiento();
      r.lang = this.idioma;
      r.continuous = continuo;
      r.interimResults = true; // vamos enseñando lo que entiende mientras hablas

      r.addEventListener("result", (evento) => {
        for (let i = evento.resultIndex; i < evento.results.length; i++) {
          const texto = evento.results[i][0].transcript.trim();
          if (evento.results[i].isFinal) alFinal?.(texto);
          else alParcial?.(texto);
        }
      });
      r.addEventListener("error", (evento) => alError?.(evento.error));
      r.addEventListener("end", () => {
        if (this.reconocimiento !== r) return;
        this.reconocimiento = null;
        alTerminar?.();
      });

      this.reconocimiento = r;
      r.start();
    }

    detener() {
      const r = this.reconocimiento;
      this.reconocimiento = null;
      r?.stop();
    }

    hablar(texto) {
      if (!this.puedeHablar || !texto) return;
      speechSynthesis.cancel();
      const frase = new SpeechSynthesisUtterance(texto);
      frase.lang = this.idioma;
      const voz = speechSynthesis.getVoices().find((v) => v.lang === this.idioma)
        || speechSynthesis.getVoices().find((v) => v.lang.startsWith("es"));
      if (voz) frase.voice = voz;
      speechSynthesis.speak(frase);
    }

    callar() {
      if (this.puedeHablar) speechSynthesis.cancel();
    }

    static mensajeError(codigo) {
      return {
        "no-soportado": "Este navegador no reconoce la voz. Usa Chrome.",
        "not-allowed": "Has denegado el permiso del micrófono.",
        "service-not-allowed": "El navegador no permite el reconocimiento de voz.",
        "no-speech": "No he oído nada. Prueba otra vez.",
        "audio-capture": "No encuentro ningún micrófono.",
        network: "El reconocimiento de voz necesita conexión a internet."
      }[codigo] || `No se ha podido reconocer la voz (${codigo}).`;
    }
  }

  /* =======================================================
     Asistente: ventana flotante que habla con el modelo local
     ======================================================= */
  class AsistenteIU {
    /**
     * new AsistenteIU({ voz, toast, almacen, endpoint: "ollama.php",
     *                   contexto: () => "datos que ve el usuario", alEvento(texto) })
     */
    constructor(opciones) {
      Object.assign(this, opciones);
      this.historial = [];
      this.peticion = null;

      this.ventana = DOM.crear("section", { class: "iu-asistente", "aria-label": "Asistente", "aria-hidden": "true" });
      this.ventana.innerHTML = `
        <header class="iu-asistente-barra" title="Arrastra para mover">
          <span class="iu-asistente-punto" aria-hidden="true"></span>
          <strong>Asistente</strong>
          <small>modelo local</small>
          <button class="iu-cerrar" type="button" data-accion="minimizar" aria-label="Minimizar">–</button>
          <button class="iu-cerrar" type="button" data-accion="cerrar" aria-label="Cerrar">×</button>
        </header>
        <div class="iu-asistente-mensajes" aria-live="polite"></div>
        <form class="iu-asistente-entrada">
          <button class="iu-btn icono secundario" type="button" data-accion="microfono" aria-label="Dictar con la voz">🎤</button>
          <textarea rows="1" placeholder="Pregunta sobre lo que estás viendo…" aria-label="Mensaje para el asistente"></textarea>
          <button class="iu-btn icono" type="submit" aria-label="Enviar">➤</button>
        </form>
        <footer class="iu-asistente-pie">
          <label class="iu-interruptor"><input type="checkbox" data-accion="leer"><span>Leer respuestas en voz alta</span></label>
          <button class="iu-asistente-limpiar" type="button" data-accion="limpiar">Nueva conversación</button>
        </footer>
        <div class="iu-asistente-tirador" aria-hidden="true"></div>
      `;
      document.body.appendChild(this.ventana);

      this.mensajes = DOM.uno(".iu-asistente-mensajes", this.ventana);
      this.formulario = DOM.uno("form", this.ventana);
      this.texto = DOM.uno("textarea", this.ventana);
      this.microfono = DOM.uno('[data-accion="microfono"]', this.ventana);
      this.leer = DOM.uno('[data-accion="leer"]', this.ventana);

      this.leer.checked = Boolean(this.almacen.leer("asistente:leer", false));
      this.restaurarPosicion();
      this.activarEventos();
      this.pintarBienvenida();
    }

    get abierto() { return this.ventana.classList.contains("abierto"); }

    abrir(textoInicial = "") {
      this.ventana.classList.add("abierto");
      this.ventana.classList.remove("minimizado");
      this.ventana.setAttribute("aria-hidden", "false");
      if (textoInicial) this.texto.value = textoInicial;
      this.texto.focus();
    }

    cerrar() {
      this.cancelar();
      this.voz.callar();
      this.ventana.classList.remove("abierto");
      this.ventana.setAttribute("aria-hidden", "true");
    }

    alternar() { if (this.abierto) this.cerrar(); else this.abrir(); }

    activarEventos() {
      this.formulario.addEventListener("submit", (evento) => {
        evento.preventDefault();
        this.enviar(this.texto.value);
      });
      // Enter envía; Mayús + Enter hace salto de línea, como en cualquier chat
      this.texto.addEventListener("keydown", (evento) => {
        if (evento.key === "Enter" && !evento.shiftKey) {
          evento.preventDefault();
          this.formulario.requestSubmit();
        }
        if (evento.key === "Escape") { evento.stopPropagation(); this.voz.callar(); this.cerrar(); }
      });
      this.texto.addEventListener("input", () => this.ajustarAltura());

      this.ventana.addEventListener("click", (evento) => {
        const accion = evento.target.closest("[data-accion]")?.dataset.accion;
        if (accion === "cerrar") this.cerrar();
        if (accion === "minimizar") this.ventana.classList.toggle("minimizado");
        if (accion === "limpiar") { this.cancelar(); this.historial = []; this.pintarBienvenida(); }
        if (accion === "microfono") this.dictar();
      });

      this.leer.addEventListener("change", () => {
        this.almacen.guardar("asistente:leer", this.leer.checked);
        if (!this.leer.checked) this.voz.callar();
        this.alEvento?.(`change · leer en voz alta ${this.leer.checked ? "activado" : "desactivado"}`);
      });

      if (!this.voz.puedeEscuchar) {
        this.microfono.disabled = true;
        this.microfono.title = "Este navegador no reconoce la voz (Firefox no lo permite). Usa Chrome.";
      }
      if (!this.voz.puedeHablar) this.leer.disabled = true;

      this.activarArrastre();
    }

    ajustarAltura() {
      this.texto.style.height = "auto";
      this.texto.style.height = `${Math.min(this.texto.scrollHeight, 140)}px`;
    }

    pintarBienvenida() {
      this.mensajes.innerHTML = `
        <div class="iu-asistente-vacio">
          <strong>¿En qué te ayudo?</strong>
          <span>Veo los datos de la pantalla en la que estás. Prueba:</span>
          <div class="iu-asistente-sugerencias">
            <button type="button">¿Qué clientes no tienen web?</button>
            <button type="button">Resume las facturas pendientes</button>
            <button type="button">Escribe un email para ofrecer una web</button>
          </div>
        </div>`;
      DOM.todos(".iu-asistente-sugerencias button", this.mensajes).forEach((boton) =>
        boton.addEventListener("click", () => this.enviar(boton.textContent))
      );
    }

    burbuja(rol, html) {
      DOM.uno(".iu-asistente-vacio", this.mensajes)?.remove();
      const nodo = DOM.crear("div", { class: `iu-burbuja ${rol}` });
      nodo.innerHTML = html;
      this.mensajes.appendChild(nodo);
      this.mensajes.scrollTop = this.mensajes.scrollHeight;
      return nodo;
    }

    async enviar(texto) {
      const pregunta = String(texto || "").trim();
      if (!pregunta || this.peticion) return;

      this.abrir();
      this.texto.value = "";
      this.ajustarAltura();
      this.burbuja("usuario", Utilidades.escapar(pregunta));
      const respuesta = this.burbuja("modelo pensando", `<span class="iu-puntos"><i></i><i></i><i></i></span><button type="button" class="iu-asistente-cancelar">Cancelar</button>`);
      DOM.uno(".iu-asistente-cancelar", respuesta).addEventListener("click", () => this.cancelar());
      this.alEvento?.("submit · pregunta al asistente");

      this.peticion = new AbortController();
      const inicio = performance.now();

      try {
        const r = await fetch(this.endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mensaje: pregunta, contexto: this.contexto?.() || "", historial: this.historial.slice(-6) }),
          signal: this.peticion.signal
        });
        const datos = await r.json().catch(() => ({ respuesta: "El servidor no ha devuelto JSON. ¿Estás abriendo la página con PHP (Apache)?" }));
        if (!r.ok) throw new Error(datos.respuesta || `Error ${r.status}`);

        const segundos = ((performance.now() - inicio) / 1000).toFixed(1);
        respuesta.classList.remove("pensando");
        respuesta.innerHTML = `${MarkdownIU.aHTML(datos.respuesta)}<small class="iu-burbuja-pie">${Utilidades.escapar(datos.modelo || "")} · ${segundos} s</small>`;
        this.historial.push({ role: "user", content: pregunta }, { role: "assistant", content: datos.respuesta });
        if (this.leer.checked) this.voz.hablar(MarkdownIU.aTexto(datos.respuesta));
        this.alEvento?.(`respuesta del modelo en ${segundos} s`);
      } catch (error) {
        respuesta.classList.remove("pensando");
        respuesta.classList.add("error");
        respuesta.textContent = error.name === "AbortError" ? "Cancelado." : error.message;
        if (error.name !== "AbortError") this.toast.error("El asistente no ha podido responder", "¿Está Ollama en marcha? Prueba «ollama serve» en una terminal.");
      } finally {
        this.peticion = null;
        this.mensajes.scrollTop = this.mensajes.scrollHeight;
      }
    }

    cancelar() {
      this.peticion?.abort();
    }

    dictar() {
      if (this.voz.escuchando) { this.voz.detener(); return; }
      const previo = this.texto.value ? `${this.texto.value} ` : "";

      this.voz.escuchar({
        alParcial: (t) => { this.texto.value = previo + t; this.ajustarAltura(); },
        alFinal: (t) => { this.texto.value = previo + t; this.ajustarAltura(); this.alEvento?.(`result · «${t}»`); },
        alError: (codigo) => this.toast.aviso("Micrófono", VozIU.mensajeError(codigo)),
        alTerminar: () => this.microfono.classList.remove("escuchando")
      });
      if (this.voz.escuchando) {
        this.microfono.classList.add("escuchando");
        this.alEvento?.("start · dictado al asistente");
      }
    }

    /* Mover la ventana arrastrando la barra y cambiar su tamaño desde la esquina */
    activarArrastre() {
      const barra = DOM.uno(".iu-asistente-barra", this.ventana);
      const tirador = DOM.uno(".iu-asistente-tirador", this.ventana);

      const arrastrar = (elemento, alMover) => {
        elemento.addEventListener("pointerdown", (evento) => {
          if (evento.target.closest("button")) return;
          evento.preventDefault();
          const caja = this.ventana.getBoundingClientRect();
          const inicio = { x: evento.clientX, y: evento.clientY, caja };
          elemento.setPointerCapture(evento.pointerId);
          document.body.classList.add("arrastrando");
          const mover = (e) => alMover(e.clientX - inicio.x, e.clientY - inicio.y, inicio.caja);
          const soltar = () => {
            elemento.removeEventListener("pointermove", mover);
            document.body.classList.remove("arrastrando");
            this.guardarPosicion();
          };
          elemento.addEventListener("pointermove", mover);
          elemento.addEventListener("pointerup", soltar, { once: true });
        });
      };

      arrastrar(barra, (dx, dy, caja) => {
        const x = Math.min(window.innerWidth - 80, Math.max(0, caja.left + dx));
        const y = Math.min(window.innerHeight - 50, Math.max(0, caja.top + dy));
        this.colocar({ x, y });
      });
      arrastrar(tirador, (dx, dy, caja) => {
        this.colocar({ ancho: Math.max(300, caja.width + dx), alto: Math.max(260, caja.height + dy) });
      });
    }

    colocar({ x, y, ancho, alto }) {
      const s = this.ventana.style;
      if (x !== undefined) { s.left = `${x}px`; s.top = `${y}px`; s.right = "auto"; s.bottom = "auto"; }
      if (ancho) s.width = `${ancho}px`;
      if (alto) s.height = `${alto}px`;
    }

    guardarPosicion() {
      const c = this.ventana.getBoundingClientRect();
      this.almacen.guardar("asistente:posicion", { x: c.left, y: c.top, ancho: c.width, alto: c.height });
    }

    restaurarPosicion() {
      const p = this.almacen.leer("asistente:posicion");
      // Si la ventana del navegador ahora es más pequeña, volvemos a la posición por defecto
      if (p && p.x < window.innerWidth - 80 && p.y < window.innerHeight - 50) this.colocar(p);
    }
  }

  /* =======================================================
     Comandos de voz (manos libres)
     Cada comando tiene frases de ejemplo; lo que dice el usuario se
     compara con ellas y se ejecuta la que mejor encaja.
     ======================================================= */
  class ComandosVozIU {
    /**
     * new ComandosVozIU({ voz, toast, comandos: () => [{ frases: [], accion(resto) }],
     *                     alNoEntendido(texto), alEvento(texto), indicador: Element })
     */
    constructor(opciones) {
      Object.assign(this, opciones);
      this.activo = false;
    }

    alternar() { if (this.activo) this.desactivar(); else this.activar(); }

    activar() {
      if (!this.voz.puedeEscuchar) {
        this.toast.aviso("Manos libres no disponible", VozIU.mensajeError("no-soportado"));
        return;
      }
      this.activo = true;
      this.indicador?.classList.add("escuchando");
      this.indicador?.setAttribute("aria-pressed", "true");
      this.toast.info("Manos libres activado", "Di por ejemplo «ir a facturas» o «nuevo cliente». Di «parar» para terminar.");
      this.alEvento?.("start · manos libres");
      this.escuchar();
    }

    desactivar() {
      this.activo = false;
      this.voz.detener();
      this.indicador?.classList.remove("escuchando");
      this.indicador?.setAttribute("aria-pressed", "false");
      this.mostrarParcial("");
      this.alEvento?.("end · manos libres");
    }

    escuchar() {
      this.voz.escuchar({
        continuo: true,
        alParcial: (t) => this.mostrarParcial(t),
        alFinal: (t) => { this.mostrarParcial(""); this.interpretar(t); },
        alError: (codigo) => {
          // «no-speech» es normal en manos libres: simplemente no has dicho nada
          if (codigo === "no-speech" || codigo === "aborted") return;
          this.toast.aviso("Manos libres", VozIU.mensajeError(codigo));
          this.desactivar();
        },
        // Chrome corta la escucha continua cada cierto tiempo: si seguimos activos, volvemos a escuchar
        alTerminar: () => { if (this.activo) setTimeout(() => this.activo && this.escuchar(), 250); }
      });
    }

    mostrarParcial(texto) {
      if (!this.indicador) return;
      this.indicador.dataset.oido = texto;
    }

    /** Busca el comando cuya frase mejor encaja con el principio de lo dicho */
    interpretar(texto) {
      const dicho = Utilidades.normalizar(texto).replace(/[¿?¡!.,]/g, "").trim();
      if (!dicho) return;
      this.alEvento?.(`result · «${texto}»`);

      if (/^(parar|para|detener|stop|salir del modo)/.test(dicho)) {
        this.desactivar();
        this.toast.info("Manos libres desactivado", "Pulsa el botón del micrófono para volver a activarlo.");
        return;
      }

      let mejor = null;
      for (const comando of this.comandos()) {
        for (const frase of comando.frases) {
          const f = Utilidades.normalizar(frase);
          if (dicho === f || dicho.startsWith(`${f} `)) {
            // Gana la frase más larga que encaje: «nuevo cliente» antes que «nuevo»
            if (!mejor || f.length > mejor.largo) mejor = { comando, largo: f.length, resto: dicho.slice(f.length).trim() };
          }
        }
      }

      if (mejor) {
        this.toast.ok("Entendido", `«${texto}»`, { duracion: 2500 });
        mejor.comando.accion(mejor.resto);
      } else {
        this.alNoEntendido?.(texto);
      }
    }
  }

  Object.assign(window.gravelop.iu, { MarkdownIU, VozIU, AsistenteIU, ComandosVozIU });
})();
