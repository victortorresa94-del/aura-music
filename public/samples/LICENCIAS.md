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
