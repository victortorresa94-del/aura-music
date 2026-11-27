# aura Music de bolsillo · plan

27 de noviembre de 2026. Solo plan: no hay código de esto todavía. Revisado por el equipo Spotify
(`.claude/skills/equipo-spotify/`, once asientos con fuentes) y con las skills de aura Storage y de fuera que se
citan en cada parte. Las fuentes de cada dato están en `.claude/skills/equipo-spotify/references/dossier.md`.

> **El encargo, con sus palabras.** *«Quiero crear aura music de bolsillo como un spotify para gente que se pueda
> crear sus canciones y playlists pero con un objetivo distinto a suno. Suno es para crear canciones a punta pala…
> esto es usuario. Que un user se pueda crear incluso un artista pre entrenado o tipo de música para siempre crearla…
> pagarás una suscripción y gastas x créditos por canción o por crear una playlist, pero también podrás crear
> canciones largas o playlists… yo hoy me he creado una canción de migraña de 142 Hz pues quiero poder crearlo desde
> ahí, con un chat dentro de IA que me ayude… a preguntar cosas clave y luego tirar sobre esa canción hasta que te
> guste y guardarla.»*

> **La apuesta en una frase.** Spotify te pone la música de otros; Suno te deja hacer quinientas canciones. aura
> Music te hace **la canción que no existía para un momento tuyo**, la retoca contigo hasta que te encanta y la guarda
> en tu biblioteca, donde la escuchas como cualquier otra.

---

## 0. Dónde encaja

| | Spotify | Suno | Endel | Compás (este repo hoy) | **aura Music de bolsillo** |
|---|---|---|---|---|---|
| Qué haces | Escuchas lo de otros | Haces canciones a montones | Pones un paisaje sonoro | Tocas y la banda viene sola | Te haces tu música y la escuchas |
| Para quién | Todo el mundo | Quien quiere crear | Quien quiere concentrarse o dormir | Quien toca un instrumento | **Quien escucha y no es músico** |
| Unidad | La canción del catálogo | La generación | La sesión | La toma | **La canción que te quedas** |
| La IA | Elige y explica (DJ, daylist) | Genera | Adapta el sonido | Escucha y acompaña | **Pregunta, genera, retoca y recuerda** |

**Lo que lo hace distinto de Suno**, que es lo que pidió: aquí no se mide cuántas generas sino cuántas te quedas y
cuántas veces vuelves a escucharlas. Tres consecuencias de diseño:
1. **No hay botón de «10 más».** Se hace una, se retoca con versiones y se guarda.
2. **Tu canción es tuya**: se descarga sin tope y suena sin red (Suno, desde su acuerdo con Warner, cobra y limita
   las descargas).
3. **Hay artistas tuyos y paisajes largos**, que Suno no trata como producto: una banda inventada que siempre suena
   igual y una pieza de una hora para la migraña que no cuesta más que una canción.

**Lo que NO es:** otro DAW (eso es Compás, y se queda), un distribuidor a Spotify, una red social de canciones ni una
app de salud.

---

## 1. Lo que ya tenemos (y por qué esto es más montar que inventar)

| Pieza | Dónde | Qué aporta |
|---|---|---|
| Generar canciones con 12 modelos, Lyria por Google directo, el cobro y los frenos | aura Studio: `api/fal.ts` (`op:'music'`), `api/_lyriaGoogle.ts`, `api/_precios.ts` (`usdMusica`) | El motor y el dinero. Acepta el token de Firebase de cualquier app del mismo proyecto y su CORS es `*` (`api/_cors.ts`): **aura Music puede llamarlo tal cual**, como ya concluyó `PLAN-AURA-GO` |
| El monedero, los planes, Stripe, el IVA y los topes | aura Studio: `_monedero.ts`, `_planes.ts`, `_rateLimit.ts` | Un monedero para todo aura. No se escribe otro |
| La cuenta, la nube local-primero, el FLAC, la cola | Este repo: `src/lib/nube/` (decisión 0023) | Las canciones se guardan como las ideas: IndexedDB manda, la nube se pone al día |
| El motor de audio, la mezcla y el masterizado en TS | Este repo: `src/lib/daw/mezcla/` (decisión 0018) | Alargar sin costuras, tonos y ruido, volumen de cuidado, exportar |
| El productor con Claude y su cerebro | Este repo: `src/app/api/productor/`, `src/lib/productor/` (0014) | La base del chat que pregunta y recuerda |
| ACE-Step 1.5 en una GPU propia | Este repo: `src/lib/ia/` (0003, 0015) | Retocar un trozo (`repaint`), versiones (`cover`), completar y, más adelante, entrenar un artista (LoRA) |
| Music Studio (la pantalla de crear música del Studio) | aura Studio: `MusicStudio.tsx`, `src/sonido/` | Lo que ya funciona para crear con controles: aquí se simplifica para quien no sabe |

