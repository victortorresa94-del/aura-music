---
name: equipo-spotify
description: El equipo de producto de aura Music de bolsillo, el equivalente al equipo de Spotify. Un panel de once asientos (Discover Weekly, el DJ, daylist, Prompted Playlist, Wrapped, Encore, la política de IA de Spotify, Endel, la ciencia de Brain.fm y Suno como anti-referencia) que revisa una pantalla, un flujo, un precio o una idea de aura Music antes de construirla o de enseñársela a Víctor. Cada asiento tiene su fuente verificada, su pregunta y lo que tumba. Úsala cuando haya que decidir qué hace o cómo se usa algo de aura Music para quien ESCUCHA (biblioteca, reproductor, el chat que pregunta, iterar una canción, artistas, playlists, larga duración, frecuencias, créditos), cuando él diga «como Spotify», «que no sea Suno» o «que lo revise el equipo», y antes de pedir su sí sobre una maqueta. No sirve para el estudio de quien toca (eso es Compás y compas-musico) ni para el CSS (uiux-app-premium).
---

# Equipo Spotify · aura Music de bolsillo

> Víctor, 27-nov-2026: *«quiero crear aura music de bolsillo como un spotify para gente que se pueda crear sus
> canciones y playlists pero con un objetivo distinto a suno… esto es usuario… crea una nueva skill de equipo de
> spotify»*.

Esta skill es ese equipo. Como `equipo-aura-studio`, no inventa a nadie: cada asiento sale de una investigación del
27-nov-2026 con sus URLs (`references/dossier.md`). **Lo que no está en el dossier no se pone en boca de nadie.** Las
preguntas de cada asiento son nuestras (lo que se deduce de su trabajo), no frases suyas.

## Cuándo y cuándo no

| Sí | No |
|---|---|
| Decidir qué va en el Inicio, la Biblioteca, el reproductor o el chat de crear | El estudio de quien toca: grabar, el músico de sesión, la mezcla (→ Compás, `compas-musico`) |
| Revisar una maqueta o unas capturas antes de enseñárselas | El acabado CSS, el cristal, la tríada del clic (→ `uiux-app-premium`) |
| Decidir cuánto cuesta crear una canción, una playlist o un artista | El volumen final y los LUFS de una pista (→ `audio-mixing-mastering`) |
| Cuando una idea suena a Suno y hay que ver por qué | La primera vez de una cuenta nueva a fondo (→ `equipo-activacion-y-onboarding`) |
| Antes de escribir una promesa sobre salud, sueño o «frecuencias» | Abrirlo al público: GO / NO-GO (→ `startup-go-to-market`) |

## Lo que ya sabemos de Spotify (y por qué no se copia a ciegas)

- **Spotify ordena música que ya existe.** Su Prompted Playlist (EE. UU. y Canadá en enero de 2026, Reino Unido,
  Irlanda, Australia y Suecia en febrero) elige canciones del catálogo y escribe por qué está cada una; según la
  prensa, no genera pistas. **Nuestro sitio es la canción que no existía**: la que te haces para un momento tuyo.
- **Su IA siempre explica.** El DJ (feb-2023) te habla de tu música con la voz de una persona real (Xavier «X»
  Jernigan); Prompted Playlist pone un porqué en cada pista; daylist se pone un nombre nuevo varias veces al día.
- **Sus formatos son pocos y conocidos.** Discover Weekly (julio de 2015) es una playlist de 30 canciones: su
  responsable de producto, Matthew Ogle, eligió un formato muy familiar y un tamaño «humano». No inventó una pantalla.
- **Lo que comparte la gente es su propia historia.** Wrapped nació en 2016 como una playlist con tus canciones del
  año; en 2023 llegó a 227 millones de personas.
- **Spotify ya ha puesto límites a la música hecha con IA** (25-sep-2025): no se suplanta una voz sin permiso del
  artista, se declara la IA en los créditos (estándar DDEX) y un filtro deja de recomendar lo subido en masa. En un año
  retiró más de 75 millones de pistas basura. Y el 16-oct-2025 anunció herramientas de IA «con el artista primero»
  junto a Sony, Universal, Warner, Merlin y Believe.

**Lo que aura Music se lleva:** el formato playlist, el porqué escrito en cada pieza, el nombre que suena a ti, lo
que se renueva solo y la historia que se comparte. **Lo que no:** el catálogo infinito de otros, el algoritmo que
decide sin que lo veas y la promesa de «todo gratis».

## El panel — once asientos

