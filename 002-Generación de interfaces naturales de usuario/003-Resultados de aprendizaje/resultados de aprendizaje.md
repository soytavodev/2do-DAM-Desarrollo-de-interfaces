# Resultado de aprendizaje 2

## Resultado de aprendizaje

Genera interfaces naturales de usuario utilizando herramientas visuales.

## Criterios de evaluación

### a) Se han identificado las herramientas disponibles para el aprendizaje automático relacionadas con las interfaces de usuario.

He trabajado con tres familias de herramientas:

- **Modelos de lenguaje que se ejecutan en local con Ollama.** Uso qwen2.5:1.5b en lugar del phi3:mini de clase porque mi equipo no tiene tarjeta gráfica y un modelo de 1,5 mil millones de parámetros responde en un tiempo razonable usando solo la CPU.
- **La Web Speech API del navegador** para reconocer la voz (SpeechRecognition) y sintetizarla (SpeechSynthesis). Comprobé que Firefox solo implementa la síntesis y que el reconocimiento necesita Chrome.
- **MediaPipe (tasks-vision)** para detectar la cara, sus puntos, la malla y las manos con la cámara, y **A-Frame** para escenas 3D en el navegador.

Están en los ejercicios de 004-Partes y movimientos del cuerpo y 005-Realidad aumentada, y en el proyecto (ollama.php y js/gravelop-iu-natural.js).

### b) Se ha creado una interfaz natural de usuario utilizando las herramientas disponibles.

En mi proyecto he ampliado gravelop-iu, la librería de interfaz de mi marca Gravelop, con un módulo de interfaces naturales (js/gravelop-iu-natural.js y css/gravelop-iu-natural.css) y lo he integrado en el panel interno de Gravelop:

- **Un asistente flotante** que se arrastra, se minimiza, cambia de tamaño y recuerda su posición.
- **Conversación en lenguaje natural con el modelo local**, a través de ollama.php. El asistente recibe los datos de la pantalla en la que está el usuario, así que puede responder «¿qué clientes no tienen web?» o resumir las facturas pendientes sin inventar datos.
- **Respuestas en Markdown** convertidas a HTML por la clase MarkdownIU. Escapa todo el texto antes de convertirlo para que el modelo no pueda inyectar código.

La unidad 1 se conserva intacta como su propia entrega, y esta versión es una copia que crece.

### c) Se ha utilizado el reconocimiento de voz para implementar acciones en las interfaces naturales de usuario.

La clase VozIU encapsula el reconocimiento y la síntesis. Muestra lo que va entendiendo mientras hablas, detecta si el navegador lo permite y traduce los errores a mensajes claros. Hay dos formas de usar la voz:

- **Dictado:** con el botón del micrófono del asistente se dicta la pregunta, y la respuesta se puede escuchar con el interruptor «Leer respuestas en voz alta».
- **Manos libres:** la clase ComandosVozIU escucha de forma continua y convierte lo que dices en acciones del panel. Por ejemplo:
  - «ir a facturas»
  - «nuevo cliente»
  - «filtrar vencida»
  - «quitar filtro»
  - «guardar»
  - «cerrar»
  - «exportar»
  - «tema claro»
  - «pregunta cuánto llevamos facturado»

  Elige la frase más larga que encaja y pasa lo que sobra a la acción, como el texto del filtro. Si no reconoce la orden, ofrece mandársela al asistente.

En Firefox los botones de voz aparecen desactivados con un aviso, porque ese navegador no tiene reconocimiento.

### d) Se ha incorporado la detección del movimiento del cuerpo para implementar acciones en las interfaces naturales de usuario.

En los ejercicios de 004-Partes y movimientos del cuerpo, el movimiento de la cabeza controla la interfaz:

- En 004-spritesheet y 005-con suavizado, la orientación de la cabeza elige el fotograma de un personaje. El segundo suaviza la transición entre fotogramas.
- En 006-integrafo y en los avatares (007 a 010), el avatar sigue los movimientos de la cara mientras conversa con el modelo local. Estos ejercicios usan el mismo ollama.php que mi proyecto.

En 005-Realidad aumentada el movimiento de la mano sirve para desplazarse por la escena:

- 003-denso: avanzar y girar con gestos.
- 004-indice: señalar con el dedo índice.
- 005 y 006: control gradual de la velocidad.

### e) Se han integrado elementos de detección de partes del cuerpo para implementar acciones en las interfaces naturales de usuario.

Con MediaPipe he detectado partes concretas del cuerpo:

- **La cara**, con su recuadro y sus puntos clave (001-reconocimiento de cara).
- **Las articulaciones de los dedos** en tiempo real (002-manos).
- **La malla de la cara**, con cientos de puntos que siguen la expresión (003-malla de la cara).
- **Los puntos de la cara con Face Landmarker**, para animar el avatar (010-avatar-face-landmarker).

En 007-avatar-chatbot-lipsync el avatar además mueve la boca mientras habla.

Además he hecho un ejercicio propio, **011-comandos por gestos**. Con el reconocedor de gestos de MediaPipe (GestureRecognizer), cada gesto de la mano ejecuta una orden en un panel de Gravelop:

- ✋ mano abierta: siguiente vista.
- ☝️ índice: vista anterior.
- ✌️ dos dedos: cambiar el tema.
- 👍 pulgar arriba: crear un cliente o confirmar.
- 👎 pulgar abajo: cancelar.
- ✊ puño: pausar o reanudar las órdenes.

Para evitar órdenes por error, el gesto tiene que mantenerse 0,7 segundos (un anillo se va llenando), con una confianza mínima del 60 %. Entre orden y orden hay una espera, y para repetir la misma orden hay que bajar la mano o cambiar de gesto. La página dibuja la mano, dice qué gesto detecta y lleva un registro de las órdenes ejecutadas. Si no hay cámara, unos botones simulan cada gesto.

### f) Se ha integrado la realidad aumentada en los interfaces de usuario.

En 005-Realidad aumentada he usado A-Frame junto con la cámara:

- En 001-aframe, la cámara de la escena 3D sigue la cabeza del usuario y crea un efecto de ventana.
- En 002 y 003-denso, objetos a distintas profundidades hacen que se note el paralaje.
- En 007 y 008-ciudad se pasea por una ciudad combinando dos movimientos: la cabeza da la perspectiva y la mano el desplazamiento. La versión 008 genera la ciudad por código y le añade niebla.
