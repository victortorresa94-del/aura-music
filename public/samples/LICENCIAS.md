# Licencias de las muestras de instrumentos

Todas las muestras de esta carpeta tienen licencia CC0 (dominio público) o CC BY.
Cada licencia se ha leído en la fuente (repositorio, README, fichero LICENSE o página del autor).
Comprobado el 17 de noviembre de 2026.

Las muestras se han tratado igual en los cinco paquetes:

- un tramo de cada nota, en mono a 44,1 kHz;
- el ataque empieza en el primer medio milisegundo;
- reafinadas al temperamento igual (quedan a menos de ±2 cents);
- pico normalizado a unos −1 dBFS;
- fundido de salida al final;
- codificadas en MP3 VBR.

Los ficheros se llaman con el número MIDI de la nota que suena.

## piano · CC BY 3.0 (hay que dar crédito)

- **Obra:** Salamander Grand Piano V3 (Yamaha C5), de Alexander Holm.
- **Descarga:** https://github.com/sfzinstruments/SalamanderGrandPiano/tree/master/Samples
- **Licencia verificada en:**
  - https://github.com/sfzinstruments/SalamanderGrandPiano (README y LICENSE): «This work is licensed under a Creative Commons Attribution 3.0 Unported License.»
  - https://archive.org/details/SalamanderGrandPianoV3 (fuente original del autor): campo de licencia `creativecommons.org/licenses/by/3.0/`, autor «Alexander Holm».
