# Estudio — hoja de ruta

De aquí a tener la mejor herramienta del mundo para maquetar canciones.

Documento vivo. Doce semanas, cuatro fases, un entregable macro por fase que se
comprueba en un iPhone y no en una lista de tareas.

Escrito el 16 de agosto de 2026, después de barrer el mercado entero, las APIs
disponibles y de pasarle a la app un panel de nueve revisores de interfaz y otro
de cinco de neurodiseño. Lo que sale de ahí está en `investigacion/`.

---

## 1. La meta, y cómo se sabe si se ha cumplido

**La fricción de las Notas de Voz con el resultado de un DAW.**

Un toque para empezar a grabar. A los diez minutos, una maqueta de cuatro capas
cuadradas que se puede mandar por WhatsApp sin pedir perdón.

Las cinco cosas que hay que ganar, por orden de lo que decide si vuelves mañana:

| # | Qué | Estado hoy |
|---|---|---|
| 1 | Capturar sin fricción | Casi. Dos toques, y la intro manda deberes |
| 2 | Grabar encima sin desfase | **Hecho** y medido |
| 3 | Editar con los dedos | A medias. Falta bucle, regrabar un trozo, reordenar |
| 4 | Sonar mejor de lo que has tocado | Empezado. Ritmos sí, generación no |
| 5 | No perder nunca nada | **Recién arreglado**, hay que seguir siendo paranoicos |

---

## 2. Lo que enseñó el barrido, y que cambia el plan

Cuatro hallazgos que valen más que cualquier idea propia:

**Apple ya construyó esto y lo mató.** Music Memos (2016) escuchaba tu guitarra,
sacaba los acordes y te ponía bajo y batería. Lo retiraron el 1 de marzo de 2021
por falta de adopción. **Era técnicamente bueno y murió igual.** La lección no es
que el hueco no exista: es que **el hueco no se cierra con funciones**. Se cierra
con una razón para volver el día 90.

**Songzap es el listón y tiene un fallo de raíz.** Hace casi todo bien —cuatro
pistas, acompañamiento por IA, grabar sin cascos, exportar a DAW— por 3,99 $/mes.
Y su tempo **se congela con la primera grabación**: si tarareas una idea y luego
quieres ponerle batería, o adivinaste el BPM antes de cantar o estás vendido.
Además obliga a crear la canción (nombre, plantilla, claqueta, tempo) antes de
grabar una nota. Su propia reseña de tres estrellas lo dice: *"Every fiddly little
hoop we jump thru using your app interrupts the creative flow."*

Y aun así: 15 valoraciones en Estados Unidos. **Su problema no es el producto, es
que nadie sabe que existe.** iOS únicamente, 868 MB de descarga, cero presencia en
Reddit o en los rankings.

**BandLab perdió 1,43 estrellas en una sola versión** —de 4,19 a 2,76 sobre 20.650
reseñas— por meter anuncios al entrar al estudio y funciones antes gratis detrás
del muro. En esta categoría el usuario tolera pagar; lo que no tolera es que le
interrumpan la idea. El anuncio no le cuesta dinero, le cuesta la canción.

**Todo el nicho es iOS.** Songzap, Logic, GarageBand, Cubasis, Demo, Hum, Musebox,
REIKTU: solo iPhone. En Android solo hay DAWs genéricas, porque la latencia de
audio de Android históricamente pasa de 100 ms. **Nosotros somos web**: un enlace,
sin tienda, sin 868 MB, mismo código en iPhone y Android, actualizado el mismo
día. Ninguno de ellos puede mandarte su app por WhatsApp.

---

## 3. Las cuatro fases

Cada fase tiene un **entregable macro**: una frase que se comprueba con el móvil
en la mano. Si no se puede comprobar, no está hecha.

### Fase 1 · Que grabar sea impecable — semanas 1 a 3

> **Entregable: grabas cinco capas de una idea real, no abres ajustes ni una vez,
> y al día siguiente están todas ahí.**

Esta fase no añade nada vistoso. Cierra los agujeros por los que se pierde la
confianza, que es lo único que no se recupera.

