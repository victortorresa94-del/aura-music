# Auditoría — agosto de 2026

Dos paneles revisaron la app: nueve revisores de interfaz (UI ex-Apple, UX
ex-Spotify, artesanía ex-Linear, color ex-Stripe, neurociencia ex-Netflix, QA
ex-Anthropic, movimiento y sonido ex-Apple, accesibilidad ex-OpenAI, estrategia
ex-Things) y cinco de neurodiseño (Cialdini, Kahneman, Dooley, Weinschenk, Zak).

52 hallazgos. Esto es la lista de trabajo que sale de ellos, ordenada por lo que
más daño hace.

> **Nota**: la skill `ui-ux-app-elite-team` está sincronizada incompleta en este
> entorno — solo tiene `SKILL.md`, faltan los nueve perfiles de expertos y las
> tres bibliotecas de referencia. El panel se ejecutó con canon verificable de
> cada disciplina en su lugar, y así queda dicho. **Conviene volver a
> sincronizarla**: el valor está en esos doce ficheros.

---

## Arreglado ya (16 de agosto)

- 🔴 **La segunda toma caía detrás en vez de encima.** El motor dejaba el cursor
  al final de la toma, así que el botón rojo grababa a continuación. Cuatro de
  los nueve revisores lo señalaron por separado. Era el gesto por el que existe
  la app.
- 🔴 **El audio podía perderse en silencio.** Se escribía sin esperar ni capturar
  el error, así que había una ventana en la que la pista existía sin su audio; si
  la app moría ahí, el recolector de basura acababa borrando la toma.
- 🔴 **Safari borraba todo a los siete días.** Faltaba pedir almacenamiento
  persistente. El escenario "vuelvo a aquella idea dentro de tres semanas" era
  justo el escenario en el que ya no estaba.
- 🔴 **Una llamada entrante se llevaba el último medio segundo.** Ahora se vuelca
  a disco al ocultarse la página.
- 🔴 **La onda se dibujaba sin normalizar.** Una guitarra a medio metro entra
  sobre −20 dBFS: se dibujaba en tres píxeles y la pista parecía vacía.
- 🔴 **La toma no sonaba sola.** Toda la ingeniería de compensación de latencia
  existe para el momento en que la segunda capa encaja con la primera, y había
  que ir a buscarlo con dos toques.
- 🔴 **El atajo "Grabar una idea" chocaba con la intro** y dejaba una pista
  fantasma en el primer uso de quien acababa de instalar la app.
- 🟡 **Tempo y tonalidad al soltar el botón**, con la lectura flamenca cuando la
  hay.
- 🟡 "1 pistas".

---

## Fase 1 · Lo que queda de crítico

### No perder nada, y que se note
- Borrar una idea entera es **un toque, sin confirmar y sin deshacer**, mientras
  que borrar una pista pide dos pasos. La asimetría está del revés, y el daño de
  esta es permanente (WCAG 2.2 SC 3.3.4).
- Nada dice nunca que está guardado. El silencio no es confianza, es
  incertidumbre. En la cabecera: *Guardado en este móvil · 2 pistas*.
- Guardado parcial durante la toma, cada ~5 s. Entonces se puede decir la frase
  que más confianza puede generar este producto en toda su vida: *"Se cortó la
  grabación. Guardé lo que llevabas: 34 s."*
- Cablear el estado `interrupted` de iOS a un "parar y guardar".
- Al cargar, marcar la pista huérfana en vez de fingir que está.

### La primera pantalla
- La intro manda **dos deberes** (ponte los cascos, calibra la latencia) antes de
  la promesa. Activa el pensamiento deliberado antes del primer segundo de
  placer. Que la promesa y la privacidad vayan primero, y los cascos aparezcan
  al empezar la **segunda** toma, que es cuando importan.
- **Claqueta a cero en la primera toma.** No hay nada con lo que cuadrar: son 2,5
  segundos de espera que descartan lo que toques por instinto.
