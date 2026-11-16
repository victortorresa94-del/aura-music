# Compás · documento de producto

Última revisión: 16 de noviembre de 2026 (v0.2, el músico de sesión).

## La meta

**El estudio del futuro para hacer canciones: tocas tú y la banda viene sola.**

Grabas una guitarra y te sale un bajo que va contigo. Después una batería,
unas teclas. Sin saber producir, sin abrir un DAW de escritorio, desde el
móvil y a tu tempo. La tesis de agosto sigue en pie («la mejor herramienta
del mundo para maquetar canciones», ver `docs/historia/PLAN.md`); lo que
cambia es que el «sonar mejor de lo que has tocado» deja de ser el punto 4 y
pasa a ser el motivo para abrir la app.

## Por qué ahora, y por qué nosotros

- **Lo que se puede comprar ya existe.** Moises Studio (1-sep-2026) y Fender
  Studio Pro 8.1 con Moises dentro (junio de 2026) generan pistas sobre tu
  grabación. Suno Studio 2.0 también, sin API pública. Competir con ellos en
  «un DAW con IA» es perder.
- **Lo que no existe es esto:** que la máquina se adapte a TU compás y no al
  revés. Moises te pide una canción, Suno te pide un prompt; **Compás te pide
  que toques.** Y sabe contar doce: ninguno de ellos acompaña una bulería.
- **La primitiva técnica ya es abierta.** ACE-Step 1.5 (MIT) tiene la tarea
  `lego`: le das tu toma y genera una pista nueva escuchándola. Nadie la ha
  puesto en el móvil.

## Para quién

Quien compone con un instrumento en la mano y hoy acaba en las Notas de Voz:
cantautores, guitarristas, gente de flamenco y de rumba, productores que
quieren maquetar una idea antes de que se vaya. El que ya produce en Logic o
Studio Pro también: Compás es el sitio donde nace la idea, y la exporta.

## Qué hace la v0.2

1. **Te escucha.** De una toma saca el tempo a la décima, dónde cae el pulso,
   la tonalidad (con lectura flamenca: «Mi frigio · por arriba») y los
   acordes, pulso a pulso.
2. **Te toca un bajo al momento.** Cinco estilos (raíz y quinta, a negras,
   raíz larga, caminante y al compás) que siguen tus acordes. En el móvil, sin
   red, en menos de un segundo.
3. **O te lo toca la IA.** ACE-Step escucha tu toma y toca un bajo de verdad
   en unos 30 segundos. Se cuadra a tu pulso antes de entrar.
4. **Sigue tu tempo.** Si tocaste libre, el proyecto pasa a tu tempo.

### Cómo se sabe que funciona (definición de hecho)

- Grabas ocho compases de guitarra rasgueada sin claqueta, abres el músico de
  sesión y lee el tempo con menos de 0,2 BPM de error y la progresión bien.
- El bajo al momento entra a compás de principio a fin de la toma.
- El bajo de la IA entra con menos de 10 ms de desfase.

Las tres están cubiertas por tests (`src/lib/musico/*.test.ts`), y la tercera
se comprobó en el navegador con el servidor falso el 16-nov.

## Lo que viene, por orden

| Fase | Qué | Por qué en este orden |
|---|---|---|
| 1 | **Probarlo con tomas reales** de Víctor (guitarra, bulería, rumba) y medir | Los tests usan guitarras sintéticas; el oído tiene que pasar por tomas de verdad antes que nada más |
| 2 | **ACE-Step en una GPU de verdad** (ver `docs/ACESTEP.md`) y escuchar si el bajo de la IA convence | Es el único punto que no se puede comprobar sin GPU |
| 3 | **Tonalidad desde los acordes.** Hoy la cadencia andaluza confunde al detector de tonalidad (sale con confianza cero y no se enseña) | Los acordes ya se leen bien; deducir la tonalidad de ellos es más fiable que del croma |
| 4 | **Batería y teclas con IA.** El adaptador ya acepta los ocho instrumentos de ACE-Step; falta la interfaz | Un instrumento cada vez, escuchando el resultado |
| 5 | **Estirar el tiempo** de lo generado cuando el modelo se va de tempo (Signalsmith Stretch, MIT) | Hoy solo se corrige el desfase, no la deriva |
| 6 | **Cuentas y límite por persona** antes de abrirlo al público | Hoy las rutas solo responden a la propia app; con una GPU detrás, eso no basta |
| 7 | **Exportar a DAW** (DAWproject) con tempo, marcadores y pistas | Para que el que produce en Studio Pro siga allí |

## Lo que NO vamos a hacer

- Un DAW de escritorio. Ya está resuelto, y Moises ha llegado antes.
- Generar canciones enteras desde un texto. Eso es Suno; aquí se toca.
- Llamar a Suno por wrappers no oficiales. Hay riesgo de términos de uso y
  de que corten el acceso cualquier día.

## Riesgos, dichos a la cara

- **Los modelos no cuadran a compás por diseño.** Se mide y se corrige el
  desfase; la deriva de tempo todavía no.
- **El origen de los datos de entrenamiento de ACE-Step** hay que revisarlo
  antes de publicar comercialmente lo que genere. El código y los pesos son
  MIT; eso no dice nada de los datos.
- **Publicar con IA:** Spotify pide declararlo en los créditos (vía
  distribuidora), Apple Music y YouTube lo etiquetan. Lo 100 % IA no tiene
  copyright en EE. UU.; una guitarra tuya con un bajo de IA es obra humana con
  partes de IA.
- **La GPU cuesta aunque falle.** Hay que poner límites antes de abrirlo.