- Que no se pierda nada, y que se note: guardado a prueba de balas, aviso si el
  móvil se queda sin sitio, confirmación y deshacer al borrar una idea, y un
  estado permanente que diga *guardado en este móvil*.
- Arreglar la primera pantalla: un toque hasta grabar, sin deberes previos, sin
  claqueta en la primera toma —no hay nada con lo que cuadrar— y con la promesa
  de privacidad antes de pedir el micrófono.
- La onda se ve mientras grabas, no después.
- Bucle entre dos puntos, regrabar un trozo sin crear pista nueva, y reordenar.
- Objetivos táctiles y contrastes a norma. Hoy hay texto a 3,1:1 y botones de
  20 px, y eso en un móvil con una mano no se usa.

### Fase 2 · Que vuelvas mañana — semanas 4 a 6

> **Entregable: abres la app tres semanas después, encuentras la idea del sábado
> por su nombre en menos de diez segundos, y la sigues.**

Es la fase que Music Memos no hizo y que le costó la vida. Y es donde está el
hueco más grande del mercado: **todas las apps optimizan el momento de grabar, que
es el fácil. Ninguna optimiza el de volver.**

- Nombre a la idea justo después de la primera toma. Tres segundos, voluntario.
  Hoy todo se llama "Idea nueva" y mañana hay cinco iguales.
- La biblioteca sale de Ajustes a la cabecera: onda de referencia, duración,
  fecha en lenguaje humano, y una idea nueva a un toque.
- **Indexado automático por contenido.** La app ya sabe sacar el tempo y la
  tonalidad de lo que tocas: que lo guarde. Buscar *"esa cosa en La menor a 90
  con guitarra"* no lo hace nadie, y la tecnología ya está escrita en este repo.
- Compartir de verdad: un toque, y el fichero se llama `bulerias-92bpm.wav`, no
  `idea-nueva.wav`.

### Fase 3 · Que suene mejor de lo que tocaste — semanas 7 a 9

> **Entregable: grabas ocho compases de guitarra, la app dice "92 BPM · Mi frigio
> · por arriba", le das a un botón, y entra una bulería cuadrada y afinada.**

Aquí está el chute. Y aquí está lo que ningún competidor puede copiar deprisa.

- El oído completo: tempo y tonalidad al soltar el botón. **Ya funciona**; falta
  que la rejilla, la claqueta y los ritmos se alineen solos con lo que tocaste.
- **El compás en la pantalla.** Hoy el doce se explica con un párrafo dentro de
  un panel. Hay que dibujarlo: doce puntos, los acentos más grandes, girando con
  el tempo. Es la portada del producto y lo que hace que un flamenco lo entienda
  en dos segundos sin leer. Y la regla tiene que numerar ciclos, no compases de
  cuatro: hoy la app contradice su propia tesis en su propia regla.
- Más palos, con los patrones corregidos de oído por un músico —no por mí.
- Estirar el tempo después de grabar. Es el fallo de raíz de Songzap y se
  resuelve con una librería MIT en el propio navegador.
- Generación de una pista suelta: batería sola, bajo solo, un colchón. Por API,
  detrás de un gesto deliberado y con el coste dicho por delante.

### Fase 4 · Que se pueda enseñar — semanas 10 a 12

> **Entregable: mandas la maqueta a la banda por WhatsApp y nadie pregunta qué
> es eso.**

- Exportar la mezcla con el ritmo incluido —hoy se queda fuera si no lo pasas a
  pista, y te enteras cuando ya lo has mandado.
- Pistas sueltas en un ZIP. Hoy se lanzan N descargas seguidas y Safari solo
  deja la primera: está roto en el navegador donde tiene que funcionar.
- **Vertical con la onda animada.** El mercado ya premia el material sin pulir en
  TikTok y Reels, y ninguna app de esta lista exporta a ese formato. Es una
  semana de trabajo y no lo tiene nadie.
- Secciones de canción, letra junto al audio, y un enlace para enseñarla.

