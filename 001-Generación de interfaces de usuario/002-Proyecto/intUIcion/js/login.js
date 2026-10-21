/**
 * Pantalla de acceso de intUIción.
 * El acceso es simulado (no hay servidor): valida el formulario, guarda el
 * usuario en el navegador y entra en la aplicación.
 */
(() => {
  "use strict";

  const { DOM, Almacen, PreferenciasIU, ToastIU, ValidadorIU } = window.intuicion.iu;

  class PantallaLogin {
    constructor() {
      this.almacen = new Almacen("intuicion");
      new PreferenciasIU(this.almacen); // respeta el tema y el acento elegidos
      this.toast = new ToastIU();

      this.formulario = DOM.uno("#formLogin");
      this.email = DOM.uno("#email");
      this.clave = DOM.uno("#clave");
      this.reglas = {
        email: { tipo: "email", requerido: true },
        clave: { tipo: "password", requerido: true, min: 6 }
      };
    }

    iniciar() {
      const recordado = this.almacen.leer("emailRecordado");
      if (recordado) {
        this.email.value = recordado;
        this.clave.focus(); // si ya conocemos el email, lo siguiente es la contraseña
      } else {
        this.email.focus();
      }

      [this.email, this.clave].forEach((entrada) => {
        entrada.addEventListener("blur", () => {
          entrada.dataset.tocado = "1";
          this.validar(entrada);
        });
        entrada.addEventListener("input", () => entrada.dataset.tocado && this.validar(entrada));
      });

      // Aviso de mayúsculas activadas: el error de contraseña más tonto y más común
      this.clave.addEventListener("keyup", (evento) => this.avisarMayusculas(evento));
      this.clave.addEventListener("keydown", (evento) => this.avisarMayusculas(evento));

      DOM.uno("#verClave").addEventListener("click", (evento) => {
        const visible = this.clave.type === "password";
        this.clave.type = visible ? "text" : "password";
        evento.currentTarget.textContent = visible ? "Ocultar" : "Mostrar";
        evento.currentTarget.setAttribute("aria-pressed", String(visible));
        this.clave.focus();
      });

      this.formulario.addEventListener("submit", (evento) => {
        evento.preventDefault();
        this.entrar();
      });
    }

    validar(entrada) {
      const control = entrada.closest(".iu-control");
      const ayuda = DOM.uno(".iu-ayuda", control);
      const mensaje = ValidadorIU.mensaje(this.reglas[entrada.name], entrada.value);

      control.classList.toggle("invalido", Boolean(mensaje));
      control.classList.toggle("valido", !mensaje);
      entrada.setAttribute("aria-invalid", String(Boolean(mensaje)));
      ayuda.classList.remove("iu-aviso-mayus");
      ayuda.textContent = mensaje;
      return !mensaje;
    }

    avisarMayusculas(evento) {
      if (!evento.getModifierState) return;
      const ayuda = DOM.uno("#claveAyuda");
      if (evento.getModifierState("CapsLock")) {
        ayuda.textContent = "⇪ Tienes las mayúsculas activadas";
        ayuda.classList.add("iu-aviso-mayus");
      } else if (ayuda.classList.contains("iu-aviso-mayus")) {
        ayuda.classList.remove("iu-aviso-mayus");
        ayuda.textContent = "";
        if (this.clave.dataset.tocado) this.validar(this.clave);
      }
    }

    entrar() {
      const emailOk = this.validar(this.email);
      const claveOk = this.validar(this.clave);

      if (!emailOk || !claveOk) {
        (emailOk ? this.clave : this.email).focus();
        this.toast.aviso("No se puede entrar todavía", "Corrige los campos marcados en rojo.");
        return;
      }

      const email = this.email.value.trim();
      const nombre = email
        .split("@")[0]
        .split(/[._-]+/)
        .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
        .join(" ");

      this.almacen.guardar("usuario", { nombre, email });
      if (DOM.uno("#recordar").checked) this.almacen.guardar("emailRecordado", email);
      else this.almacen.borrar("emailRecordado");

      location.href = "index.html";
    }
  }

  document.addEventListener("DOMContentLoaded", () => new PantallaLogin().iniciar());
})();