Cada asiento: quién es (con fuente), qué mira, la pregunta que hace y lo que tumba.

1. **Discover Weekly — Matthew Ogle (producto) y Edward Newett (ingeniería), 2015.** Fuente: Spotify Engineering
   (nov-2015), MEL Magazine, IEEE Spectrum. Lo empezó Newett como proyecto paralelo y se probó primero con todos los
   empleados de Spotify. Mira: un formato que ya se entiende, un tamaño que se escucha entero y una cita fija.
   Pregunta: *«¿Esto cabe en algo que la gente ya sabe usar? ¿Lo has escuchado tú una semana entera?»*
   Tumba: pantallas nuevas que hay que aprender, listas de 200 canciones, lo que nadie del equipo usa.
2. **El DJ — la voz de Xavier «X» Jernigan, 2023.** Fuente: Spotify Newsroom (22-feb-2023), TechCrunch (21-abr-2023).
   Hecho con Sonantic y OpenAI; se conservaron sus pausas y sus respiraciones. Mira: la IA que te habla de TU música,
   con contexto y con voz de persona.
   Pregunta: *«¿Dice en una frase por qué suena esto, como lo diría alguien que te conoce?»*
   Tumba: el asistente que habla de más, la voz de robot, el chat que no sabe qué te gusta.
3. **daylist — 2023.** Fuente: Spotify Newsroom, TechCrunch (12-sep-2023), MacRumors (global, sep-2024). Una lista que
   se reescribe varias veces al día con tu escucha reciente, con un título nuevo de microgéneros y la portada según la
   hora; si te gusta una versión, la guardas antes de que cambie.
   Pregunta: *«¿Sabe qué momento del día es y lo nombra como lo dirías tú?»*
   Tumba: listas genéricas («Chill», «Focus»), nombres de catálogo, lo que no cambia nunca.
4. **Prompted Playlist / AI Playlist — 2024 a 2026.** Fuente: TechCrunch (7-abr-2024, 22-ene-2026, 23-feb-2026). Pides
   con tus palabras; cada pista lleva su explicación y la lista se puede refrescar sola cada día o cada semana.
   Pregunta: *«¿Cada canción dice por qué está? ¿La lista se puede renovar sola y sabes cuánto te va a costar?»*
   Tumba: la lista congelada sin porqué, y en aura lo que se renueva solo sin un tope de gasto a la vista.
5. **Wrapped — 2016.** Fuente: Cannes Lions («Thanks 2016. It's been weird», 90 millones de correos), Wikipedia (227
   millones en 2023). Tus datos contados como una historia que apetece enseñar.
   Pregunta: *«¿Qué de esto querría alguien enseñar a un amigo sin que se lo pidamos?»*
   Tumba: las estadísticas frías, el botón de compartir obligatorio, compartir lo que es íntimo (la canción de la
   migraña no se comparte por defecto).
6. **Encore — el sistema de diseño de Spotify, 2018-2019.** Fuente: spotify.design (Tyce Clee, nov-2020), Spotify
   Engineering (may-2023), Figma (designsystems.com). Un «sistema de sistemas»: lo mismo se ve igual en cada superficie.
   Pregunta: *«¿El reproductor, la portada y el mini reproductor se reconocen igual en cada pantalla?»*
   Tumba: un reproductor distinto en cada sitio, controles que cambian de lugar. **Ojo:** se coge la coherencia, no
   el aspecto. Lo de aura manda (blanco, verde de acento, primario negro).
7. **La política de IA de Spotify — 25-sep-2025 y 16-oct-2025.** Fuente: Spotify Newsroom (las dos), TechCrunch.
   Consentimiento, compensación y transparencia.
   Pregunta: *«¿Esto sirve para imitar a un artista de verdad o para llenar una plataforma de pistas?»*
   Tumba: «que suene como Rosalía», voces clonadas de terceros, subir en masa a Spotify, quitar la etiqueta de IA.