**Lo nuevo de verdad** es poco y es lo que se ve: la biblioteca y el reproductor, el chat que pregunta, las versiones
de una canción, el artista, la playlist y el motor de larga duración.

---

## 2. Para quién y para qué momento

Una persona con el móvil en la mano que no sabe qué es un BPM. Lo que pide, dicho como lo dice:

- *«Una para la migraña de esta tarde, lenta, sin voz, con el tono de 142 Hz.»* (el caso de Víctor del 27-nov)
- *«Música para correr a mi paso, media hora.»*
- *«La canción de cumpleaños de mi madre, con su nombre, en rumba.»*
- *«Algo para que el bebé se duerma, una hora.»*
- *«Mi banda de rumba inventada: una nueva cada semana.»*
- *«Dos horas para concentrarme, sin letra.»*
- *«Una playlist para la cena del sábado con mis amigos, que suene a verano.»*

Dos familias: **canciones** (2-3 minutos, con o sin voz, con estructura) y **paisajes** (de 10 minutos a varias
horas, sin estribillo, para un fin). El asiento de Endel lo pide separado: un paisaje no tiene estribillo y una
canción no se repite una hora.

---

## 3. El producto, pieza a pieza

### 3.1 Escuchar: la biblioteca y el reproductor (lo de Spotify)

- **Tres sitios abajo:** Inicio · Crear · Biblioteca. Nada más en la barra.
- **Inicio** cambia con la hora, como daylist: por la mañana tus canciones de arrancar, por la noche las de dormir, y
  arriba «Seguir escuchando». Cada bloque con un nombre que suena a ti («Martes de lluvia», «Tu migraña de las 19:00»),
  sacado de tus canciones y no de un catálogo.
- **Biblioteca:** Canciones · Playlists · Artistas · Paisajes. Filtros como chips, nunca un desplegable.
- **Un reproductor** (asiento de Encore): mini reproductor fijo encima de la barra, y al tocarlo la pantalla grande con
  la portada, la letra si la hay, **la fila de versiones** de esa canción y «Retocar con aura».
- **Suena con la pantalla bloqueada y sin red:** Media Session (los controles de la pantalla de bloqueo) y la canción
  guardada en el móvil. ⚠️ En el iPhone, el `AudioContext` se suspende con la pantalla bloqueada y un `<audio>` no:
  lo que suene mucho rato va por `<audio>` (ver 3.6). Se mide en un iPhone de verdad antes de dar nada por bueno
  (`mobile-native`).
- **Descargar** cualquier canción tuya en MP3, sin tope, con sus metadatos de IA (ver 6).

### 3.2 Crear: el chat que pregunta (lo que pidió)

No es una caja en blanco (asiento 8 de `equipo-aura-studio`: «si solo ves la caja, no sabes qué sabe hacer»). Es una
conversación corta que **pregunta lo clave con botones** y enseña la receta antes de gastar:

1. **Qué y para qué** (texto libre o un chip: Para un momento · Para alguien · De mi artista · Un paisaje largo).
2. **Como mucho tres preguntas**, solo las que faltan, cada una con chips:
   - ¿Con voz o sin voz? (y en qué idioma)
   - ¿Cuánto dura? (una canción · 20 min · 1 h · hasta que la pare)
   - ¿Te suena a algo? (un estilo, un recuerdo, una canción tuya anterior)
   - Solo si encaja: ¿Le pongo un tono o un pulso? (142 Hz, ruido suave, binaural con auriculares)
3. **La receta, a la vista** (como el plan de la skill de playlists de MiniMax, que enseña el plan antes de generar):
   «Canción lenta, sin voz, piano y pad cálido · 1 hora (la canción se repite sin cortes) · tono de 142 Hz muy bajo ·
   6 créditos». **El botón lleva el precio** y es el sí.
