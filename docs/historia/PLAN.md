# Estudio — plan de trabajo

Documento vivo. Vive en el repo a propósito: las conversaciones se pierden, esto no.

Última revisión: 15 de agosto de 2026.

---

## 1. Qué es

Una herramienta para **maquetar ideas musicales en el móvil**. Grabas una idea
por capas, le pones una base encima para improvisar, y la sacas de tu cabeza
antes de que se te olvide.

**Qué NO es**, y conviene repetirlo cada vez que se decida algo:

- No es para producir ni masterizar. Si una decisión mejora la calidad final
  pero encarece llegar a la primera toma, se descarta.
- No es una app de separar canciones. Eso es Moises, y entra por otra puerta.
- No es un DAW de escritorio en pequeño. El escritorio ya está resuelto.

## 2. La tesis

**La mejor herramienta del mundo para maquetar canciones.**

Esa es la meta y no se rebaja. En una revisión anterior de este documento la
rebajé por mi cuenta a "la única herramienta que sabe tu compás": eso es una
función, no una tesis, y estrechar el producto no era una decisión que me
correspondiera tomar. Queda corregido.

Maquetar una canción es un oficio completo: se te ocurre algo, lo capturas
antes de que se te olvide, le pones capas encima, lo escuchas, lo cambias, lo
recortas, y acabas con algo que puedes enseñar. Ese oficio entero es el
producto. Ninguna app lo hace bien hoy en el móvil, y por eso la mayoría de los
músicos acaba en las Notas de Voz.

### Contra quién se mide

| Rival | Qué gana él | Qué perdemos si no lo igualamos |
|---|---|---|
| **Notas de Voz** | Cero fricción. Está en el móvil, no hay que instalar nada, un toque y graba | Si tardamos más que ellas en capturar la idea, no nos abren |
| **GarageBand** | Potencia, instrumentos, gratis en iOS | Si al maquetar nos quedamos cortos, se van a la mitad |
| **Songzap** | Está enfocada exactamente en esto y lo tiene pulido | Es el listón de producto, hay que estudiarla entera |
| **Un DAW de escritorio** | Lo puede todo | No hay que igualarlo: hay que hacer innecesario abrirlo hasta el final |

**Ganar es esto: la fricción de las Notas de Voz con el resultado de un DAW.**
Un toque para empezar a grabar, y a los diez minutos una maqueta con cuatro
capas cuadradas que se puede enviar por WhatsApp sin pedir perdón.

### Las cinco cosas que hay que ganar

Por orden de lo que decide si un músico vuelve mañana:

1. **Capturar sin fricción.** Abrir y estar grabando. Cero configuración, cero
   permisos que se piden a destiempo, cero pantallas intermedias.
2. **Grabar encima sin desfase.** El dolor original y el único punto donde no
   se admite "casi". Si la segunda capa no cuadra con la primera, todo lo
   demás sobra.
3. **Editar con los dedos.** Mover, recortar, repetir, subir, silenciar,
   deshacer. Con una mano y sin apuntar con precisión de cirujano.
4. **Sonar mejor de lo que has tocado.** Aquí entra todo lo demás:
   acompañamiento, ritmos, mezcla decente, generación. El chute está en
   escucharte y pensar "esto es mejor de lo que me esperaba".
5. **No perder nunca nada.** Es la queja número uno de todos los competidores.
   Un músico perdona un sonido regular; no perdona perder una idea.

### Dónde somos mejores que nadie

No sustituye a la tesis, la sirve. Son las armas concretas:

- **El compás de verdad.** Un ciclo de doce con acentos en 12, 3, 6, 8 y 10 no
  es 4/4, no es 6/8 y no es un preset: es otra gramática. GarageBand solo
  admite 4/4, 3/4 y 6/8, y a Logic Pro 12 la crítica de CDM le llama "una
  lectura completamente occidentalizada de la estructura musical". Detrás del
  flamenco vienen el 6/8 africano, los amalgamados balcánicos, el tala indio y
  el joropo.