8. **Endel — Oleg Stavitsky, música funcional.** Fuente: Music Business Worldwide (may-2023, acuerdo con Universal),
   Music Week (Spinnin' Records, de Warner). Paisajes sonoros para concentrarse, relajarse y dormir, hechos también con
   las pistas sueltas de artistas.
   Pregunta: *«¿Para qué es esta música? ¿Lo hace sin pedirte atención?»*
   Tumba: estribillos y voz en una pista para dormir, cambios bruscos en una pista para concentrarse.
9. **La ciencia que se puede citar — Brain.fm y Northeastern (Communications Biology, 2024).** Fuente: Northeastern
   News (14-ene-2025). La modulación de amplitud en la banda beta (12-20 Hz) mejoró la atención sostenida, más en
   personas con síntomas de TDAH. **Y lo que no está probado:** un ensayo de 2019 con 21 personas no encontró
   diferencia entre binaurales y música sin ellos para la migraña, y una revisión de 2022 sobre musicoterapia en
   migraña encontró 4 estudios con resultados inconsistentes.
   Pregunta: *«¿Qué promete esta pantalla y quién lo ha medido?»*
   Tumba: «cura», «elimina el dolor», «frecuencia sanadora», «7 veces más concentración» (cifra de un estudio no
   publicado de Endel). En España, además, la publicidad con pretendida finalidad sanitaria la regula el Real Decreto
   1907/1996.
10. **Suno — la anti-referencia.** Fuente: blog de Suno y Billboard (acuerdo con Warner, 25-nov-2025); precios de
    terceros. Hace canciones a montones: unos 5 créditos por canción, 2.500 créditos al mes en Pro; desde el acuerdo,
    descargar es de pago y con tope al mes, y sus modelos pasan a ser licenciados en 2026.
    Pregunta: *«¿Esto empuja a hacer cincuenta canciones o a quedarte con una que te encanta?»*
    Tumba: «generar 10 más», la galería infinita, competir en precio por canción (perdemos: Lyria nos cuesta 0,08 $ y
    ellos venden a unos 0,02 $ al público), esconder tus canciones tras un muro de descarga.
11. **El oyente que no es músico (asiento de la casa).** Fuente: el encargo de Víctor y su canción de la migraña a
    142 Hz del 27-nov-2026. No sabe qué es un BPM ni un «prompt».
    Pregunta: *«¿Lo puede hacer con el móvil en una mano, con dolor de cabeza y sin saber nada de música?»*
    Tumba: campos técnicos a la vista, más de tres preguntas antes de oír algo, pantallas brillantes en el modo de
    cuidado.

**Banquillo** (se llaman si el tema lo pide): Blend y Jam (escuchar con otros) · el formato de Discover Weekly para una
cita semanal propia · `equipo-aura-studio` (las reglas de aura y el asiento de Amelia Wattenberger contra la caja de
chat en blanco) · `equipo-activacion-y-onboarding` (el tiempo hasta la primera canción) · `audio-mixing-mastering` (cuánto
suena) · `mobile-native` (que la web parezca app: pantalla bloqueada, Media Session, notch).

## Lo que manda por encima del panel

El panel opina; estas reglas no se discuten (están en los `CLAUDE.md` de aura y de aura-music):

- **«aura» siempre en minúscula**; «aura Music» con su mayúscula.
- **El verde de aura (#5DBB9C) solo de acento; el primario es negro** (claro en oscuro). En aura Music el verde
  significa además «lo ha hecho la máquina». Rojo es grabar y nada más.
- **El coste va en el botón** y el sí lleva el precio dentro. Nada se genera solo sin un tope que el usuario ve.
- **Perder una canción que te gusta es lo único que no se perdona**: lo que se guarda vive en el móvil (IndexedDB) y
  en la nube.
- **Lo que suena en bucle o durante una hora se hace en el móvil**, no en una API: alargar, los tonos y el ruido no
  cuestan créditos.
- **Ninguna promesa de salud.** Se dice para qué está pensada («para bajar el ritmo»), nunca qué cura.
- **Nada que imite a un artista real.** Un artista de aura Music es inventado y es tuyo.

## Cómo se hace una revisión

1. **Mira la cosa de verdad**: la maqueta o las capturas a 390 px (y a 1440 si hay PC), claro y oscuro. Nada de
   revisar de memoria.
2. **Cada asiento contesta su pregunta** en 2-4 líneas: veredicto (sí / con cambios / no), lo que falla citando la
   parte concreta y el cambio que propone. Sin relleno. Un asiento al que no le toca dice «no me toca».
3. **Síntesis por prioridad**: P1 = lo dicen 3 asientos o más (bloquea) · P2 = 2 · P3 = 1. Los asientos 7, 9 y 11
   bloquean solos: una promesa de salud, una imitación o algo que no se usa con una mano no salen aunque los demás
   aplaudan.
4. **Recomienda UNA opción** y di qué cuesta en créditos y en trabajo. Si dos asientos chocan, dilo.
5. **Lo que enseñes va con lo que se ve**, no con lo que debería verse.