- **Texto de crédito (obligatorio):**
  > Salamander Grand Piano V3, de Alexander Holm, con licencia CC BY 3.0 (https://archive.org/details/SalamanderGrandPianoV3). Modificado: notas recortadas, pasadas a mono, reafinadas al temperamento igual, normalizadas y convertidas a MP3.
- **Contenido:**
  - 21 notas cada 3 semitonos, de MIDI 36 a 96 (C2–C7), en dos capas.
  - `NN-p.mp3` es la capa 6 de 16 (piano) y `NN-f.mp3` es la capa 12 de 16 (forte).
  - Duran 3,4 s.

## bajo · CC0 1.0

- **Obra:** Growlybass (Squier Jazz Bass), de Karoryfer Samples.
- **Descarga:** https://github.com/sfzinstruments/karoryfer.growlybass/tree/master/sustain
- **Licencia verificada en:**
  - https://shop.karoryfer.com/pages/free-samples: «All our free sample libraries are under a Creative Commons Zero license.»
  - https://github.com/sfzinstruments/karoryfer.growlybass/blob/master/LICENSE: «CC0 1.0 Universal».
- **Crédito:** no hace falta (CC0). Si se quiere: «Growlybass, de Karoryfer Samples (CC0)».
- **Contenido:**
  - 11 notas de MIDI 28 a 57 (E1–A3): 28 y 30, y luego cada 3 semitonos.
  - Son notas sostenidas en forte (`*_f_rr1`) y duran 2,2 s.

## piano-electrico · CC0 1.0

- **Obra:** Yamaha TX81Z, sonido «FM Piano». Es de la Versilian Community Sample Library (VCSL), de Versilian Studios.
- **Descarga:** https://github.com/sgossner/VCSL/tree/master/Electrophones/TX81Z/FM%20Piano
- **Licencia verificada en:** https://github.com/sgossner/VCSL (README y LICENSE): «This collection is under a Creative Commons 0 license.»
- **Crédito:** no hace falta (CC0). Si se quiere: «TX81Z FM Piano, de la Versilian Community Sample Library (CC0)».
- **Contenido:**
  - 13 notas cada 4 semitonos, de MIDI 36 a 84 (C2–C6).
  - Capa de velocidad 2 de 3 (mezzoforte). Duran 3,0 s.

## cuerdas · CC0 1.0

- **Obra:** VS Chamber Orchestra: Community Edition (VSCO 2 CE), de Versilian Studios.
  - Grabación de Sam Gossner y Simon Dalzell.
  - Edición de Elan Hickler (Soundemote).
- **Descarga:** https://github.com/sgossner/VSCO-2-CE/tree/master/Strings
- **Licencia verificada en:** https://github.com/sgossner/VSCO-2-CE/blob/master/LICENSE: «CC0 1.0 Universal». La API de GitHub también lo marca como `CC0-1.0`.
- **Crédito:** no hace falta (CC0). Si se quiere: «VS Chamber Orchestra: Community Edition, de Versilian Studios (CC0)».
- **Contenido:**
  - 15 notas sostenidas (con el vibrato de sección del original), de MIDI 36 a 83 (C2–B5).
  - Chelos, capa 3 (forte): 36, 40, 43, 47 y 50.
  - Violas, capa 2 (forte): 52, 59, 62, 65 y 69.
  - Violines, capa 2 (forte): 55, 72, 76, 79 y 83.
  - Duran 3,6 s.
  - Se descartó la capa suave del original: tarda casi un segundo en sonar.

## guitarra · CC0 1.0

- **Obra:** Spanish Classical Guitar (guitarra de nailon), del proyecto FreePats.
- **Descarga:** https://freepats.zenvoid.org/Guitar/SpanishClassicalGuitar/SpanishClassicalGuitar-SFZ+FLAC-20190618.7z
- **Licencia verificada en:**
  - https://freepats.zenvoid.org/Guitar/acoustic-guitar.html: «Published under the terms of the Creative Commons CC0 1.0 public domain dedication.»
  - El paquete descargado trae `readme.txt` y `cc0.txt` con la misma licencia.
- **Crédito:** no hace falta (CC0). Si se quiere: «Spanish Classical Guitar, de FreePats (CC0)».
- **Contenido:**
  - 14 notas de MIDI 40 a 83 (E2–B5), cada 3–4 semitonos.
  - Duran 3,0 s como máximo.
  - Las notas desde 60 hacia arriba ya vienen cortas en el original y duran entre 2,4 y 1,0 s.

## Fuentes descartadas o no usadas

| Fuente | Motivo |
|---|---|
| Splendid Grand Piano (sfzinstruments/SplendidGrandPiano; danigb.github.io/samples) | El «dominio público» solo lo afirma un tercero en el README («released as public domain in early 2000 by Akai»). No hay fichero LICENSE ni ningún documento de Akai. No se puede verificar en la fuente original. |
| University of Iowa MIS (theremin.music.uiowa.edu/MIS.html) | No tiene una licencia estándar: usa una frase propia («may be downloaded and used for any projects, without restrictions»). No es CC0, dominio público ni CC BY. |
| jRhodes3c / jRhodes3d (sfzinstruments/jlearman.*) | Su LICENSE dice que las muestras son CC BY-NC (NC = no comercial; jRhodes3c pone además BY-NC-SA). Ojo: el README de danigb/samples lo etiqueta mal como CC0. |
| Greg Sullivan E-Pianos (sfzinstruments/GregSullivan.E-Pianos) | La licencia vale: CC BY 3.0 en el repositorio y CC BY 4.0 en sullivang.net. No se usó porque el Wurlitzer EP200 deja huecos de 5–7 semitonos dentro de una misma capa. Se eligió el TX81Z (CC0, una nota cada 4 semitonos). |
| Ovation Guitar (sfzinstruments/OvationGuitar) | El repositorio no declara ninguna licencia. |
| Guitarras de Karoryfer (Emilyguitar, Black And Green Guitars, Shinyguitar) | Son CC0, pero son eléctricas o de tapa arqueada (archtop). Se pedía una acústica de acero o de nailon. |

## bateria-acustica · CC0 1.0

- **Obra:** Big Rusty Drums, de Karoryfer Samples. Es una batería polaca de los años 80: bombo de 24", caja de 14", toms de 14", 18" y 22", charles de 14", crash de 17" y ride de 22". Las palmas, la pandereta, el cencerro, el shaker y las claves son de la Versilian Community Sample Library (VCSL), de Versilian Studios.
- **Descarga:**
  - https://github.com/sfzinstruments/karoryfer.big-rusty-drums/tree/main/Samples
  - https://github.com/sgossner/VCSL/tree/master/Idiophones/Struck%20Idiophones (carpetas Claps, Tambourine 1, Cowbells, Shaker, Large y Claves)
- **Licencia verificada en:**
  - https://github.com/sfzinstruments/karoryfer.big-rusty-drums/blob/main/LICENSE: «CC0 1.0 Universal». La API de GitHub también lo marca como `CC0-1.0`.
  - https://shop.karoryfer.com/pages/free-samples: «All our free sample libraries are under a Creative Commons Zero license.» Big Rusty Drums sale en esa lista.
  - https://github.com/sgossner/VCSL (README y LICENSE): «This collection is under a Creative Commons 0 license.»
- **Crédito:** no hace falta (CC0). Si se quiere: «Big Rusty Drums, de Karoryfer Samples, y VCSL, de Versilian Studios (CC0)».
- **Tratamiento (distinto del de los paquetes de arriba):**
  - No se reafina nada. Cada golpe junta los micrófonos del original con el balance por defecto del autor (programa `02-basic.sfz`) y se pasa a mono:
    - bombo: micro interior, más un 30 % de los aéreos filtrados por debajo de 300 Hz;
    - caja y aro: micro inferior 1, superior 0,4 y aéreos 0,6;
    - charles: cercano y aéreos a partes iguales;
    - crash, ride y campana: cercano 0,4 y aéreos 1;
    - toms: cercano 1 y aéreos 0,7.
  - No se normaliza cada capa. Todas las capas de una pieza llevan la misma ganancia y la más fuerte queda con un pico de −1 dBFS, así que las capas suaves siguen sonando más suaves, como en el original.
  - Luego se bajan algunas piezas para que suenen como un kit mezclado (en dB): aro −3, charles cerrado −4, charles de pedal −7,5, charles abierto −6, crash −4,5, ride −1, campana −1, tom agudo −1,5, tom medio −0,5, pandereta −9, cencerro −4,5 y shaker −7. El bombo, la caja, el tom grave, las palmas y las claves se quedan en −1 dBFS.
  - Si los dos round robins de una capa se llevan más de 3 LU, se igualan a la media de esa capa. Pasa en la capa 2 del crash y en la capa 1 de la campana.
  - El ataque empieza en el primer medio milisegundo y hay un fundido de salida. Son MP3 VBR `-q:a 2`, mono, 44,1 kHz.
- **Contenido** (nota General MIDI: capas × round robins):
  - 36 bombo: 3 × 2 (capas 4, 9 y 14 de 14). Dura de 0,7 a 1,1 s.
  - 37 aro (side stick): 2 × 2 (capas 2 y 4 de 4).
  - 38 caja, golpe al centro: 3 × 2 (capas 3, 7 y 10 de 10). Dura de 0,6 a 0,8 s.
  - 39 palmas (VCSL Claps): 1 × 2.
  - 42 charles cerrado, golpe de punta (`tc`): 3 × 2 (capas 2, 5 y 8 de 8). Dura 0,6 s.
  - 44 charles de pedal (`chik`): 2 × 2 (capas 3 y 5 de 5). Dura 0,6 s.
  - 46 charles abierto: es el «medio abierto» del original (`ho`): 2 × 2 (capas 2 y 4 de 4). Cae 40 dB en 1,8 s y cabe entero en 2,5 s.
  - 45 tom grave de 22" (45 Hz), 47 tom medio de 18" (64 Hz) y 50 tom agudo de 14" (96 Hz): 3 × 2 cada uno. Duran hasta 1,5 s.
  - 49 crash: 3 × 2 (capas 2, 3 y 5 de 5). Dura 4,5 s.
  - 51 ride: 3 × 2 (capas 3, 6 y 10 de 10). Dura 4,5 s.
  - 53 campana del ride: 2 × 2 (capas 2 y 4 de 4). Dura 3,5 s.
  - 54 pandereta (Tambourine 1): 2 × 1. 56 cencerro (Cowbell 1, golpe normal): 2 × 1. 70 shaker grande: 1 × 2. 75 claves (Claves 1): 2 × 1.
  - Tramos de fuerza: con 3 capas, 1-48, 49-96 y 97-127; con 2 capas, 1-80 y 81-127; con 1 capa, 1-127.
  - El crash y el ride suenan con su caída natural hasta unos 3 s y en el último 1,4-1,6 s llevan un fundido exponencial. En el original, los aéreos del crash tardan entre 4 y 8 s en caer 40 dB, así que a 4,5 s la cola está recortada.
- **Peso:** 74 ficheros, 1.320.908 bytes.

## cajon · CC0 1.0

- **Obra:** el cajón es de la Versilian Community Sample Library (VCSL), de Versilian Studios. Las palmas y los pitos son de «Body percussion», de D. Smolken (repositorio de sfzinstruments).
- **Descarga:**
  - https://github.com/sgossner/VCSL/tree/master/Idiophones/Struck%20Idiophones/Cajon
  - https://github.com/sfzinstruments/body_percussion/tree/main/Samples/body
- **Licencia verificada en:**
  - https://github.com/sgossner/VCSL (README y LICENSE): «This collection is under a Creative Commons 0 license.»
  - https://github.com/sfzinstruments/body_percussion: el LICENSE dice «CC0 1.0 Universal» y `readme.txt` dice «CC 0 license.» La API de GitHub lo marca como `CC0-1.0`.
- **Crédito:** no hace falta (CC0). Si se quiere: «Cajón de la VCSL, de Versilian Studios, y Body percussion, de D. Smolken (CC0)».
- **Tratamiento:** el mismo que en `bateria-acustica` (mono, sin reafinar, el ataque en el primer medio milisegundo, fundido de salida y MP3 VBR `-q:a 2`).
  - Los tres golpes del cajón llevan una sola ganancia. Así se respeta la diferencia de volumen del original entre el grave, el slap y el golpe suave, y el más fuerte queda con un pico de −1 dBFS.
  - Las palmas y los pitos se ajustan aparte: palma seca −1 dB, palma sorda −3 dB y pito −4 dB.
  - A los pitos se les quita lo que hay por debajo de 120 Hz, que son golpes graves del micrófono.
  - Los dos pitos se llevaban más de 3 LU y se igualaron a su media.
- **Contenido** (nota: capas × round robins):
  - 36 grave (centro): 3 × 2 (golpe `hit3` de la VCSL: p, mp y f).
  - 38 slap (esquina): 3 × 2 (golpe `hit1`: mp, f y fff).
  - 37 golpe suave: 2 × 2 (golpe `hit2`: pp y mp).
  - 39 palma seca: 2 × 2 (`fingerclap`, dedos contra la palma).
  - 42 palma sorda: 2 × 2 (`handclap`, palmas planas).
  - 46 pito (chasquido de dedos): 1 × 2 (`snap_r`).
  - Duran entre 0,5 y 0,9 s. Tramos de fuerza como en `bateria-acustica`.
- **Avisos:**
  - La VCSL no dice qué golpe es cada uno. Se han identificado por su espectro: `hit1` tiene unos 10 dB más de medios y agudos (slap) y `hit2` y `hit3` son graves.
  - El «golpe suave» es un grave flojo, no un toque fantasma con los dedos.
  - Las palmas no son palmas flamencas grabadas como tales. La «seca» es la palmada de dedos contra la palma y la «sorda» es una palmada normal, con algo más de agudos que una sorda de verdad.
- **Peso:** 26 ficheros, 152.713 bytes.

## percusion-latina · CC0 1.0

- **Obra:**
  - De la Versilian Community Sample Library (VCSL), de Versilian Studios: bongós, quinto y tumba, cencerro, claves, güiro, shaker y pandereta.
  - De Virtuosity Drums, de Versilian Studios y Karoryfer Samples: los timbales, que grabó Karoryfer.
- **Descarga:**
  - https://github.com/sgossner/VCSL/tree/master/Membranophones/Struck%20Membranophones (Bongos y Conga)
  - https://github.com/sgossner/VCSL/tree/master/Idiophones/Struck%20Idiophones (Cowbells, Claves, Guiro, Shaker, Large y Tambourine 1)
  - https://github.com/sfzinstruments/virtuosity_drums/tree/master/Samples/perc/oh/timbales
- **Licencia verificada en:**
  - https://github.com/sgossner/VCSL (README y LICENSE): «This collection is under a Creative Commons 0 license.»
  - https://github.com/sfzinstruments/virtuosity_drums/blob/master/LICENSE: «CC0 1.0 Universal». La API de GitHub también lo marca como `CC0-1.0`.
  - https://shop.karoryfer.com/pages/free-samples: «All our free sample libraries are under a Creative Commons Zero license.» Virtuosity Drums sale en esa lista.
- **Crédito:** no hace falta (CC0). Si se quiere: «VCSL, de Versilian Studios, y Virtuosity Drums, de Versilian Studios y Karoryfer Samples (CC0)».
- **Tratamiento:** el mismo que en `bateria-acustica` (los timbales vienen a 48 kHz y se pasan a 44,1 kHz).
  - El quinto abierto y el apagado llevan la misma ganancia, y los dos timbales también. El resto de piezas tiene la suya, con la capa más fuerte a −1 dBFS.
  - Las piezas pequeñas se bajan para que no tapen a los parches: pandereta −9 dB, cencerro −4,5 dB, shaker −7 dB y güiro −2 dB.
  - La VCSL trae algunos round robins muy desiguales, de hasta 6 dB. Se han igualado a la media de su capa: bongó agudo (capas 2 y 3), bongó grave (las tres), conga abierta (capa 3), tumba (capa 3) y güiro.
- **Contenido** (nota General MIDI: capas × round robins):
  - 60 bongó agudo y 61 bongó grave: 3 × 2 cada uno.
  - 62 conga apagada (quinto, golpe apagado): 2 × 2.
  - 63 conga abierta (quinto, unos 215 Hz): 3 × 2.
  - 64 conga grave (tumba, unos 138 Hz): 3 × 2.
  - 65 timbal agudo de 13" y 66 timbal grave de 14": 3 × 2 cada uno.
  - 73 güiro corto: 1 × 2. 70 shaker grande: 1 × 2.
  - 56 cencerro: 2 × 1. 75 claves: 2 × 1. 54 pandereta: 2 × 1.
  - Duran entre 0,6 y 1,0 s. Tramos de fuerza como en `bateria-acustica`.
- **Avisos:**
  - La VCSL no tiene slap de conga. La nota 62 es el golpe apagado, que es lo que pide General MIDI («Mute Hi Conga»).
  - La conga del medio de la VCSL (unos 164 Hz) no se usa: queda a 3 semitonos de la tumba.
  - De la tumba se descartó la capa más suave, porque uno de sus golpes está casi en silencio (−58 dBFS).
- **Peso:** 50 ficheros, 388.166 bytes.

## Fuentes de percusión descartadas o no usadas

| Fuente | Motivo |
|---|---|
| SM Drums (sfzinstruments/SMDrums) | Ni el repositorio ni su manual (`Sforsand Manual.pdf`) declaran una licencia. No se puede verificar el «dominio público». |
| Unruly Drums (Karoryfer, CC0) | Todas las piezas llevan bordonero, también el bombo. No sirve como kit normal. |
| Swirly Drums (Karoryfer, CC0) | Es un kit tocado con escobillas. Para un kit general encaja mejor uno tocado con baquetas. |
| Kit de Virtuosity Drums (Versilian y Karoryfer, CC0) | Es un kit de jazz con solo dos toms. Solo se usaron sus timbales. |
| DrumGizmo DRSKit y MuldjordKit, Naked Drums de Wilkinson Audio (sfzinstruments, CC BY 4.0) | La licencia vale, pero no hicieron falta: Big Rusty Drums es CC0 y trae todas las piezas. |
| Platillos y bombo de la VCSL | Son de orquesta (platillo suspendido con maza y bombo de concierto), no de batería. |
| Palmas en Freesound | En una búsqueda rápida no salieron palmas sordas sueltas con licencia CC0 comprobable. No se siguió buscando. |

## bajo-dedos · CC0 1.0

- **Obra:** Swagbass, de Karoryfer Samples (tocado y mapeado por D. Smolken). Es un Ibanez BTB-400QM con cuerdas planas viejas (d'Addario Chromes), grabado en directo con la pastilla del mástil y la ecualización plana.
- **Descarga:** https://github.com/sfzinstruments/karoryfer.swagbass/tree/master/notes
- **Licencia verificada en:**
  - https://github.com/sfzinstruments/karoryfer.swagbass/blob/master/LICENSE: «CC0 1.0 Universal». La API de GitHub también lo marca como `CC0-1.0`.
  - https://shop.karoryfer.com/pages/free-samples: «All our free sample libraries are under a Creative Commons Zero license.» Swagbass sale en esa lista.
- **Crédito:** no hace falta (CC0). Si se quiere: «Swagbass, de Karoryfer Samples (CC0)».
- **Tratamiento** (es el mismo en los ocho paquetes de bajos e instrumentos melódicos):
  - De cada nota y capa se elige la toma (round robin) más típica: sin recortes digitales, con el volumen y el brillo más cercanos a la mediana.
  - Mono a 44,1 kHz. Si los dos canales se parecen poco (correlación por debajo de 0,5), se usa solo el más fuerte para evitar el filtrado en peine.
  - Paso alto suave por debajo de la mitad de la fundamental (quita ruido grave de sala sin tocar la nota).
  - El ataque empieza en el primer medio milisegundo (umbral de −45 dB) con un fundido de entrada de 0,4 ms. Fundido de salida al final.
  - Reafinadas al temperamento igual. La altura se mide con la media de los armónicos 1 a 4 y con YIN; quedan a menos de ±3 cents. Se comprueba además que la nota medida es la del nombre.
  - Niveles: la capa fuerte tiene el pico a −1 dBFS y las notas que suenan más que la mediana de su capa (sonoridad ponderada K, primeros 0,4 s) se bajan hasta ella. La capa suave queda por debajo de la fuerte lo mismo que en el original (mediana entre notas, como mucho 10 dB).
  - MP3 VBR `-q:a 2`.
- **Contenido:**
  - 12 notas cada 3 semitonos, de MIDI 27 a 60 (Mi♭1 a Do4), en dos capas.
  - `NN-v1.mp3` es la capa p del original (fuerza 1-63) y `NN-v2.mp3` la capa f (fuerza 64-127). La capa suave queda 5,6 dB por debajo.
  - Duran 2,3 s (cortadas mientras suenan, con fundido de 0,4 s).
  - Afinación del original: entre −9 y +9 cents.
- **Avisos:**
  - Se eligió por cómo suena: es redondo y cálido (centroide espectral de unos 520 Hz en la capa fuerte, frente a 1.700 Hz del Growlybass de `bajo`), casi sin ruido por encima de 4 kHz y con presencia suficiente entre 300 Hz y 1 kHz para oírse en el altavoz de un móvil.
  - La capa p del original es bastante más oscura que la f.
- **Peso:** 24 ficheros, 494.435 bytes.

## bajo-pua · CC0 1.0

- **Obra:** Pastabass, de Karoryfer Samples (Squier Bass VI grabado por el usuario de KVR spacecoyote; edición y mapeo de D. Smolken). Articulación «linguine»: cuerdas planas, púa y pastilla del puente.
- **Descarga:** https://github.com/sfzinstruments/karoryfer.pastabass/tree/master/samples/linguine
- **Licencia verificada en:**
  - https://github.com/sfzinstruments/karoryfer.pastabass/blob/master/LICENSE: «CC0 1.0 Universal». La API de GitHub también lo marca como `CC0-1.0`.
  - https://shop.karoryfer.com/pages/free-samples: «All our free sample libraries are under a Creative Commons Zero license.» Pastabass sale en esa lista.
- **Crédito:** no hace falta (CC0). Si se quiere: «Pastabass, de Karoryfer Samples (CC0)».
- **Tratamiento:** el mismo que en `bajo-dedos`.
- **Contenido:**
  - 11 notas cada 3 semitonos, de MIDI 28 a 58 (Mi1 a Si♭3), en dos capas.
  - `NN-v1.mp3` es la capa `vl2` del original (fuerza 1-63) y `NN-v2.mp3` la capa `vl3` (fuerza 64-127). La capa suave queda 3,6 dB por debajo, como en el original.
  - Duran 2,3 s.
- **Avisos:**
  - Se eligió por cómo suena: tiene el golpe de púa bien marcado (de 28 a 49 dB más agudos en los primeros 25 ms que en el resto de la nota) y más brillo que `bajo-dedos`, sin el chisporroteo del Growlybass.
  - El mapa SFZ del original pone cada muestra una octava por encima de lo que suena (`e2` en la tecla 40). Aquí los ficheros llevan la nota que suena de verdad: `e2` es 28.
  - El arranque de la púa (el roce antes de soltar la cuerda) dura de 1 a 5 ms. Es parte del ataque y no se ha quitado.
  - Las tomas `vl3` del original tienen algunas muestras recortadas digitalmente en el pico. Se eligieron las que menos: quedan 3 a 28 muestras recortadas en las notas 46, 52, 55 y 58 de la capa fuerte. No se oye.
  - En un Bass VI la fundamental pura queda unos cents por debajo del resto de armónicos (inarmonía de las cuerdas). La afinación se ha centrado en la altura que se oye (media de armónicos y YIN).
- **Peso:** 22 ficheros, 460.367 bytes.

## contrabajo · CC0 1.0

- **Obra:** «D. Smolken's double bass», el primer contrabajo de D. Smolken (Karoryfer). Es un contrabajo Otto Rubner de 1958, afinado por quintas, con cuerdas Thomastik Spirocore. Se usa la articulación en pizzicato.
- **Descarga:** https://github.com/sfzinstruments/dsmolken.double-bass/tree/master/pizz
- **Licencia verificada en:**
  - https://github.com/sfzinstruments/dsmolken.double-bass/blob/master/LICENSE: «CC0 1.0 Universal». La API de GitHub también lo marca como `CC0-1.0`.
  - El autor cambió la licencia a CC0 el 4 de noviembre de 2022 (commit de D. Smolken «Create LICENSE», con el mensaje «Swapping to CC0»). Antes era CC BY 4.0, que también valdría.
  - https://shop.karoryfer.com/pages/free-samples: «All our free sample libraries are under a Creative Commons Zero license.» Sale como «D. Smolken's first double bass library».
- **Crédito:** no hace falta (CC0). Si se quiere: «Double bass, de D. Smolken (CC0)».
- **Tratamiento:** el mismo que en `bajo-dedos`.
- **Contenido:**
  - 10 notas cada 3 o 4 semitonos, de MIDI 27 a 57 (Mi♭1 a La3): 27, 31, 34, 38, 41, 45, 48, 52, 55 y 57.
  - `NN-v1.mp3` es la capa p del original (fuerza 1-63) y `NN-v2.mp3` la capa m (fuerza 64-127). La capa suave queda 7,5 dB por debajo. La capa f del original no se usa.
  - Duran 2,3 s. Las dos notas 57 son más cortas (1,8 y 2,0 s) porque el original se apaga antes.
- **Avisos:**
  - Afinación del original: entre −28 y +6 cents. El Mi♭1 estaba 20 a 28 cents bajo.
  - Se descartaron Meatbass (es el mismo contrabajo, pero suena mucho más oscuro y casi no se oye en un móvil) y Sneakybass (tocado muy flojo, también muy oscuro).
- **Peso:** 20 ficheros, 280.614 bytes.

## metales · CC0 1.0

- **Obra:** VS Chamber Orchestra: Community Edition (VSCO 2 CE), de Versilian Studios. Grabación de Sam Gossner y Simon Dalzell; edición de Elan Hickler (Soundemote).
  - Trombón: «OldTrombone», notas sostenidas (`Sustain`).
  - Trompeta: «Trumpet», notas sostenidas (`sus`).
- **Descarga:** https://github.com/sgossner/VSCO-2-CE/tree/master/Brass (carpetas `OldTrombone/Sustain` y `Trumpet/sus`)
- **Licencia verificada en:** https://github.com/sgossner/VSCO-2-CE/blob/master/LICENSE: «CC0 1.0 Universal». La API de GitHub también lo marca como `CC0-1.0`.
- **Crédito:** no hace falta (CC0). Si se quiere: «VS Chamber Orchestra: Community Edition, de Versilian Studios (CC0)».
- **Tratamiento:** el mismo que en `bajo-dedos`.
- **Contenido:**
  - 14 notas, cada 3 o 4 semitonos, en dos capas.
  - Trombón de MIDI 41 a 60 (Fa2 a Do4): 41, 45, 48, 51, 53, 57 y 60. Capa suave `v3` y fuerte `v4` del original.
  - Trompeta de MIDI 63 a 84 (Mi♭4 a Do6): 63, 67, 70, 74, 77, 81 y 84. Capa suave `v1` y fuerte `v3` del original.
  - `NN-v1.mp3` es la capa suave (fuerza 1-63) y `NN-v2.mp3` la fuerte (fuerza 64-127). La suave queda 9,9 dB por debajo, como en el original.
  - Duran 3,2 s, con fundido de salida de 0,5 s.
- **Avisos:**
  - VSCO nombra las notas con Do3 = 60. Aquí van con el número MIDI que suena.
  - El trombón y la trompeta son instrumentos distintos: el cambio de timbre está entre la nota 60 y la 63.
  - Las capas suaves del trombón (`v2`) crecen durante el primer segundo y no se usaron. Las `v5` son las más fuertes, pero algunas tardan 200 ms en sonar.
- **Peso:** 28 ficheros, 1.219.848 bytes.

## pizzicato · CC0 1.0

- **Obra:** VS Chamber Orchestra: Community Edition (VSCO 2 CE), de Versilian Studios: sección de chelos (`Cello Section/pizzT`) y sección de violines (`Violin Section/Pizz`).
- **Descarga:** https://github.com/sgossner/VSCO-2-CE/tree/master/Strings
- **Licencia verificada en:** https://github.com/sgossner/VSCO-2-CE/blob/master/LICENSE: «CC0 1.0 Universal». La API de GitHub también lo marca como `CC0-1.0`.
- **Crédito:** no hace falta (CC0). Si se quiere: «VS Chamber Orchestra: Community Edition, de Versilian Studios (CC0)».
- **Tratamiento:** el mismo que en `bajo-dedos`, pero cada nota dura hasta que se apaga (−55 dB), con un máximo de 2,5 s.
- **Contenido:**
  - 14 notas cada 3 o 4 semitonos, en dos capas.
  - Chelos de MIDI 36 a 57 (Do2 a La3): 36, 40, 43, 47, 50, 53 y 57.
  - Violines de MIDI 62 a 83 (Re4 a Si5): 62, 66, 69, 72, 76, 79 y 83.
  - `NN-v1.mp3` es la capa `v1` del original (fuerza 1-63) y `NN-v2.mp3` la `v2` (fuerza 64-127). La suave queda 9,8 dB por debajo, como en el original.
  - Duran entre 0,5 s (violines agudos) y 2,5 s (chelos graves).
- **Avisos:**
  - Es una sección: cada músico está un poco desafinado respecto a los demás. La afinación se ha medido con la media de los armónicos; la fundamental de algunas notas varía hasta ±20 cents dentro del mismo golpe.
  - Entre la nota 57 y la 62 hay 5 semitonos (cambio de chelos a violines).
  - Los micrófonos del original están muy separados; en 13 de las 28 muestras se usa un solo canal.
- **Peso:** 28 ficheros, 330.962 bytes.

## marimba · CC0 1.0

- **Obra:** marimba de la Versilian Community Sample Library (VCSL), de Versilian Studios (muestras `Marimba_hit_Outrigger`).
- **Descarga:** https://github.com/sgossner/VCSL/tree/master/Idiophones/Struck%20Idiophones/Marimba
- **Licencia verificada en:** https://github.com/sgossner/VCSL (README y LICENSE): «This collection is under a Creative Commons 0 license.» La API de GitHub marca el LICENSE como `CC0-1.0`.
- **Crédito:** no hace falta (CC0). Si se quiere: «Marimba de la VCSL, de Versilian Studios (CC0)».
- **Tratamiento:** el mismo que en `bajo-dedos`, pero cada nota dura hasta que se apaga (−55 dB), con un máximo de 2,5 s. Aquí la afinación se mide con la fundamental, que en la marimba es limpia y fuerte.
- **Contenido:**
  - 10 notas de MIDI 41 a 96 (Fa2 a Do7): 41, 48, 55, 59, 65, 72, 79, 83, 89 y 96.
  - `NN-v1.mp3` es el golpe `med` (fuerza 1-63) y `NN-v2.mp3` el golpe `loud` (fuerza 64-127). En el original se llevan 11,5 dB; aquí se ha dejado en 10 dB.
  - Duran entre 0,4 s (notas agudas) y 2,5 s (graves, cortadas con fundido).
- **Avisos:**
  - El original solo tiene estas 10 notas: hay huecos de hasta 7 semitonos (41 a 48, 48 a 55, 65 a 72 y 72 a 79), así que algunas notas se tocan hasta 3,5 semitonos desplazadas.
  - La VCSL nombra las notas con Do3 = 60. Aquí van con el número MIDI que suena.
  - Las notas agudas venían muy flojas en el original (hasta −40 dBFS) y al subirlas se oía el ruido grave de la sala; el paso alto que sigue a la nota lo quita.
- **Peso:** 20 ficheros, 202.251 bytes.

## organo · CC0 1.0

- **Obra:** órgano renacentista de la Versilian Community Sample Library (VCSL), de Versilian Studios. Registro lleno («Full»), toma de sala («Room»).
- **Descarga:** https://github.com/sgossner/VCSL/tree/master/Aerophones/Edge-blown%20Aerophones/Renaissance%20Organ/Full
- **Licencia verificada en:** https://github.com/sgossner/VCSL (README y LICENSE): «This collection is under a Creative Commons 0 license.» La API de GitHub marca el LICENSE como `CC0-1.0`.
- **Crédito:** no hace falta (CC0). Si se quiere: «Renaissance Organ de la VCSL, de Versilian Studios (CC0)».
- **Tratamiento:** el mismo que en `bajo-dedos`, con una sola capa.
- **Contenido:**
  - 13 notas cada 4 semitonos, de MIDI 36 a 84 (Do2 a Do6), en una capa (fuerza 1-127).
  - Duran 3,6 s, con fundido de salida de 0,5 s. El órgano no cambia de volumen mientras suena (±1 dB).
- **Avisos:**
  - Es un órgano de tubos, no un órgano eléctrico.
  - En el registro lleno las octavas (4' y 2') suenan fuerte. En la nota más aguda (84) la fundamental queda unos 18 dB por debajo de la octava superior, y alguien podría oír esa nota una octava más alta.
  - La VCSL nombra las notas con Do3 = 60. Aquí van con el número MIDI que suena.
- **Peso:** 13 ficheros, 606.189 bytes.

## guitarra-acero · CC0 1.0

- **Obra:** guitarra acústica de cuerdas de acero Martin HD-28 (Vintage Series, de 2017), grabada por Jeff Learman para el Discord SFZ GM Bank (muestras `MartinGM2`).
- **Descarga:** https://github.com/sfzinstruments/Discord-SFZ-GM-Bank/tree/master/Discord%20GM/Melodic/026-Acoustic%20Guitar%20(steel)
- **Licencia verificada en:**
  - https://github.com/sfzinstruments/Discord-SFZ-GM-Bank/blob/master/Discord%20GM/Melodic/026-Acoustic%20Guitar%20(steel).sfz: la cabecera dice «Author: Jeff Learman» y «License: Creative Commons CC0».
  - El SFZ y las 15 muestras los subió el propio Jeff Learman (commit 05d5ed8 del 18 de octubre de 2020). En `Discord GM/tools/GM-plan.txt` el instrumento se llama «jMartin HD28», con la «j» de sus otros instrumentos.
  - https://github.com/sfzinstruments/Discord-SFZ-GM-Bank (README): «The creator's license terms can be found in the .sfz file for the instrument.»
  - https://www.kvraudio.com/forum/viewtopic.php?p=9179000 (JeffLearman, 14 de noviembre de 2022): «The Rhodes and acoustic guitar are CC0 for sure because I released them».
- **Crédito:** no hace falta (CC0). Si se quiere: «Martin HD-28, de Jeff Learman, Discord SFZ GM Bank (CC0)».
- **Tratamiento:** el mismo que en `bajo-dedos`, con una sola capa. Cada nota dura hasta que se apaga (−50 dB), con un máximo de 3,0 s.
- **Contenido:**
  - 15 notas cada 3 semitonos, de MIDI 40 a 83 (Mi2 a Si5), en una capa (fuerza 1-127).
  - Duran entre 0,7 s (Si5) y 3,0 s. Varias notas ya vienen cortas en el original y llevan un fundido al final: las agudas duran de 0,7 a 2 s.
- **Avisos:**
  - El repositorio no tiene un fichero LICENSE general: cada instrumento declara su licencia en su SFZ. La de esta guitarra la declara su autor y la confirma en el foro de KVR.
  - Otros instrumentos del mismo autor tienen otra licencia (jRhodes3c y jRhodes3d son CC BY-NC, ver la tabla de fuentes descartadas). No afecta a esta guitarra.
  - La guitarra del original estaba afinada baja, entre −16 y −4 cents.
  - Es una sola capa: la fuerza solo cambia el volumen.
- **Peso:** 15 ficheros, 325.173 bytes.

## Fuentes de bajos e instrumentos melódicos descartadas o no usadas

| Fuente | Motivo |
|---|---|
| Fashionbass (Karoryfer, CC0) | La licencia vale. Bajo con cuerdas entorchadas: más brillante y con más chasquido de dedo que Swagbass; no es el sonido redondo que se pedía. |
| Black And Blue Basses (Karoryfer, CC0) | La licencia vale. El negro (dedos) es muy oscuro: sus notas graves casi no tienen nada por encima de 300 Hz y no se oirían en un móvil. El azul (púa) también es oscuro y su golpe de púa se nota menos que en Pastabass. |
| Pastabass «fetuccine» y «spaghetti» (Karoryfer, CC0) | «fetuccine» (dedos) es tan oscuro como el bajo negro. De «spaghetti» el README no dice si es con púa o con dedos. |
| Growlybass (Karoryfer, CC0) | Es el bajo actual de `bajo`. Tiene mucha energía entre 1 y 4 kHz y por encima de 4 kHz (el «gruñido»), y la cuerda de Mi venía 25 cents alta. |
| Meatbass y Sneakybass (Karoryfer, CC0) | La licencia vale. Mismo contrabajo que `contrabajo`, pero mucho más oscuros. |
| Contrabajo solista de VSCO 2 CE (pizzicato, CC0) | La licencia vale. Notas sueltas y desiguales, muchas con una sola capa y muy flojas. |
| Bass Guitar YR de FreePats (Yamaha RBX, dedos y púa, CC0) | La licencia vale, pero solo cubre una octava (MIDI 28 a 40) en una sola capa. |
| FSS Steel-String Acoustic Guitar de FreePats | Licencia GPL 3 con excepción. No vale. |
| Terkelsen.Marimba (sfzinstruments) | El repositorio no declara ninguna licencia. |
| Xilófono de la VCSL (CC0) | La licencia vale, pero hay marimba, y el xilófono tiene una muestra cada 5 o 7 semitonos. |
| Pizzicato del Discord SFZ GM Bank (mezcla de VSCO y VCSL, CC0) | Una sola capa, y las tres muestras más agudas no suenan en la nota de su nombre. |
| Órgano de tubos «Loud» y «Quiet» de la VCSL (CC0) | La licencia vale. El volumen sube y baja mientras suena y los dos micrófonos casi no se parecen (correlación cercana a 0). Se usó el órgano renacentista. |
| Drawbar Organ Emulation de FreePats (CC0) | La licencia vale. Es un órgano tipo Hammond grabado del sintetizador setBfree; se prefirió un órgano de tubos grabado, porque el eléctrico se puede sintetizar. |
| Church Organ Emulation de FreePats (CC0) | La licencia vale. Grabado del emulador Aeolus, una muestra cada 6 semitonos y desafinado unos 10 cents. |

## Dónde suenan también

Desde el 22 de noviembre de 2026, las muestras de `bateria-acustica`, `cajon` y `percusion-latina` suenan también fuera de «Tocar»: en los ritmos de la hoja «Ritmos», en la claqueta y sus ritmos de fondo, en los ritmos convertidos en pista y en las piezas que le faltan a un kit (`src/lib/instrumentos/percusion.ts`). Son los mismos ficheros y las mismas licencias: no hay muestras nuevas.