---

## 4. Calendario

| Semana | Foco | Se comprueba con |
|---|---|---|
| 1 | Guardado a prueba de balas y borrado reversible | Matas la app grabando y no pierdes nada |
| 2 | Primera pantalla, un toque hasta grabar, onda en vivo | Cronómetro: del icono al audio, menos de dos segundos |
| 3 | Bucle, regrabar un trozo, reordenar, tamaños y contrastes | Cinco capas sin abrir ajustes |
| 4 | Nombre a la idea y biblioteca en la cabecera | Diez ideas y encuentras una |
| 5 | Indexado por tempo, tonalidad y duración | Buscas "La menor" y sale |
| 6 | Compartir con nombre y formato decentes | Lo mandas y se entiende |
| 7 | El oído cablea rejilla, claqueta y ritmo | Grabas libre y la base entra cuadrada |
| 8 | El ciclo dibujado y la regla en ciclos | Un flamenco lo entiende sin leer |
| 9 | Estirar el tempo y más palos | Cambias de 92 a 108 y todo sigue cuadrado |
| 10 | Generar una pista suelta por API | Pides un bajo y entra en tu tonalidad |
| 11 | Exportación completa y ZIP | Abres los stems en un DAW de escritorio |
| 12 | Vertical animado y enlace para enseñar | Lo subes a Instagram sin editar nada |

Las semanas 1 a 3 no son negociables ni reordenables: hasta que la app no pierda
nada, cualquier cosa que se construya encima está construida sobre arena.

---

## 5. Qué se compra y qué se construye

La regla es tuya —lo que se pueda sacar de una API, de una API— con el matiz que
decide de verdad la frontera: **no es qué existe, es cuánto puede tardar.** Si
suena mientras tocas, va en local. Si puedes esperar veinte segundos, va a una
API.

Con eso, y con los precios verificados en agosto de 2026:

| Pieza | Decisión | Por qué |
|---|---|---|
| Tempo y tonalidad de tu toma | **Construido** ✅ | Music.AI lo cobra a 0,03-0,04 $/min. Tiene que salir al soltar el botón, sin red. Ya está hecho y probado |
| Ritmos y compases | **Construido** ✅ | No hay API que sepa un doce. Y tiene que ser instantáneo |
| Estirar el tempo | **Construir** — `signalsmith-stretch` | MIT, en AudioWorklet, tiempo real en móvil. Rubber Band es GPL o licencia de pago: descartado |
| Separar pistas | **Construir** — Demucs ONNX en el navegador | MIT y **gratis**. Music.AI cobraría 0,15-0,45 $ por canción, nueve veces el umbral. Y en calidad medida el libre empata o gana |
| Tararear → melodía | **Construir** — Basic Pitch de Spotify | Apache 2.0, corre en el navegador, coste cero |
| Detección de acordes | **Construir** | Essentia.js lo haría, pero es **AGPL**: en un producto cerrado obliga a licencia comercial de la UPF. No merece la pena el riesgo |
| Generar un instrumento suelto | **API** — ACE-Step audio-to-audio | 0,012 $/min, Apache 2.0, acepta audio de referencia. 0,55 céntimos por 30 segundos |
| Jam instrumental en directo | **API** — Lyria RealTime | Streaming por WebSocket, control a menos de 2 s, y `mute_drums` / `only_bass_and_drums` para aislar capas. Precio sin publicar: **hay que verificarlo antes de apoyarse en ello** |
| Banco de loops | **Precalcular** | No existe ninguna API que te dé loops por tempo y tonalidad. Generar 500 loops una sola vez con ACE-Step cuesta unos 3 $ y luego se sirven gratis |
| Masterizar | **Construir** un limitador y un EQ | LANDR cobra 2,50 $ por tema: cincuenta veces el umbral. Para una maqueta sobra |
| Grabar sin cascos | **Construir** | RT60 licencia el suyo como paquete de Swift, pero **solo para iOS** y nosotros somos web. A nuestro favor: conocemos la señal que estamos reproduciendo, así que no es cancelación a ciegas |