4. **Primero un boceto barato** cuando la petición es vaga: 30 segundos con Lyria 3 Clip (3 créditos) para comprobar
   el rumbo, y luego la entera. Es la regla de aura de explorar barato y producir una.

El chat **recuerda** (el cerebro del productor, 0014): tus estilos, tus tonos, «la de la migraña» y lo que no te gustó.
La segunda vez pregunta menos: *«¿La de siempre para la migraña, o probamos otra cosa?»* (asiento del DJ: hablar como
alguien que te conoce, en una frase).

⚠️ **Lo que se dice de salud no se guarda como salud.** «Migraña» en el chat es un dato de salud (categoría especial
del RGPD, art. 9). El cerebro guarda «tu canción de las tardes de dolor de cabeza» solo si tú la nombras así y la
guardas; no deduce ni etiqueta condiciones médicas, y todo eso vive primero en el móvil.

### 3.3 Retocar hasta que te guste (tirar sobre la canción)

- Cada canción tiene **versiones** en fila bajo la portada (v1, v2, v3…), cada una con una frase de qué cambió y el
  coste de lo que la hizo.
- **Retoques en un toque**, en lenguaje de oyente: Más lenta · Más tranquila · Sin voz · Otra letra · Cambia solo el
  final · Más larga · Otra parecida. Detrás:
  - «Cambia solo el final / el estribillo» → ACE-Step `repaint` sobre ese tramo (barato, 1 crédito).
  - «Más lenta / sin voz / otra parecida» → nueva generación con la receta cambiada (6 créditos).
  - «Más larga» → se alarga en el móvil (gratis, 3.6) o con ACE-Step `complete` si tiene que crecer de verdad.
- **«Me la quedo»** guarda la versión elegida en la biblioteca. Las demás quedan como borradores 30 días y luego se
  borran (como la limpieza de la nube de la decisión 0023), salvo que guardes otra.
- Comparar A/B tocando dos versiones seguidas, en el mismo punto de la canción.

### 3.4 Tu artista (el «artista pre entrenado»)

- Un artista es **una ficha con ADN**: nombre, portada, estilo, tempo habitual, instrumentos, cómo canta (descrito),
  idioma, de qué habla y **lo que no hace nunca**. Cada canción nueva del artista sale de ese ADN, y aura lo va
  afinando con lo que te quedas y lo que descartas.
- **Dicho a la cara:** con Lyria, la voz de un artista **no es la misma** de una canción a otra; el estilo sí se
  mantiene. Para que suene siempre igual hace falta **entrenarlo**: un LoRA de ACE-Step con 10-20 canciones del propio
  artista (las que te has quedado), unos 5 minutos de GPU (`PLAN-MAESTRO.md`, C6). Eso es la fase 5 y es de pago aparte.
  ElevenLabs Music también entrena («finetunes»), pero sus condiciones exigen el plan Enterprise para dárselo a
  usuarios (`PLAN-MAESTRO.md`, C7).
- **Un artista es inventado y es tuyo.** No se crea uno que imite a alguien real: el chat no acepta «que suene como
  [artista real]» ni su voz (política de Spotify del 25-sep-2025: la suplantación solo con permiso del artista).
- **«Tu semana con…»**: una cita fija opcional, como Discover Weekly: cada lunes, una canción nueva de tu artista.
  Con su precio dicho al activarla y un tope al mes.

### 3.5 Playlists

Cuatro formas, de menos a más gasto:
1. **De tus canciones**, a mano: gratis.
2. **«Hazme una playlist» con canciones nuevas**: el chat pregunta el momento, propone **el plan** (N canciones, una
   línea por canción con su porqué, como Prompted Playlist) y el precio total, y genera al aceptarlo, de dos en dos,
   llenando la lista mientras suena la primera. Portada generada.
3. **Mezcla**: playlist con tus canciones de siempre más 2-3 nuevas que encajan.
4. **Viva**: se renueva sola cada día o cada semana (daylist, Prompted Playlist), **solo con un tope de gasto al mes**
   que eliges al activarla y que se ve en la playlist («quedan 18 créditos este mes»).

Por defecto, 8 canciones: menos que las 30 de Discover Weekly, porque aquí cada una se paga y se escucha entera.

### 3.6 Larga duración y frecuencias (la canción de la migraña)

La parte que no tiene nadie y la que más ahorra: **una hora cuesta lo mismo que una canción**.

