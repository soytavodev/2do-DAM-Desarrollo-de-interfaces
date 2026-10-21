# Resultado de aprendizaje 1

## Resultado de aprendizaje

Genera interfaces gráficos de usuario mediante editores visuales utilizando las funcionalidades del editor y adaptando el código generado.

## Criterios de evaluación

### a) Se han analizado las herramientas y librerías disponibles para la generación de interfaces gráficos.

En los ejercicios empecé por los componentes nativos de HTML, que son la librería que trae el navegador. En 002-Librerías de componentes nativas y multiplataforma hice componentes.html (cajas de texto, selección, botones), login.html y responsive.html (tarjetas con flex que pasan a una columna con @media). En 005-Componentes características y campo de aplicación repasé cada control y para qué sirve: botonYEnlace.html, inputs.html, numberRange.html, checkboxRadioYSelect.html, listas.html, tabla.html, contenedores.html, formulario.html y estado.html (disabled, checked y selected). En el proyecto partí de la librería del profesor, jocarsa-iu, y la analicé antes de cambiarla. Tiene clases para el modal, el panel lateral, los toasts y las columnas, pero el modal y el panel necesitan su HTML copiado en cada página y no hay validación ni teclado. A partir de ese análisis decidí cómo sería mi librería, intUIción: en el README del proyecto hay una tabla que compara las dos punto por punto.

### b) Se ha creado un interfaz gráfico utilizando las herramientas de un editor visual.

He creado la interfaz completa de REDKYBER, el ERP de aeronaves que hago en Sistemas de gestión empresarial: cabecera, menú de módulos, menú de vistas, escenario, panel lateral, modal, toasts y paleta de comandos (index.html), además de una pantalla de acceso (login.html). La interfaz no se dibuja a mano pantalla por pantalla: se describe. data/modulos.json define los módulos y sus vistas, y cada data/<entidad>.json define las columnas de la tabla y los campos del formulario. Las clases de la librería generan la interfaz a partir de esas definiciones. Los datos son los reales de mi ERP, importados con herramientas/importar_redkyber.py: 6 entidades y 57 registros.

### c) Se han utilizado las funciones del editor para ubicar los componentes del interfaz.

La ubicación de los componentes se controla con CSS Grid y Flexbox en css/intuicion.css. La cabecera es una rejilla de tres zonas (marca, herramientas y usuario) y el cuerpo es una fila flex con dos columnas y el escenario. Las columnas se pueden contraer y redimensionar arrastrando el separador o, con el foco en él, con las flechas del teclado. El tamaño queda guardado. Los formularios usan una rejilla de dos columnas, y en el panel lateral pasan a una sola cuando es estrecho (menos de 560 px). Por debajo de 900 px las columnas se contraen solas y en móvil la cabecera se compacta y el panel lateral ocupa toda la pantalla. Lo he probado en el navegador a 1440×860 y a 375×812. Esto continúa lo que hice en responsive.html con @media.

### d) Se han modificado las propiedades de los componentes para adecuarlas a las necesidades de la aplicación.

Todo el aspecto de intUIción depende de propiedades: variables CSS en :root como --acento-h, --radio, --esp, --alto-control, --fondo o --texto. El tema claro y las densidades compacta y amplia redefinen esas mismas variables. La vista Librería → Apariencia las cambia en vivo mediante la clase PreferenciasIU (color de acento, tema, densidad y radio de las esquinas) y las guarda en el navegador. Los componentes también se configuran con propiedades en JavaScript, por ejemplo toast.mostrar({ tipo, titulo, texto, accion, duracion }) o drawer.abrir({ modo, titulo, contenido, pie, antesDeCerrar }), y los campos del formulario con requerido, min, minimo, patron, ayuda o sugerencias. Algunas propiedades las cambié tras probar la aplicación, por necesidades reales: el foco de los campos dejó de ser rojo porque se confundía con un error, y el estado «En fabricación» tiene ahora su propio color (--proceso).

### e) Se ha analizado el código generado por el editor visual.