Descartados con motivo: **MusicGen y MAGNeT** (pesos no comerciales, riesgo legal
directo), **Suno y Udio** (no tienen API oficial; Udio además ya no deja exportar
lo que generas), **Dolby.io Media APIs** (han desaparecido de su oferta pública),
**Spleeter** (abandonado en 2022).

Coste estimado del uso real: **mil ideas de treinta segundos, unos 10 $.**

---

## 6. Lo que NO vamos a hacer

Escrito para poder decir que no sin discutirlo otra vez:

- **Rachas y notificaciones que culpabilizan.** Convierten una idea en una deuda
  con la app, y el día que se rompe la racha —siempre se rompe— la app pasa a ser
  un recordatorio de fracaso. La creatividad no es diaria.
- **Gamificación falsa.** Puntos y niveles encima de un oficio de verdad. A un
  músico eso le insulta.
- **Anuncios, y cerrar la exportación.** Es literalmente lo que le costó a
  BandLab 1,43 estrellas y lo que convirtió a Udio en un jardín cerrado. Bajarte
  tu propio WAV es gratis siempre. Esa confianza **es** el foso.
- **Convertirlo en un DAW.** El escritorio ya está resuelto. Si una decisión
  mejora la calidad final pero encarece llegar a la primera toma, se descarta.
- **Perseguir a Suno.** Ellos hacen canciones; esto graba la tuya. Son dos
  trabajos distintos y mezclarlos no gana ninguno de los dos.

---

## 7. Lo que necesito que decidas tú

Ninguna me bloquea —tiro con un valor razonable y lo cambias— pero cada una que
contestes ahorra una semana de ir a ciegas:

1. **¿Tocas con claqueta o libre?** Cambia si la rejilla manda sobre ti o al
   revés. Mi apuesta: libre en la primera toma, claqueta a partir de la segunda.
2. **¿Qué palos van en el banco inicial?** Hoy hay bulerías, soleá, rumba,
   tangos, bolero, bossa, pop y balada. Dime cuáles sobran y cuáles faltan.
3. **Los patrones, corregidos de oído.** Son cuatro números en un array y tú
   sabes cómo suena un cajón por bulerías mejor que cualquier algoritmo.
4. **¿Clave de API para generar?** Sin ella, la fase 3 se queda en el motor de
   patrones, que ya es mucho, pero no genera una guitarra.
5. **La pregunta grande: ¿línea de tiempo o lista de tomas?** Un revisor sostiene
   que para maquetar basta con una lista vertical de tomas sonando a la vez, y
   que eso quitaría la mitad de la interfaz. Otros dos dicen que en cuanto
   quieres mover una toma medio compás necesitas el eje. **Esto no lo resuelve
   una discusión: lo resuelves tú grabando cinco maquetas seguidas y contando
   cuántas veces mueves algo de lado.** Si son menos de dos, nos ahorramos media
   app.

---

## 8. Riesgos, dichos a la cara

- **El precio de Lyria RealTime no está publicado.** Las fuentes secundarias
  dicen que es gratis en fase experimental. Hay que verificarlo antes de montar
  nada encima.
- **Los modelos generativos no cuadran a compás por diseño.** Todo lo que venga
  de un modelo habrá que analizarlo y cortarlo. Nunca será tan exacto como el
  motor de patrones.
- **iOS manda y cambia.** Safari se comporta distinto entre versiones y ya nos ha
  costado una tarde. Cada versión nueva hay que volver a probar en un iPhone de
  verdad.
- **El almacenamiento crece rápido**: unos 5,6 MB por minuto y pista.
- **Android tiene un foso técnico real.** La latencia de audio de muchos
  dispositivos supera con creces lo que admite un overdub. Ser PWA nos da el
  acceso, no la calidad: habrá que medir dispositivo por dispositivo y ser
  honestos cuando no dé.
- **Nadie sabe que esto existe.** Songzap tiene un producto notable y 15
  valoraciones. Construir bien no basta, y ese problema no lo arregla el código.