- **Te escucha a ti.** Las apps que sí saben de palos (Compás, Flamenco Compás)
  son metrónomos tontos: tú les pones el tempo. Aquí el tempo y la tonalidad
  salen de lo que acabas de tocar.
- **Web, no tienda.** Se abre con un enlace, se instala sin App Store, funciona
  en iPhone y en Android con el mismo código, y se actualiza el mismo día.
  Ninguno de los rivales puede mandarte su app por WhatsApp.
- **La maqueta es un objeto que se enseña.** Nadie ha resuelto que enseñar una
  idea a medias no dé vergüenza. Ahí hay producto.

### Lo que se deduce de todo esto

- El botón rojo es lo más grande de la pantalla.
- De abrir la app a estar grabando: un toque. Dos ya es demasiado.
- Lo que la IA aporte tiene que **entrar en TU tempo y en TU tonalidad**, no al
  revés. Si hay que adaptarse, se adapta la máquina.
- Todo funciona sin cobertura salvo lo que obligatoriamente necesite red.
- Moises te pide una canción, Suno te pide un prompt: **esto te pide que
  toques.**

## 3. Arquitectura en tres capas

| Capa | Qué hace | Dónde corre |
|---|---|---|
| **Grabar** | Multipista, compensación de latencia, edición mínima | En el móvil, sin red |
| **Entender** | Tempo, tonalidad y estructura de lo que has tocado | En el móvil, sin red |
| **Generar** | Bases, acompañamientos, texturas | Mixto: patrones en local, modelos en servidor |

La capa de generar tiene **dos motores distintos** y es importante no
confundirlos:

- **Determinista (patrones + samples).** Para todo lo que tiene que cuadrar:
  percusión, bases rítmicas, loops. Instantáneo, gratis, sin red, en bucle
  infinito y exacto al BPM. El instrumento que no quieres no aparece porque no
  existe en el motor, no porque se lo hayamos pedido por favor.
- **Generativo (modelo de audio).** Para lo que los patrones no pueden dar:
  color, textura, una banda de verdad. Cuesta dinero, tarda, y hay que cuadrar
  a compás lo que devuelve.

**Decisión tomada: ACE-Step 1.5, no Lyria.** Licencia MIT, genera **stems
separados** en vez de mezclas, y acepta **BPM, tonalidad y compás como
parámetros explícitos** en vez de como súplicas dentro del prompt. Además sabe
leer audio existente y sacarle el tempo y la tonalidad. Servido en fal.ai sale
a 0,0002 $ por segundo de audio: un minuto son 1,2 céntimos, trescientas
generaciones al mes son 3,60 $.

Descartados y por qué:

- **Lyria** (Google): devuelve mezcla, sin stems, y no se le puede fijar el
  tempo sin reiniciar el contexto. Era la opción por inercia, no por criterio.
- **MusicGen** (Meta): los pesos son no comerciales y el audio hereda la
  licencia.
- **API de Moises**: no expone la generación, solo separación y análisis. Y
  separar sale a 0,07 $ por stem y minuto.
- **Autoalojar**: no compensa por debajo de unas 500 generaciones al mes.

Para la percusión con humanización hay además **GrooVAE** (Magenta, Apache
2.0), que trabaja en MIDI y corre en el propio navegador sin coste.

## 3.bis Qué se compra y qué se construye

Regla de Víctor: lo que se pueda sacar de una API, de una API; lo que no, se
construye. Con un matiz que decide de verdad la frontera: **no es qué existe,
es cuánto puede tardar.**

- **Si suena mientras tocas, va en local. Siempre.** Un ritmo, el click, la
  tonalidad de la toma que acabas de hacer, estirar el tempo. Nada de esto
  puede esperar veinte segundos ni depender de que haya cobertura en el local
  de ensayo.
- **Si puedes esperar veinte segundos, va a una API.** Generar una guitarra de
  acompañamiento, un colchón de cuerdas, separar una canción en pistas.

Con esa regla, el reparto queda así:

| Pieza | Dónde | Por qué |
|---|---|---|
| Ritmos y compases | **Construir** | No existe API que sepa un doce. Y tiene que ser instantáneo |
| Metrónomo por palos | **Construir** | Lo mismo, y es un derivado gratis del anterior |
| Tempo y tonalidad de tu toma | **Construir** | Music.AI lo vende a 0,03-0,04 $/min, pero esto tiene que salir al soltar el botón, sin red |
| Estirar el tempo | **Construir** | Moises lo cobra a 0,003 $/min porque es DSP clásico. Rubber Band y SoundTouch son libres |
| Percusión (sonido) | **Construir**, y luego samples | Sintetizada suena bien y pesa cero. Congas y bongós esperan samples con licencia clara |
| Generar un instrumento | **API** | ACE-Step tiene la primitiva exacta. Construirlo sería absurdo |
| Colchones y texturas | **API** | Lo mismo |
| Separar pistas | **API** | En el navegador del móvil no es viable: hay crashes documentados de WebKit |
| Acordes de tu toma | **A decidir** | Fadr lo da por 10 $/mes con stems, MIDI y tonalidad. Construirlo bien es caro |

## 4. Bloques de trabajo

Cada bloque tiene entregable y **definición de hecho**: una frase que Víctor
puede comprobar en su móvil. Si no se puede comprobar, no está hecho.

### Bloque 0 — Grabar sin desfase · HECHO

Grabadora multipista con compensación de latencia medida, edición (mover,
recortar, repetir, volumen, silenciar), exportación a WAV, guardado local,
tema claro y oscuro, e instalable como app.

*Hecho:* validado en un iPhone real el 15 de agosto.

### Bloque 1 — Que la grabadora sea de fiar

Ordenado con las quejas reales de los usuarios de la competencia, que es mejor
fuente que nuestra intuición. Lo que mata estos productos, por orden:

1. **Perder el trabajo.** Es la queja número uno de BandLab sobre 499.000
   valoraciones. Un músico perdona un sonido regular; no perdona perder una
   idea. Hay que ser paranoicos con el guardado.
2. **No poder exportar.** Udio desactivó las descargas y dejó de ser una
   herramienta de un día para otro.
3. **No poder cambiar el tempo después de grabar.** Es la única pega que
   Sound on Sound le pone a Songzap, y convierte la app en una trampa a la
   tercera sesión. **Rectifico lo que dije antes**: dije que estirar el audio
   no estaba previsto; visto que es un asesino conocido de este tipo de
   producto, entra en el plan.
4. Cuenta de entrada, punch, bucle de grabación y deshacer. Aburrido y no
   negociable.

Hecho ya: fundidos en los cortes, regla en compases, importar audio.

Pendiente: bucle de reproducción entre dos puntos, regrabar un trozo sin crear
pista nueva, reordenar pistas y estirado de tempo.

*Definición de hecho:* grabas cinco capas de una idea real y no abres ajustes
ni una vez.

### Bloque 2 — El banco de ritmos

No es la razón de existir del producto —eso es maquetar canciones— pero sí el
arma que ningún competidor tiene, y lo que convierte una grabadora en un sitio
donde apetece tocar.

- **Motor de ciclos, no de compases de 4.** El modelo de datos es un ciclo de N
  pulsos con acentos en posiciones arbitrarias. Un 12 flamenco con acentos en
  12-3-6-8-10 no es un caso especial dentro de 4/4: es el caso normal, y 4/4 es
  el ciclo simple.
- Humanización de verdad: micro-desvíos y dinámica. Una caja de ritmos rígida
  no sirve para acompañar flamenco.
- Kit de percusión: cajón, palmas, clave, güiro, congas, bongós, batería.
- Palos y ritmos de salida, con el compás bien puesto.
- Panel: elegir, escuchar en bucle, subir y bajar intensidad. Copiando la mejor
  idea de GarageBand: **el batería como persona, no como secuenciador**. Dos
  ejes (cuánto toca, cuánto pega) y ya. Que todo el mundo la haya copiado,
  incluido Apple en sus Session Players y Positive Grid con sus bateristas con
  nombre, es la prueba de que funciona.