- Encuadrar el permiso del micrófono: *"Voy a pedirte el micro. El audio se queda
  en este móvil."* Es el momento de máxima desconfianza y hoy llega a pelo.
- Los tres pasos de la bienvenida salen **sin numerar**: el Preflight de Tailwind
  quita los marcadores de `<ol>`.
- El estado vacío abre con *"Aquí no hay nada todavía"* — encuadre de ausencia.
  Y la flecha punteada muere a media pantalla, a 400 px del botón: señala al
  vacío.

### Manos y ojos
- **Objetivos táctiles por debajo del mínimo**: M/S 24×22, tiradores de recorte
  20 px de ancho, papelera de proyecto 28 px, botón de BPM ~21 px de alto. El
  mínimo de la norma son 24×24 y el de Apple 44×44.
- **Contrastes por debajo de AA, y la auditoría escrita en `theme.ts` es
  incorrecta.** Medidos de nuevo: `faint` da 3,11–3,69:1 según superficie (es el
  color de la mitad del texto de la app); el rojo como texto da 4,10:1, no 4,9
  como dice el comentario. El clip contra su carril da **1,19:1** y su borde
  1,36:1 — el objeto central del producto casi no se distingue del fondo.
  **Arreglo de fondo: un script que calcule los contrastes y rompa el build.**
- El sistema "ámbar = IA" **no existe**: `--daw-clip-ai` está a 1,02:1 del clip
  normal. Son el mismo color con otro nombre.
- La rejilla de compases está a 1,10:1: invisible, y "pegar al pulso" promete una
  referencia que el ojo no puede usar.
- Dos cuadrados de "parar" a la vez mientras grabas, con la misma consecuencia.
- 55–70 % de la pantalla vacía con pocas pistas, porque la altura de fila es
  fija. Con una pista, esa pista debería ocupar media pantalla.

---

## Fase 2 · Lo que decide que vuelvas

- Todas las ideas nacen llamándose **"Idea nueva"**. Mañana hay cinco iguales y
  sin escucharlas no sabes cuál es cuál. Pedir el nombre después de la primera
  toma: tres segundos, voluntario, y de paso es el compromiso que convierte la
  idea en tuya.
- La biblioteca vive en el **octavo campo de Ajustes**. El motivo para volver
  está escondido detrás de la prueba de sonido, el tema y las instrucciones de
  instalación.
- Empezar una idea nueva cuesta **cinco toques y un scroll**. El rival son las
  Notas de Voz: abrir y botón rojo, siempre a una grabación limpia.
- Ajustes es un cajón con nueve temas sin relación, y el **primer campo es un
  volcado de diagnóstico técnico**. Partirlo en Ideas / Compartir / Ajustes, y
  esconder el diagnóstico detrás de cinco toques.
- La app abre en el proyecto de ayer, así que el impulso de capturar algo nuevo
  aterriza dentro de otra canción.

---

## Fase 3 · El diferenciador no llega a la pantalla

- **La regla cuenta compases de cuatro y la claqueta cuenta cuatro**, aunque
  tengas armada una bulería de doce. La app tiene la gramática del compás en el
  motor y la contradice en su propia regla. Ambas tienen 4/4 escrito como
  constante.
- El doce **se explica con un párrafo** dentro de un panel, en vez de dibujarse.
  Doce puntos, los acentos más grandes, girando con el tempo: eso es la portada
  del producto y lo que hace que un flamenco lo entienda sin leer.
- La barra de estado dice "100 BPM · SIN CALIBRAR" y nunca el palo. Debería decir
  *Bulerías · 12 · 92 bpm*.
- **La hoja de Ritmos tapa el transporte**, así que eliges el palo, cierras,
  rebobinas y grabas. La definición de hecho del bloque dice literalmente "sin
  salir ni buscar nada".
- El ritmo que estás oyendo **no entra en la mezcla exportada** si no lo has
  pasado a pista. El aviso está en una nota que nadie lee. Te enteras cuando ya
  se lo has mandado a la banda.

---

## Transversal