- **Se genera una pieza pensada para repetirse** (instrumental, sin principio ni final marcados, 2-3 minutos) y **el
  móvil la alarga** sin costuras: cortes en el compás, fundidos iguales en energía y pequeñas variaciones de mezcla
  para que no canse. Todo con el motor de mezcla que ya existe (`buildMixGraph`). 0 créditos.
- **Capas que hace el móvil, gratis e infinitas**: un tono puro (142 Hz o el que pidas), ruido rosa o marrón, un pulso
  isocrónico suave y binaurales (un tono distinto en cada oído; **solo con auriculares**).
- **Temporizador** (apaga a los 20, 30, 60 min) y fundido de entrada de 30 s.
- **Modo cuidado** para dolor o sueño: pantalla oscura, ningún destello, volumen bajo y sin picos (más suave que los
  −14 LUFS de Spotify; la cifra se fija con `audio-mixing-mastering`) y el aviso «Si te molesta, páralo».
- ⚠️ **Dos cosas medidas que no hay que descubrir tarde:**
  - El altavoz de un móvil apenas reproduce 142 Hz: con el altavoz casi no se oye. La app lo dice y propone
    auriculares.
  - En el iPhone, lo que se sintetiza en vivo con Web Audio se calla al bloquear la pantalla. Por eso el bucle se
    **renderiza a un fichero** (OfflineAudioContext, como el exportar de hoy) y suena con `<audio>` en bucle. Un bucle de
    4 minutos en WAV mono son unos 20 MB: se guarda y se reutiliza. La app nativa (Capacitor, como aura Studio) lo
    resuelve del todo más adelante.
- **Más adelante:** radio infinita con Lyria RealTime (música que se va generando y que diriges en directo). Hoy es
  experimental y sin precio publicado: no entra en un plan que cobra.

**Lo que se dice:** «para bajar el ritmo», «para desconectar», «para dormir». **Nunca** «alivia la migraña», «cura» ni
«frecuencia sanadora». No es prudencia, es lo que hay: un ensayo de 2019 con 21 personas no encontró diferencia entre
binaurales y música sin ellos en la migraña, y una revisión de 2022 sobre musicoterapia y migraña encontró cuatro
estudios con resultados inconsistentes. Prometerlo convierte la app en un producto sanitario (y en España, en
publicidad con pretendida finalidad sanitaria, Real Decreto 1907/1996). Lo que sí se puede citar está en el asiento
9 del equipo (la modulación en beta y la atención, Brain.fm y Northeastern, 2024).

---

## 4. Motores: qué usa cada cosa

| Para qué | Motor | Coste nuestro | Por qué |
|---|---|---|---|
| Canción con voz y estructura (por defecto) | Lyria 3 Pro, por Google directo (ya en aura Studio) | 0,08 $ por canción, hasta unos 3 min | El que mejor sigue la petición en el Studio; trae marca de agua SynthID |
| Boceto de 30 s | Lyria 3 Clip | 0,04 $ | Comprobar el rumbo barato |
| La última de Google | Lyria 3.5 | 0,10 $ | Cuando tenga su primera tirada buena (hoy el Studio no la pone delante) |
| Retocar un trozo, versión en otro estilo, completar, entrenar un artista | ACE-Step 1.5 (MIT), en la GPU propia o por fal | Céntimos de céntimo por pista | Es el único con `repaint`, `cover` y LoRA a nuestro alcance. **Falta escucharlo en GPU de verdad** (fase 2 del PRD de Compás) |
| Que cante una letra exacta (el nombre de tu madre) | MiniMax Music 3 | 0,002 $/s (0,36 $ por 3 min) | Canta la letra literal |
| Alargar, tonos, ruido, binaurales, temporizador | El móvil | 0 | La regla de la casa: lo que suena en bucle va en local |
| Las preguntas del chat, la letra, el porqué de cada canción | Claude (como el productor) o un modelo barato | Céntimos | El productor ya existe (0014) |

**Descartados para empezar:** ElevenLabs Music (0,60 $/min y Enterprise para usuarios finales), Suno y Udio (sin API
abierta; wrappers no, por términos de uso, como ya dice el PRD de Compás), Lyria RealTime (sin precio).

Se añaden como **proveedores**, no tocando la app: implementando `ProveedorDePistas` (`src/lib/ia/tipos.ts`) y una
línea en `proveedores.ts` (regla 6 de `CLAUDE.md`). Lyria entra como un proveedor que llama a aura Studio.

---

## 5. El dinero

