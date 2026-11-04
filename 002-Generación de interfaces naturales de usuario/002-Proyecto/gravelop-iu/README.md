# gravelop-iu · unidad 2 · Interfaces naturales

Segunda entrega de la librería de interfaz de **Gravelop**. Parte de la versión entregada en la unidad 1 (`001-Generación de interfaces de usuario/002-Proyecto/gravelop-iu`, primer commit de esta carpeta) y le añade **interfaces naturales**: hablar con un modelo de IA local, dictar con la voz, escuchar las respuestas y manejar el panel sin teclado ni ratón.

La unidad 1 se queda tal cual, como su propia entrega. Aquí solo crece la copia.

## Qué hay de nuevo

Todo lo nuevo de esta unidad está en archivos aparte. Así se ve de un vistazo qué se ha añadido sobre la unidad 1:

```
gravelop-iu/
├── ollama.php                    NUEVO · puente entre el navegador y Ollama
├── js/gravelop-iu-natural.js     NUEVO · MarkdownIU, VozIU, AsistenteIU y ComandosVozIU
├── css/gravelop-iu-natural.css   NUEVO · asistente, burbujas, Markdown e indicador de voz
├── index.html                    + botones «✦ Asistente» y «🎙 Manos libres» en la cabecera
└── js/panel.js                   + contexto para la IA, órdenes de voz y tarjetas en el catálogo
```

| Interfaz natural | Tecnología | Qué hace en el panel |
|---|---|---|
| Lenguaje natural | Modelo local **qwen2.5:1.5b** con Ollama, a través de `ollama.php` | Le preguntas en español y responde en Markdown. **Ve los datos de la pantalla** en la que estás, así que puede contestar «¿qué clientes no tienen web?» o resumir las facturas pendientes |
| Voz a texto | Web Speech API · `SpeechRecognition` | Botón 🎤 para dictar al asistente, y modo **manos libres** para dar órdenes al panel |
| Texto a voz | Web Speech API · `SpeechSynthesis` | Interruptor «Leer respuestas en voz alta» |

### Componentes nuevos de la librería