- **La háptica no existe en iOS.** Safari nunca ha implementado la API de
  vibración: las quince llamadas a `haptic()` no hacen nada en el móvil de
  Víctor. O se usa el truco del interruptor de iOS 17.4+, o se acepta que en iOS
  el canal es el sonido y se diseña. Hoy están las dos a medias.
- **El producto no tiene sonido propio.** Solo suena el click. En una herramienta
  que se usa con los ojos en el instrumento, el sonido no es adorno: es la
  interfaz. Tres tonos generados con osciladores —entrada, toma cerrada, error—,
  peso cero, apagables.
- El vúmetro mide **52 × 3 píxeles**. El aro del botón rojo, que ya es lo más
  grande de la pantalla, debería hacer de vúmetro.
- El botón rojo **respira en bucle infinito** sin significar nada. Un latido
  perpetuo se convierte en ruido y entrena a ignorar esa zona.
- Las hojas **no se cierran arrastrando** aunque pintan el asidero que lo
  promete, no mueven el foco, no lo atrapan y no escuchan Escape.
- La línea de tiempo es **invisible para un lector de pantalla**: los clips son
  divs sin rol ni nombre. Se puede grabar pero no saber qué has grabado.
- **Recortar solo se puede arrastrando** (incumple SC 2.5.7): con temblor o con
  una sola mano no hay alternativa.
- `exportStems` lanza N descargas seguidas y **Safari en iOS solo permite la
  primera**. Está roto justo en el navegador donde tiene que funcionar.
- Cuatro bucles de animación permanentes que no comprueban si la página está
  oculta ni si el transporte está parado.
- Tres negros distintos en el mismo producto, y destello sin estilo al abrir en
  frío porque los tokens de color no tienen valor de reserva.
- Tres formas distintas de repetir algo (×N, vueltas, duplicar) en una app cuyo
  argumento es que no tiene veinte mil trillones de cosas.

---

## Lo que el panel dijo que está bien y no hay que tocar

Vale la pena tenerlo escrito, porque en una lista de 52 problemas se olvida:

- La compensación de latencia a la muestra, la cola de 600 ms al cerrar la toma,
  el desbloqueo de audio en `pointerup`, el troceado del canvas a 1600 px, el
  bloqueo de parada reentrante y el estado de audio fuera de React. **Nada de eso
  se hace sin haber sufrido un iPhone real.**
- El botón rojo: tamaño, forma que muta con el estado, y único elemento con
  color en la pantalla.
- El copy. Habla como un músico y es honesto donde el sistema duda: *"pasa mucho
  con la bulería, que a 200 se parece igual a 100"*.
- El panel de ritmos como "un músico al que le dices dos cosas" en vez de un
  secuenciador de rejilla.
- Deshacer con 30 pasos, y el aviso de toma en silencio cuando el pico no llega.
- Sin cuenta, sin servidor, offline, instalable. Es la mejor promesa de confianza
  que tiene el producto — y hoy no se la cuenta a nadie.

> El veredicto del panel, textual: los 52 hallazgos son casi todos **de
> superficie y de flujo, no de fundamento**. Y esa es la buena noticia, porque la
> superficie se arregla en semanas y el fundamento no.

---

## La política de enganche, escrita para poder decir que no

El encargo era que la app fuese "casi adictiva". La respuesta del panel de
neurodiseño fue que no le hace falta ninguna mecánica de adicción, y que las que
existen le harían daño a este producto en concreto.

El disparador de un músico **no es la ambición creativa, es el miedo a perder la
idea** — y perder pesa alrededor del doble que ganar. Eso significa que todo lo
que se interponga entre el icono y la captura compite contra la propia ansiedad
que abrió la app.

La frase que resume la política: **la app no tiene que hacer que vuelvas. Tiene
que hacer que no pierdas.** El que vuelve eres tú, empujado por la idea; el
trabajo de la app es ser el sitio más rápido y más seguro donde ponerla.

Lo que se rechaza y con qué se sustituye está en `ROADMAP.md`, sección 6.