Analicé el código del proyecto base del profesor (006-jocarsa-ui-modal-drawer), que está en el primer commit de mi proyecto. Vi que el JavaScript estaba organizado en clases dentro del namespace jocarsa.iu, que el CSS se había ido ampliando por versiones (V3 a V7) con reglas que se sobrescriben entre sí, y que el modal y el panel lateral dependían de un HTML fijo en index.html. En el ejercicio MVC.html (001-Patrones de arquitectura) ya había visto cómo separar el modelo, la vista y el controlador, y lo apliqué al reorganizar el proyecto. Mientras probaba también inspeccioné el código generado en el navegador. Así encontré, por ejemplo, que el texto oculto para lectores de pantalla provocaba 1 px de scroll horizontal en la tabla, y que las barras de las gráficas no tenían ancho porque eran elementos en línea. Está todo documentado en el README, en «Incidencias reales».

### f) Se ha modificado el código generado por el editor visual.

Reescribí el código base y lo separé en dos partes. js/intuicion.js es la librería, con el namespace intuicion.iu y 15 clases: DOM, Utilidades, Formato, Almacen, OrigenDatos, PreferenciasIU, ToastIU, ModalIU, DrawerIU, ValidadorIU, FormularioIU, TablaIU, AtajosIU, PaletaComandosIU y GestorColumnasIU. js/redkyber.js es la aplicación que la usa. El CSS (css/intuicion.css) también es nuevo: un único sistema de variables, sin reglas que se pisen. Además de cambiar el diseño amplié la funcionalidad:

- El modal, el panel lateral, los toasts y la paleta crean su propio HTML.
- El modal devuelve una promesa con la respuesta.
- El panel lateral pregunta antes de cerrar si hay cambios sin guardar.
- Las tablas se ordenan, resaltan el filtro y suman los totales.
- Al borrar se puede deshacer.
- Todo se recuerda con localStorage.

Los cambios están en commits separados, uno por incremento.

### g) Se han asociado a los eventos las acciones correspondientes.

En los ejercicios vi los eventos desde el principio: eventos.html (onclick en el HTML), MVC.html (addEventListener sobre el botón), ejecucionAsincrona.html y las carpetas «El orden importa» y «Descarga y ejecucion», donde se ve cuándo se ejecuta el script respecto a la carga de la página. En intUIción los eventos son el centro del diseño:

- **Teclado:** atajos registrados con AtajosIU (Ctrl+K paleta, N nuevo, / filtrar, T tema, [ columnas, ? ayuda, Alt+1…5 módulos), Ctrl+Enter para guardar, Escape para cerrar o limpiar el filtro, flechas, Enter y Supr en la tabla.
- **Formularios:** input y blur para validar en vivo, y submit.
- **Ratón y puntero:** click en filas, tarjetas y barras; pointerdown, pointermove y pointerup para redimensionar columnas y el panel; dblclick para recuperar el ancho por defecto.
- **Arrastrar y soltar:** dragstart, dragover y drop para abrir una vista soltándola en el escenario.
- **Animaciones:** animationend para cerrar el toast cuando termina su barra de tiempo (se pausa al pasar el ratón).
- **Otros:** matchMedia change para contraer las columnas en pantallas estrechas, y un evento propio, iu:preferencias, cuando cambia la apariencia.
- **Login:** el estado de Bloq Mayús (getModifierState) para avisar de que las mayúsculas están activadas.

### h) Se ha desarrollado una aplicación que incluye el interfaz gráfico obtenido.

La aplicación es REDKYBER sobre intUIción. Se arranca con python3 -m http.server dentro de 002-Proyecto/intUIcion y tiene:

- Un panel de Resumen con KPI y gráficas de barras que llevan al detalle ya filtrado.
- La gestión completa de pedidos, aerolíneas, aeronaves, componentes, proveedores y empleados: crear, editar y eliminar con deshacer. Si un registro tiene dependientes, como los pedidos de un cliente, pide confirmación antes de borrarlo.
- Exportación a CSV de las filas visibles.
- Un catálogo vivo de los componentes de la librería.
- La vista Apariencia y la vista de atajos de teclado.
- El login con validación en vivo.

La he probado de verdad en el navegador: crear un pedido con errores y corregirlo, borrar y deshacer, cerrar con cambios sin guardar, buscar «iber» en la paleta y abrir la ficha de Iberia, tema claro y vista móvil. Los fallos que salieron en esas pruebas y cómo los resolví están en el README.