### 5.1 Lo que cuesta cada cosa en créditos

Con la regla de aura (`aura-studio/api/_precios.ts`): coste × 3,75, a 0,05 € el crédito, redondeado hacia arriba;
0,92 € por dólar.

| Acción | Coste nuestro | Créditos |
|---|---|---|
| Boceto de 30 s (Lyria 3 Clip) | 0,037 € | **3** |
| Canción entera (Lyria 3 Pro) | 0,074 € | **6** |
| Canción entera (Lyria 3.5) | 0,092 € | **7** |
| Canción con tu letra exacta, 3 min (MiniMax Music 3) | 0,33 € | **25** |
| Retocar un trozo (ACE-Step `repaint`) | < 0,01 € | **1** |
| Alargar a 1 hora, tonos, ruido, binaurales | 0 | **0** |
| Playlist nueva de 8 canciones + portada | ~0,63 € | **~51** (8 × 6 + 3) |
| Crear un artista (ficha + portada) | ~0,04 € | **3** |
| Entrenar un artista (LoRA, ~5 min de GPU) | por medir | **por medir** (la tarifa sale de la GPU real, no de memoria) |

### 5.2 La suscripción

**Recomendación:** un plan **Música a 4,99 € + IVA al mes con 120 créditos** (unas 20 canciones, o 2 playlists y
retoques), en el **mismo monedero de aura**: lo que te sobra lo gastas en el Studio y al revés. Se acumula un mes,
como los demás planes (`saldoPlanTrasRenovar`). Con el plan activo, recargas sueltas desde 2 €, como hoy en aura
(sin plan no se recarga: `recargaPermitida`).

- **Margen**: si alguien gasta los 120 créditos en 20 canciones de Lyria 3 Pro, nos cuestan 1,47 €; con la comisión
  de Stripe, quedan unos 3 € por persona y mes antes del almacenamiento (céntimos). Lo no gastado es margen de más,
  nunca el que lo sostiene (la regla del estudio de suscripción de aura).
- **Al entrar, 3 canciones de regalo** (18 créditos, ~0,22 € nuestro), con el mismo freno por día que el regalo de aura.
- **En el iPhone instalado desde la App Store no se venden créditos** (regla 3.1.1 de Apple, como en aura Studio:
  `puedeComprarAqui()`).
- **No competimos en precio por canción con Suno y no hay que fingirlo**: ellos venden unas 500 canciones al mes por
  10 $ y a nosotros solo Lyria nos cuesta 0,08 $. Competimos en que te quedas una, en que es tuya y en la hora de
  paisaje que cuesta lo que una canción. **Si ACE-Step convence al oído en GPU propia, la canción baja a 1-2
  créditos** y esto cambia: es la decisión que más dinero mueve y se toma escuchando, no leyendo.

---

## 6. Lo legal, sin sustos

- **Marcar lo generado (AI Act, art. 50.2).** Un sistema que sale al mercado después del 2-ago-2026 tiene que marcar
  el audio sintético desde el primer día (la prórroga del Ómnibus al 2-dic-2026 es solo para los que ya estaban). Lyria
  trae SynthID; lo de ACE-Step y lo mezclado en el móvil, no. Cada MP3 lleva sus metadatos («hecho con IA», motor,
  fecha) y la pantalla lo dice. Revisar el código de buenas prácticas de la Comisión antes de abrir.
- **Salud:** ni promesas ni etiquetas (3.2 y 3.6). Un abogado mira los textos de la pantalla de paisajes antes de abrir.
- **Imitar artistas:** bloqueado en el chat, como en Spotify.
- **Derechos:** lo 100 % IA no tiene derechos de autor en EE. UU. (lo dice el PRD de Compás); para escuchar en tu móvil
  da igual, para publicar no. **Publicar en Spotify no entra en la v1.** Si un día entra, con la declaración DDEX que
  pide Spotify. Las condiciones de Google sobre lo que genera Lyria para un uso así: **por leer**.
- **«Save to Spotify»** (herramienta oficial de Spotify que sube audio propio a tu Spotify como un programa privado)
  podría llevar tus canciones a tu app de siempre. Está pensada para voz (resúmenes, clases); si admite música y en qué
  condiciones, **por leer**.
- **Datos:** «migraña» es un dato de salud. Local primero, nada inferido, y borrar una canción borra lo que el
  cerebro sacó de ella.

---

## 7. Cómo se ve la primera vez