| Clase | Qué hace |
|---|---|
| `MarkdownIU` | Convierte la respuesta del modelo en HTML: títulos, listas, negrita, código y tablas. **Escapa todo antes de convertir**, así que el modelo nunca puede inyectar HTML ni scripts. Quita el bloque ` ```markdown ` en el que los modelos pequeños a veces envuelven toda la respuesta. `aTexto()` deja el texto limpio para leerlo en voz alta |
| `VozIU` | Encapsula la Web Speech API. `escuchar({ continuo, alParcial, alFinal, alError, alTerminar })` va enseñando lo que entiende mientras hablas. `hablar(texto)` elige una voz en español si el sistema la tiene. `puedeEscuchar` y `puedeHablar` dicen qué permite el navegador, y `mensajeError()` traduce los errores a frases que se entienden |
| `AsistenteIU` | Ventana flotante de conversación: se arrastra desde la barra, se minimiza, cambia de tamaño desde la esquina y **recuerda dónde la dejaste**. Mantiene el historial (las 6 últimas intervenciones viajan al modelo), deja **cancelar** una respuesta que tarda (`AbortController`), muestra cuánto ha tardado y ofrece sugerencias para empezar |
| `ComandosVozIU` | **Manos libres.** Escucha de forma continua y compara lo que dices con las frases de cada orden. Gana la frase más larga que encaje («nuevo cliente» antes que «nuevo») y lo que sobra se pasa a la acción («filtrar vencida» → filtra por «vencida»). Si no entiende la orden, ofrece mandársela al asistente. Chrome corta la escucha continua cada cierto tiempo, así que se vuelve a poner a escuchar solo mientras siga activo |

### Órdenes de voz

Activa el micrófono con 🎙 o con la tecla `M`, y di «parar» para terminar. Con la orden «ayuda» se ve la lista completa dentro del panel.

| Di… | Hace |
|---|---|
| «ir a facturas», «abre clientes», «muestra proyectos» | Cambia de vista |
| «nuevo cliente», «nueva factura», «nuevo» | Abre el formulario |
| «filtrar vencida», «busca Valencia» | Filtra la tabla actual |
| «quitar filtro» | Quita el filtro |
| «guardar» | Guarda el formulario abierto (con la validación de siempre) |
| «cerrar», «cancelar» | Cierra el modal, el panel lateral, la paleta o el asistente |
| «exportar» | Descarga la tabla en CSV |
| «tema oscuro», «modo claro» | Cambia el tema |
| «pregunta cuánto llevamos facturado» | Manda la pregunta al asistente |

Decisión de diseño: con el asistente abierto, los avisos (toasts) pasan arriba a la derecha (`body:has(.iu-asistente.abierto)`), porque abajo quedarían tapados por la ventana.

### Qué ve el asistente

`contextoParaIA()` (en `js/panel.js`) le pasa al modelo los datos en texto compacto: primero la vista abierta, con el filtro aplicado, y después el resto de tablas. Las claves ajenas ya van resueltas, con el nombre del cliente o del proyecto en lugar del número, para que un modelo tan pequeño no tenga que cruzar tablas. `ollama.php` añade unas instrucciones de sistema: responder en español, de forma breve, en Markdown y **sin inventar datos que no estén ahí**.

## Comparación con la versión del profesor (004)

| | Profesor (mavr 004) | gravelop-iu ud2 |
|---|---|---|
| Modelo | `phi3:mini` | `qwen2.5:1.5b`, más ligero, porque mi equipo no tiene tarjeta gráfica |
| Puente PHP | `curl` | `file_get_contents` con contexto HTTP: mi PHP no tiene curl y así no hay que instalar nada |
| Datos | El modelo no sabe qué hay en el panel | Recibe los datos de la pantalla y responde sobre ellos |
| Conversación | Cada pregunta va suelta | Historial, cancelar, tiempo de respuesta y sugerencias |
| Voz | Dictado y lectura en voz alta | Lo mismo, y además **manos libres**: órdenes habladas que manejan todo el panel |
| Dónde sale la respuesta | En el escenario, sustituyendo la vista | En la ventana del asistente, sin perder lo que estabas viendo |

## Puesta en marcha

Necesita PHP para `ollama.php`. En mi equipo lo sirve Apache, a través de un enlace simbólico:

```bash
ln -s "$PWD" /var/www/html/gravelop-iu-ud2
```

Abrir **http://localhost/gravelop-iu-ud2/**. También vale `php -S localhost:8000` desde esta carpeta.

1. Ollama en marcha con el modelo descargado: `ollama pull qwen2.5:1.5b`.
2. **Google Chrome** para la voz. Firefox no tiene `SpeechRecognition`: en Firefox los botones 🎤 y 🎙 aparecen desactivados con un aviso que explica por qué, y el resto del panel funciona. La lectura en voz alta sí funciona en Firefox.
3. El micrófono solo funciona en `localhost` o con HTTPS, y el navegador pide permiso la primera vez.

Para cambiar de modelo, edita la constante `MODELO` al principio de `ollama.php`.

## Incidencias reales

1. **PHP sin curl.** El puente del profesor usa `curl`, que no está instalado en mi PHP. Se ha resuelto con `file_get_contents` y `stream_context_create`, que ya vienen con PHP. Con `ignore_errors` se puede leer el mensaje de error de Ollama en lugar de recibir solo `false`.
2. **Firefox no reconoce la voz.** No es un fallo del código: Firefox no implementa `SpeechRecognition`. La librería lo detecta (`VozIU.puedeEscuchar`), desactiva los botones y explica el motivo, en vez de fallar al pulsarlos.
3. **Dos versiones a la vez.** La unidad 1 tiene que seguir funcionando tal como se entregó, así que cada versión tiene su propia carpeta y su propio enlace en Apache (`/gravelop-iu` y `/gravelop-iu-ud2`).