- "Pasar a pista": el ritmo se convierte en una pista normal y se edita igual.

*Definición de hecho:* abres la app, eliges bulería a 92, y estás tocando
encima sin salir ni buscar nada.

### Bloque 3 — El oído

Análisis local de lo que acabas de tocar. Sin red y sin coste.

- Tempo por detección de ataques y autocorrelación.
- Tonalidad por vector de croma contra perfiles de tonalidad.
- Un botón: "usar este tempo y esta tonalidad en el proyecto".
- La rejilla y los ritmos se alinean con lo que tocaste.

*Definición de hecho:* grabas ocho compases libres de guitarra, la app dice
"92 BPM · Mi menor", le das a usar, y la base entra cuadrada.

### Bloque 4 — Patrones a medida

Pedir un ritmo con palabras. El modelo de lenguaje escribe el **patrón**, no el
audio: es instantáneo, barato y verificable contra un esquema.

- Ruta de servidor con la clave de API a salvo.
- Esquema de patrón validado: si el modelo se inventa algo, se rechaza.
- "Cajón por bulerías pero más vacío en el 3" → suena en tres segundos.

*Definición de hecho:* pides una variación con tus palabras y sale una que te
sirve.

### Bloque 5 — La biblioteca

- Tus loops guardados, por instrumento y por estilo.
- Favoritos y lo último usado.
- Sugerencias: según el tempo y la tonalidad detectados, tres bases que pegan.

*Definición de hecho:* tienes tu propio banco y ya no empiezas de cero.

### Bloque 6 — Generación de audio con IA

El motor generativo, con el modelo que gane el barrido.

- Capa traductora entre lo que pides y lo que entiende el modelo: anclaje de
  época, terminología de stems, nada de negaciones, tempo y tonalidad forzados,
  y filtro de nombres propios para no chocar con derechos de autor.
- Cortado a compás de lo que devuelva.
- Aviso honesto de coste antes de generar.

*Definición de hecho:* pides un colchón, entra en compás y no desafina.

### Bloque 7 — Grabar sin cascos

El diferenciador escondido. Songzap lo tiene y es lo que de verdad lo separa
del resto: cancelar lo que ya sonaba para poder grabar capas al micro del móvil
**sin ponerte los auriculares**, en el sofá o en un bar.

A nuestro favor: **conocemos exactamente la señal que estamos reproduciendo**,
así que no es cancelación a ciegas. Es difícil, pero no es adivinar.

*Definición de hecho:* grabas la segunda capa por altavoz y la primera no se
cuela.

### Después

Secciones de canción, separación de tus propias pistas (por servidor: en el
navegador del móvil no es viable hoy), exportación a un DAW de escritorio con
tempo y marcadores, y sincronización entre dispositivos.

## 5. Decisiones pendientes

| Decisión | Estado |
|---|---|
| Modelo generativo | Barrido de mercado en curso |
| Samples de percusión con licencia libre | Investigación en curso |
| Algoritmo de tonalidad | Investigación en curso |
| ¿Se toca con claqueta o libre? | Pendiente de Víctor |
| Estilos del banco inicial | Pendiente de Víctor |
| Compases: ¿4/4 y 12/8 bastan? | Pendiente de Víctor |
| Clave de API para la generación | Pendiente de Víctor |

## 6. Riesgos, dichos a la cara

- **Estirar el audio grabado no está previsto.** Cambiar el tempo mueve el
  click y las bases, no lo que ya has tocado. Hacerlo bien es caro y en el
  móvil suena mal.
- **Los modelos generativos no cuadran a compás por diseño.** Todo lo que
  venga de un modelo habrá que analizarlo y cortarlo. Nunca será tan exacto
  como el motor de patrones.
- **El almacenamiento crece rápido:** unos 5,6 MB por minuto y pista. Hay que
  vigilarlo y avisar.
- **Separar pistas en el móvil es caro.** O va por servidor, o no va.
- **iOS manda.** Safari cambia de comportamiento entre versiones y ya nos ha
  costado una tarde. Cada versión nueva hay que volver a probar en un iPhone
  real.