Medido por el tiempo hasta la primera canción que te quedas (`equipo-activacion-y-onboarding`):
1. Entras con tu cuenta de aura.
2. Una pregunta: *«¿Para qué momento quieres tu primera canción?»* con seis chips (Concentrarme · Dormir · Desconectar
   · Correr · Para alguien · Sorpréndeme).
3. Boceto de 30 s sonando en menos de un minuto (regalo).
4. «Me la quedo» o un retoque. Ya está en tu biblioteca.

Si hay canciones tuyas en aura Studio (Music Studio guarda en `studioAudios`), la biblioteca arranca con ellas: **la
de la migraña de hoy sería la primera**.

---

## 8. La revisión del equipo Spotify

Sobre este plan, asiento por asiento.

1. **Discover Weekly** — con cambios. Biblioteca y playlist son formatos que ya se saben usar: bien. «Crear» no puede
   ser una pantalla rara: que nazca también desde una playlist («Añade una nueva que encaje»). Y Víctor la usa una
   semana con su migraña antes de enseñársela a nadie.
2. **El DJ** — con cambios. El chat habla como alguien que te conoce y en una frase. Cada versión dice qué cambió y
   cada canción de una playlist por qué está.
3. **daylist** — sí. El Inicio por hora del día y los nombres que suenan a ti son el corazón de «escuchar».
4. **Prompted Playlist** — con cambios. El plan con porqué por canción, sí; la playlist viva solo con tope de gasto a
   la vista.
5. **Wrapped** — más adelante. «Tu año en aura Music» con tu artista inventado y 30 s de tu canción más escuchada. Lo
   íntimo (la migraña) no se comparte por defecto.
6. **Encore** — sí. Un reproductor, el mismo en todas partes; las versiones viven en él.
7. **Política de IA de Spotify** — sí, con las condiciones de la parte 6. **Bloquearía** cualquier «suena como…».
8. **Endel** — sí. Canciones y paisajes separados en la biblioteca y en el chat.
9. **La ciencia** — sí, si los textos no prometen. **Bloquearía** «alivia la migraña». El 142 Hz se hace porque lo
   pide el usuario, no porque cure.
10. **Suno** — con cambios. No hay «generar 10 más» y el precio por canción no se esconde. Pide que la decisión de
    ACE-Step se tome pronto, porque es la que acerca el precio.
11. **El oyente** — con cambios. Tres preguntas como mucho, todo con chips y con una mano. El modo cuidado se activa
    solo en los paisajes de dormir o de dolor.

**Síntesis.**
- **P1 (bloquea):** el chat pregunta con botones y enseña la receta y el precio antes de gastar (asientos 2, 4, 11) ·
  todo lo que se renueva solo lleva un tope a la vista (4, 10, 11) · ninguna promesa de salud ni imitación (7 y 9, que
  bloquean solos).
- **P2:** el Inicio por momentos del día (1, 3) · canciones y paisajes separados (8, 9).
- **P3:** el reproductor único con las versiones dentro (6) · Wrapped propio (5).

---

## 9. Por fases

| Fase | Qué | Créditos de IA | Se sabe que funciona cuando |
|---|---|---|---|
| **F0** | Este plan, su sí, y una maqueta de 5 pantallas pasada por el equipo | 0 | Víctor dice sí sobre la maqueta |
| **F1 · Escuchar** | Biblioteca, reproductor, pantalla bloqueada, sin red, importar tus pistas de aura Studio | 0 | Escuchas la de la migraña con la pantalla bloqueada en el iPhone, sin red |
| **F2 · Crear** | El chat que pregunta, boceto y canción con Lyria por aura Studio, versiones, «Me la quedo», precio en el botón | Lyria | De la primera pregunta a una canción guardada en menos de 3 min |
| **F3 · Paisajes** | Bucle sin costuras renderizado, tonos, ruido, binaurales, temporizador, modo cuidado | 0 | Una hora de la canción de la migraña sin un corte audible, con la pantalla bloqueada |
| **F4 · Playlists** | Plan con porqué y precio, generación de dos en dos, portada, playlist viva con tope | Lyria + imagen | Una playlist de 8 en menos de 5 min, sin pasarse del tope |
| **F5 · Artistas** | ADN del artista, «Tu semana con…», y después el LoRA de ACE-Step | ACE-Step | Tres canciones seguidas del mismo artista que alguien de fuera reconoce como el mismo |
| **F6 · Abrir** | Plan Música en Stripe, regalo de bienvenida, metadatos de IA, textos legales, la revisión de `startup-go-to-market` | — | GO de la mesa de lanzamiento |
| **F7 · Compartir** | Enlace público de una canción o playlist, «Tu año», escuchar con otros | — | Alguien de fuera abre el enlace y suena |

