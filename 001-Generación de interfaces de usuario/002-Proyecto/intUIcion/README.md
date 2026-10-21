# intUIción

Mi librería de interfaz de usuario para el proyecto final de la unidad 1 de Desarrollo de interfaces. El profesor hace la suya, **jocarsa-iu**, y cada alumno tiene que hacer la propia con su diseño.

**La idea:** el nombre mezcla *intuición* y *UI*, y es también el criterio de diseño. jocarsa-iu enseña componentes. intUIción usa esos mismos componentes para **guiar al usuario y que no tenga que pensar**:

- Todo se puede hacer con el teclado: hay atajos y una paleta de comandos (`Ctrl + K`).
- Los formularios avisan mientras escribes, no cuando ya has pulsado Guardar.
- Lo que se borra se puede deshacer, y no se pierden cambios sin preguntar.
- La interfaz recuerda cómo la dejaste: vista, tema, ancho de las columnas y orden de las tablas.

La aplicación de ejemplo es la interfaz de **REDKYBER**, el ERP de fabricación de aeronaves que hago en Sistemas de gestión empresarial, con sus datos reales.

## Puesta en marcha

Usa `fetch()` para leer los JSON, así que hay que servirla por HTTP:

```bash
cd intUIcion
python3 -m http.server 8000
```

Abrir `http://localhost:8000/login.html`. El acceso es simulado: vale cualquier email válido con una contraseña de 6 caracteres o más. También se puede entrar directamente en `index.html`.

## Estructura

```
intUIcion/
├── index.html                  aplicación REDKYBER
├── login.html                  pantalla de acceso
├── css/intuicion.css           la librería: propiedades (variables) + componentes .iu-*
├── js/intuicion.js             la librería: clases en el namespace intuicion.iu
├── js/redkyber.js              la aplicación que usa la librería
├── js/login.js                 lógica del login
├── data/modulos.json           menú: módulos y vistas de cada módulo
├── data/<entidad>.json         clientes, pedidos, productos, componentes, proveedores, empleados
├── herramientas/importar_redkyber.py   genera los JSON desde la base de datos de REDKYBER
└── img/logo.svg
```

## Punto de partida

La base es `006-jocarsa-ui-modal-drawer`, el último proyecto del profesor en la subunidad 009 (Clases, propiedades, métodos). Está en el primer commit del proyecto, sin tocar, para que se vea qué había antes y qué he cambiado.

| | jocarsa-ui-modal-drawer (base) | intUIción |
|---|---|---|
| Namespace | `jocarsa.iu` | `intuicion.iu` (clases en `js/intuicion.js`, aplicación aparte en `js/redkyber.js`) |
| Datos | clientes de ejemplo (2 registros) | REDKYBER: 6 entidades y 57 registros importados de mi ERP |
| Navegación | menú y fichas independientes | jerárquica: el módulo carga sus vistas, con migas de pan y vuelta a la última vista de cada módulo |
| Tabla | listado con buscador y total | ordenación por columna (asc/desc/sin orden), filtro que resalta coincidencias, formato de moneda/fecha/número, insignias de estado, sumas en el pie, estado vacío, navegación con flechas, Enter y Supr |
| Formulario | generado desde JSON | además, validación en vivo (obligatorio, email, longitud mínima, mínimo numérico, patrón), claves ajenas como desplegable con el nombre y sugerencias con `datalist` |
| Panel lateral | crear / editar, redimensionable | además, eliminar, avisa si cierras con cambios sin guardar, guarda con `Ctrl + Enter`, recuerda el ancho y el foco no se sale del panel |
| Modal | abrir / cerrar | devuelve una promesa con la respuesta (`await modal.confirmar(...)`), el foco no se sale y vuelve a donde estaba al cerrar |
| Toasts | 4 tipos, cierre a los 5 s | botón de acción (Deshacer), barra de tiempo que se pausa con el ratón, no tapan el panel lateral |
| Borrado | no había | eliminar con deshacer; si hay registros que dependen de él (p. ej. pedidos de un cliente), pide confirmación |
| Teclado | Escape | paleta de comandos con búsqueda difusa (también busca registros), atajos `N`, `/`, `T`, `[`, `?`, `Alt+1…5`, separadores que se mueven con flechas |
| Aspecto | azul petróleo, esquinas achaflanadas | oscuro (con tema claro), 5 colores de acento, 3 densidades y radio de esquina regulable desde la vista Apariencia |
| Memoria | no | `localStorage`: datos, preferencias, columnas, orden de tablas y última vista |
| Exportar | no | CSV de las filas visibles, respetando el filtro y el orden |
| Resumen | no | panel con KPI y gráficas de barras. Cada elemento lleva a su detalle ya filtrado |
| Login | formulario estático | validación en vivo, mostrar/ocultar contraseña, aviso de mayúsculas activadas, recuerda el email |
| Responsive | parcial | por debajo de 900 px las columnas se contraen solas; en móvil, cabecera compacta y panel lateral a pantalla completa |

## Componentes de la librería

Todas las clases están en `js/intuicion.js` y se exportan en `window.intuicion.iu`:

| Clase | Qué hace |
|---|---|
| `DOM` | `uno`, `todos`, `crear(etiqueta, atributos, contenido)` y `atraparFoco` |
| `Utilidades` | escapar HTML, normalizar quitando tildes, búsqueda difusa y resaltado |
| `Formato` | moneda, número y fecha en `es-ES` con `Intl` |
| `Almacen` | `localStorage` con prefijo y protegido con `try/catch` (si el navegador lo bloquea, la app sigue funcionando) |
| `PreferenciasIU` | tema, acento, densidad y radio. Escribe en las variables CSS y lanza el evento `iu:preferencias` |
| `ToastIU` | `mostrar({ tipo, titulo, texto, accion, duracion })` y los atajos `ok`, `info`, `aviso` y `error` |
| `ModalIU` | `abrir(...)` y `confirmar(...)`, que devuelven una promesa |
| `DrawerIU` | `abrir({ modo, titulo, contenido, pie, antesDeCerrar })`, `solicitarCierre()` y redimensión |
| `ValidadorIU` | `mensaje(campo, valor)`, con mensajes que dicen cómo arreglar el error |
| `FormularioIU` | construye el formulario desde la definición JSON y ofrece `validar()` y `leer()` |
| `TablaIU` | ordena, filtra, resalta, suma y muestra el estado vacío |
| `AtajosIU` | `registrar(combinacion, descripcion, accion)`; no salta mientras escribes en un campo salvo que el atajo sea global |
| `PaletaComandosIU` | lista de comandos que filtra con búsqueda difusa y se maneja con flechas, Enter y Esc |
| `GestorColumnasIU` | minimizar y redimensionar las columnas con el ratón o el teclado, y guardar cómo quedan |

A diferencia de la base, el modal, el panel lateral, los toasts y la paleta **crean su propio HTML**. Basta con instanciarlos, sin copiar su marcado en cada página.

### Propiedades (variables CSS)

Todo el aspecto sale de las variables de `:root` en `css/intuicion.css`:

- `--acento-h`: el tono del color de acento.
- `--radio`: el radio de las esquinas.
- `--esp` y `--alto-control`: la densidad.
- `--fondo`, `--panel`, `--texto`…: el tema.

El tema claro y las densidades redefinen esas mismas variables con `[data-tema="claro"]` y `[data-densidad="compacta"]`. La vista *Librería → Apariencia* las cambia en vivo.

### Formato de los orígenes de datos

Cada `data/<entidad>.json` describe la entidad completa, no solo los datos:

```json
{
  "entidad": "pedidos",
  "titulo": "Pedidos",
  "columnas": [{ "campo": "total", "etiqueta": "Total", "formato": "moneda", "sumar": true }],
  "campos":   [{ "nombre": "cliente_id", "etiqueta": "Cliente", "tipo": "referencia", "entidad": "clientes", "mostrar": "nombre", "requerido": true }],
  "registros": [ ... ]
}
```

`columnas` dice qué se ve en la tabla y con qué formato: `moneda`, `fecha`, `numero`, `stock`, `estado`, `etiqueta`, `referencia`, `mono` o `email`. `campos` dice cómo se genera el formulario y qué se valida. Para regenerar los JSON desde REDKYBER:

```bash
python3 herramientas/importar_redkyber.py ../../../../2do-DAM-Sistemas-de-gestion-empresarial/003-Organización\ y\ consulta\ de\ la\ información/002-Proyecto/REDKYBER/data/demo.sql
```

## Atajos de teclado

| Atajo | Acción |
|---|---|
| `Ctrl + K` | Paleta de comandos (ir a vistas, crear, acciones y buscar registros) |
| `N` | Nuevo registro en la vista actual |
| `/` | Filtrar la tabla |
| `T` | Tema claro / oscuro |
| `[` | Contraer o expandir los menús |
| `?` | Ver todos los atajos |
| `Alt + 1…5` | Cambiar de módulo |
| `Ctrl + Enter` | Guardar el formulario abierto |
| `Esc` | Cerrar el panel, el modal o la paleta, o limpiar el filtro |
| `↑ ↓`, `Enter`, `Supr` | Moverse por las filas, editar y eliminar |

## Incidencias reales durante el desarrollo

Probado en el navegador a 1440×860 y en móvil (375×812). Estos problemas salieron en las pruebas y así se resolvieron:

1. **Un toast tapaba el botón Crear del panel lateral.** Si al guardar había errores, el aviso aparecía justo encima del botón, y el siguiente clic caía en el aviso en vez de en Crear. Ahora, con el panel abierto, el body lleva la clase `iu-con-drawer` y los toasts suben por encima del pie del panel.
2. **La paleta perdía las primeras letras.** El foco llegaba al cuadro de búsqueda en el fotograma siguiente (`requestAnimationFrame`), así que lo que se tecleaba justo después de `Ctrl + K` se perdía. Ahora el foco se pone al instante.
3. **El foco parecía un error.** Con el acento rojo, un campo enfocado tenía el mismo borde rojo que un campo con error. Ahora el foco de los campos es neutro y el rojo queda solo para los errores.
4. **El icono ◐ no existe en la fuente** y salía como «‹». Se ha cambiado por un SVG en la cabecera y por «Aa» en el menú.
5. **Barra de scroll horizontal de 1 px en la tabla.** La causa era el texto oculto para lectores de pantalla de la última columna. Se ha solucionado con la técnica estándar (`margin: -1px`).
6. **Las barras de las gráficas no tenían ancho.** Eran `<span>`, y los elementos en línea ignoran `width`. Ahora llevan `display: block`.
7. **«En fabricación» salía en rojo**, como si fuera un error. Ahora tiene su propio color (violeta, `--proceso`).
8. **Caché del navegador:** `python3 -m http.server` no impide que el navegador guarde el CSS y el JS. Durante el desarrollo hay que recargar sin caché (`Ctrl + Shift + R`) para ver los cambios.

## Uso de IA

Siguiendo la norma de la asignatura: la base es el código del profesor (primer commit). El nombre, la idea de diseño, la temática REDKYBER y el estilo oscuro son decisiones mías. La reescritura y la ampliación de la librería, las pruebas en el navegador y este README se han hecho **con ayuda de IA (Claude)**. Cada incremento está en su propio commit.