F1 y F3 no gastan un euro de IA y son lo que más diferencia: se pueden hacer ya.

---

## 10. Cómo se mide

- **La estrella:** minutos a la semana escuchando canciones tuyas (no generaciones).
- Canciones guardadas ÷ canciones generadas (si baja de 1 de cada 3, el chat pregunta mal).
- Versiones hasta «Me la quedo» (ideal: 3 o menos).
- Canciones escuchadas más de tres veces.
- Coste por canción guardada (no por generada).

---

## 11. Lo que necesito de ti

Con mi recomendación en cada una:

1. **Dónde vive.** *Recomiendo* la misma app aura Music, con **Escuchar** como entrada y **el estudio (Compás) como
   otra puerta** para quien toca. Comparten cuenta, nube, motor y productor, y una idea del estudio puede acabar en tu
   biblioteca. La alternativa, una app aparte, duplica todo lo de la parte 1.
2. **El motor por defecto:** Lyria 3 Pro por aura Studio, y escuchar ACE-Step en la GPU para decidir si baja el precio.
3. **El plan:** Música a 4,99 € + IVA con 120 créditos, en el monedero de aura. ¿Sí, o lo metemos en los planes que ya
   hay (Lite, Creador…)?
4. **Frecuencias y binaurales:** dentro, sin promesas de salud y con su aviso.
5. **La canción de la migraña de hoy:** ¿la hiciste en Music Studio de aura Studio o en otro sitio? Si es de aura,
   entra como la primera canción de tu biblioteca en F1.
6. **Luz verde a F0:** la maqueta de las cinco pantallas (Inicio, Crear, la canción con sus versiones, un paisaje en
   modo cuidado y la Biblioteca).

---

## Anexo · Skills consultadas

**De aura Storage:** `equipo-aura-studio` (las reglas de aura y el asiento contra el chat en blanco),
`equipo-activacion-y-onboarding`, `buscar-skills` y `find-skills` (el buscador), `audio-mixing-mastering`,
`mobile-native`, `pwa-development` y las de audio de la casa (`audio-musica-para-video`).

**De fuera, con el buscador de skills (skills.sh, 27-nov-2026)**, leídas y con licencia comprobada:

| Skill | Instalaciones | Licencia | Qué se coge | Veredicto |
|---|---|---|---|---|
| `minimax-ai/skills/minimax-music-playlist` | 1.424 | MIT | Perfil de gusto → **una sola pregunta (el momento)** → plan visible con dos líneas por canción → generar en paralelo → portada a la vez → guardar y pedir opinión | Adaptar para el chat de playlists (F4) |
| `ace-step/ace-step-1.5/acestep-songwriting` | 230 | MIT | Cómo se escribe la descripción y la letra con etiquetas de estructura (`[Verse]`, `[Chorus]`…), sin conflictos entre las dos | Adaptar para el «letrista» del chat (F2) |
| `elevenlabs/skills/music` | 17.381 | MIT | Planes de composición por secciones, retocar un trozo (inpainting) y entrenar un estilo (finetunes) | Solo leer: confirma que el retoque por trozos y el artista entrenado son el camino |
| `minimax-ai/minimax-music3/music-caption-rewriter` | 1.452 | (sin comprobar) | Descripción estructurada por secciones a partir de una frase corta | Solo leer |
| `bitwize-music-studio/claude-ai-music-skills` | 578 (lyric-writer) | CC0 | Prosodia y riesgos de pronunciación en letras | Solo leer, para F5 |
| `coreyhaines31/marketingskills/pricing` y `paywall-upgrade-cro` | 100.388 / 51.440 | MIT | Precio y la pantalla de «hazte del plan» | Para F6 |
| `spotify/save-to-spotify` | 64 | sin LICENSE | Subir audio propio a tu Spotify en privado | Por leer sus condiciones (parte 6) |

**Descartadas:** las de Suno (`suno-music-creator`, `suno-engineer`…): escriben prompts para un servicio sin API
abierta. Las de descargar música de otros sitios: no.
