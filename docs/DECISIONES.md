# Decisiones

Cada una con lo que se descartó y por qué. Las de agosto, en
`docs/historia/PLAN.md` (§3 y §3.bis).

## 0001 · Compás tiene su propio repositorio (16-nov-2026)

Se sacó el motor de `web-aether` (`src/lib/daw`, `src/components/daw`,
`src/hooks/useStudio.ts`, en `/lab/estudio`) a un repo propio.

**Descartado:** seguir dentro de la web de la agencia. Un producto con
servidor de GPU, claves y su propio ritmo de versiones no puede depender de
las reglas de marca ni de los despliegues de una web de agencia.

## 0002 · Dos motores para el músico de sesión

«Al momento» (notas + síntesis en el móvil) y «Con IA» (ACE-Step en la nube).

**Descartado:** solo IA. Tarda, cuesta y necesita red; y lo que de verdad
tiene que cuadrar (el pulso) un motor de notas lo clava por construcción.
**Descartado:** solo notas. Suena a máquina; la IA es lo que suena a banda.

## 0003 · ACE-Step 1.5 con la tarea `lego`, por su servidor oficial

**Descartados**, comprobado el 16-nov-2026:
- **fal.ai `ace-step-1.5`:** solo texto a música, sin `lego` ni audio de entrada.
- **Chutes:** devuelve 400 para `lego`, `extract` y `complete`.
- **Suno:** sin API pública (programa de socios por invitación, julio de 2026).
- **API de Moises / Music.AI:** separa y analiza; la generación no se expone.
- **ElevenLabs Music v2:** inpainting de secciones, pero no «toca un bajo sobre esto».
- **Lyria 3 / 3.5:** devuelve la mezcla en un fichero, sin pistas.

El servidor oficial (`python -m acestep.api_server`) se puede levantar en
cualquier GPU, y así no dependemos de que un intermediario exponga `lego`.

## 0004 · El bajo al momento escribe NOTAS, no audio

Así cuadra al milisegundo, cambia de estilo sin pedir nada a nadie y
funciona sin red. Es lo mismo que hacen los Session Players de Logic.

## 0005 · Síntesis en TypeScript puro, no en OfflineAudioContext

Se puede probar con tests sin navegador y suena igual en todos los móviles.

## 0006 · El tempo se afina a la décima (16-nov-2026)

El detector trabaja en saltos de 10 ms y no distingue 95 de 96 BPM. Se vio
en el navegador: una guitarra a 96 salía a 95, el bajo se iba 200 ms al final
de 21 s, y la segunda vuelta de La m se leía como La. `afinarTempo` prueba los
tempos cercanos de décima en décima contra la toma entera.

## 0007 · Sin golpe no hay cambio de acorde

Una cola que se apaga cambia de color sin que nadie cambie de acorde. Cambiar
de acorde en un pulso sin ataque cuesta mucho más en el Viterbi, y el último
acorde de la toma tiene que tener al menos dos golpes.

## 0008 · Si tocaste libre, el proyecto pasa a tu tempo

Al generar, si el tempo salió de la toma y no de la claqueta, el proyecto se
pone a ese tempo y se dice en el mensaje.
**Descartado:** dejarlo a 100 y que la claqueta vaya por un lado y el bajo por otro.

## 0009 · Un solo botón después de grabar: «Ponle algo debajo» (16-nov-2026)

Antes había dos: «Ponme algo debajo» abría los ritmos (a 100 BPM salvo que
pulsaras «Usar») y un «Bajo» pequeño que en el móvil se quedaba fuera de la
pantalla. El dueño buscó el bajo y no lo encontró, y en los ritmos tenía que
elegir él el tempo. Ahora el botón abre el músico de sesión con todos los
instrumentos, y todo sale a tu tempo y desde tu primer pulso.
**Descartado:** dos botones con jerarquía distinta. El que importa se perdía.

## 0010 · Batería y teclas al momento, como el bajo

Las teclas escriben NOTAS con enlace de voces (cada dedo se mueve lo menos
posible) y suenan con el mismo sintetizador aditivo: piano eléctrico o
colchón. La batería reutiliza los ritmos del estudio, pero a tu tempo: si tu
tempo cae fuera del palo, se prueba al doble o a la mitad (una bulería sobre
una toma a 96 sale a 192), que siguen cayendo en tus pulsos.
**Descartado:** que el ritmo traiga su tempo cuando ya hay tomas grabadas. El
audio no se estira y quedaría descuadrado.
**Descartado:** soleá o bulerías como ritmo de salida. Sin saber tu compás,
el primero es el pop sencillo; un doce sobre una canción pop suena a error.

## 0011 · La opción «Con IA» dice la verdad

El servidor de prueba (`npm run ia:falso`) devuelve siempre la misma nota, y
el dueño lo tomó por la IA («solo suena una nota todo el rato»). La app
pregunta ahora a `/health`: si es el de prueba lo dice, y si el servidor de
la GPU está apagado también.

## 0012 · Las tomas se cuadran solas y la latencia se aprende de ellas (16-nov-2026)

El dueño grababa encima de una pista y la toma salía «un pelín retrasada»,
siempre. Causa: sin calibrar, la compensación es una estimación que se hace
una vez al abrir el micro, y en Chrome de Windows sale corta (la entrada no se
informa y la salida se informa de menos). Ahora, si al grabar sonaba algo
(claqueta, ritmo u otras pistas), `medirRetraso` / `medirRetrasoContra`
(`src/lib/daw/analysis/retraso.ts`) miden dónde caen tus ataques, y si llegan
tarde de 8 a 150 ms con confianza, la toma se adelanta entera y la
compensación aprende el 70 % del error (`settings.latenciaAprendida`). En tres
tomas converge sin pasarse.
**Descartado:** corregir también cuando llegas pronto. Correr es del músico;
solo se deshace lo aprendido de más.
**Descartado:** medir solo contra la rejilla. Si la primera pista se tocó
libre, la rejilla da con seguridad una respuesta equivocada: sin claqueta, la
referencia son las otras pistas.

## 0013 · Se llama Aura Music, es blanco y el verde es Aura (17-nov-2026)

El dueño: «hazmelo blanco, que todos los DAW son oscuros, rollo Aura… lo
llamaremos Aura Music». El tema claro sale por defecto y usa los tokens de
Aura (`aura-lite/src/styles/cristal.css`): papel blanco, suelo apenas salvia,
tinta #111114 y sombras teñidas de verde. Letra Geist y Geist Mono, las de
Aura, servidas desde casa. El acento de «lo ha puesto la máquina» pasa del
ámbar al verde de Aura (#5DBB9C; #1C7A5B como texto en claro, 5,3:1 sobre
blanco). El rojo sigue siendo solo «grabando». El oscuro queda en Ajustes.
**Pendiente:** el «3D», los verdes y el cristal de Aura; el dueño lo aplazó
hasta tener la IA desplegada.

## 0014 · El productor: Claude decide, la app ejecuta (17-nov-2026)

Le pides algo con palabras y Claude (`claude-opus-5-5`, salida estructurada,
`src/app/api/productor/route.ts`) devuelve un plan de como mucho cuatro pasos
que solo puede usar piezas que ya existen: músico al momento, músico con IA,
tempo y canción entera (ACE-Step `text2music`, nueva). El móvil los ejecuta
uno a uno y cada pista sale como una más, con el Deshacer de siempre.
`normalizarPlan` corrige ids inventados, limita números y quita el cambio de
tempo si ya hay audio grabado. El cerebro (gustos, pedidos, usos, tempos,
tonos, ideas) vive en el móvil y viaja como un resumen de unas líneas; se ve y
se borra en la hoja.
**Descartado:** un agente con herramientas en bucle. El plan cabe en una sola
llamada y así no hay estados a medias en el servidor ni coste que crece solo.
**Descartado:** que Claude toque el audio. Claude elige; las notas y el sonido
los ponen el músico de la app y ACE-Step.
**Candado:** con `AURA_MUSIC_CODIGO` en el servidor, las rutas que gastan
(productor, pistas y canciones con IA) piden un código que el móvil guarda.
Es lo mínimo antes de poner claves en un enlace público.
**Siguiente:** entrar con la cuenta de Aura (Firebase `aether-app-59bd1`),
guardar las ideas en `users/{uid}/auraMusicProjects` y compartir el cerebro de
Aura a través de aura-mcp.

## 0015 · La GPU se enciende desde la app y se apaga sola (17-nov-2026)

El dueño: «¿la GPU gasta aunque no la use? se me han cobrado 10 $ por nada…
quisiera usarla solo cuando uso la IA; un botón en la app». Ahora:
- `scripts/acestep-gpu.sh` lleva un vigilante: cada petición deja una marca y
  tras 15 minutos sin ninguna para el pod con `runpodctl pod stop`.
- «Encender la GPU» (músico y productor) llama a `/api/gpu`, que con la API v2
  de RunPod enciende el pod y, ya encendido, arranca ACE-Step dentro con
  `/exec`: baja la última versión del script desde la propia app
  (`public/acestep-gpu.sh`, copiado en `prebuild`) y le pasa la clave de
  Vercel. Nadie vuelve a subir nada a Jupyter ni a copiar claves del pod.
**Descartado (por ahora):** RunPod Serverless. Cobra solo por segundo de
trabajo, pero hay que montar una imagen y un handler; con el apagado solo, el
coste de estar quieto ya es como mucho 15 minutos.
**Descartado:** cambiar el comando de arranque del pod para lanzar ACE-Step.
Exige tocar la plantilla y, si se hace mal, el pod no arranca; `/exec` no
toca nada del pod.

## 0016 · La app instalada: Serwist, versiones sin sustos y la idea en un zip (17-nov-2026)

Pilar E, ola 1. El service worker escrito a mano iba red primero para todo,
solo guardaba `/` y dos iconos, se activaba solo (`skipWaiting`) y al
activarse borraba cualquier caché que no fuera la suya, también las muestras
de los instrumentos. Ahora es Serwist (`src/app/sw.ts`, sale a `public/sw.js`
al compilar):
- La app y los trozos de `_next/static` de cada compilación se guardan al
  instalar. Páginas: red primero con 3 s de margen y, sin red, la última copia
  o la app guardada (`/?app=guardada`). Estáticos, letras e iconos: caché
  primero. `/api/*`: siempre red.
- Al activarse borra solo sus cachés `aura-music-*` que ya no usa;
  `aura-samples-*` nunca (`cachesQueSobran`, con test).
- Sin `skipWaiting` automático: la versión nueva espera y la app dice «Nueva
  versión · Actualizar». Solo se activa con el transporte parado y nada a
  medias; guarda la idea y recarga. `reloadOnOnline` va apagado: Serwist
  recarga por defecto al volver la cobertura, y eso cortaría una toma.
- Manifest con `id`, maskable de 192 y 512, icono del atajo Grabar, tres
  capturas `narrow` de 1170×2532 sacadas de la propia app con Chrome, y
  `share_target`: el POST de Android lo recoge el worker, guarda el audio y la
  app ofrece «Meter en la idea» (el toque hace falta para arrancar el audio).
- iPhone: `audioSession` ya estaba bien (`playback` antes de crear el
  contexto, `play-and-record` antes del micro) y el micro ya solo se pedía al
  grabar. El contexto que no vuelve tras otra app ya lo arregló `main`
  (`contextoAtascado` y `AudioBloqueado`); aquí no se duplica. Nuevo: Wake
  Lock se vuelve a pedir al volver a la app, y si la app se oculta a media
  toma se para sin esperar la cola, se guarda y se avisa al volver.
- Instalar: en iPhone sin instalar, una guía antes de la intro, porque no hay
  botón posible y lo grabado en Safari no pasa a la app instalada. En
  Android, aviso con `beforeinstallprompt`. El evento vive en un solo sitio
  (`src/lib/pwa/instalacion.ts`) y lo leen el aviso y Ajustes.
- Copias: «Exportar idea» da un zip (fflate, MIT) con `idea.json` y un WAV de
  16 bits por audio; «Importar idea» nunca pisa: si la idea ya está, entra
  como copia. Exportar va en dos toques porque Safari solo abre la hoja de
  compartir dentro del toque que la pide. La ida y vuelta es exacta, muestra a
  muestra (test). Para eso `floatToInt16` pasa a ser la inversa exacta de
  `int16ToFloat`: antes, volver a guardar un audio ya guardado le quitaba un
  bit.
- Espacio: `storage.ts` da una escritura por buena cuando la transacción se
  confirma, no cuando la petición dice «ok». Si no cabe, el navegador aborta
  después con `QuotaExceededError`, y antes eso pasaba en silencio: la toma
  parecía guardada y no lo estaba. Ahora falla de verdad y la app avisa («El
  móvil está lleno»). En Ajustes, lo que ocupa (`estimate()`) y si está
  protegido (`persist()`, que ya se pedía con la primera toma).
**Descartado:** `next-pwa`, sin mantener, y el `defaultCache` de Serwist, que
guarda respuestas de `/api`.
**Descartado:** guardar `/` tal cual en el precache. Esa ruta sirve primero lo
guardado y las páginas tienen que ir red primero; por eso la copia va con
otra URL, que Next sirve igual.
**Descartado:** comprimir el audio dentro del zip. Apenas encoge y en el móvil
gasta batería.
**Solo se comprueba en un iPhone de verdad:** `audioSession`, Wake Lock,
cortar la toma al salir, la guía de instalar y guardar el zip en Archivos.

## 0017 · Instrumentos en la pantalla: se graban notas y suena su audio (17-nov-2026)

Pilar B, ola 1. Pantalla «Tocar» con pads (808, 909 y cajón), teclado,
tiras de acordes y bajo. Lo que tocas se guarda como NOTAS en bruto
(`Track.notas`: `{beat, dur, nota, vel}` en pulsos, con el instrumento y los
ajustes) y la pista apunta a un audio hecho con esas notas en un
OfflineAudioContext, con los mismos instrumentos que suenan al tocar
(`src/lib/instrumentos/render.ts`). Así el motor, la mezcla y el WAV la tratan
como cualquier toma sin saber nada de notas, y el mezclador de la sesión A le
pone efectos igual que a una voz. Cuadrar, humanizar, cambiar de sonido o de
tempo rehace ese audio sin tocar el bruto; el audio anterior se queda guardado
y Deshacer vuelve a él al momento.
- **Al tocar**, el sonido sale del `pointerdown` nativo, sin pasar por React:
  medido en el PC, de 0,5 a 1,5 ms de código entre el dedo y el `start()`.
  Cada golpe se coloca con `getOutputTimestamp`: se apunta lo que estabas
  OYENDO al tocar, no la hora del reloj. Encima va la calibración propia del
  toque («Toca 8 veces con la claqueta», mediana por dispositivo en
  `localStorage`), distinta de la del micro.
- **Grabar** usa `engine.play` con dos opciones nuevas (claqueta delante y no
  pararse al final del proyecto) y `engine.posicionEn(t)`. La captura está
  siempre encendida: «Recuperar lo último» convierte en pista lo que tocaste
  sin grabar desde el último silencio de 4 s.
- **«La IA lo graba bien»** (`src/lib/musico/groove/`, TS puro con tests):
  quitar dobles golpes de menos de 30 ms, cuantizar con fuerza, swing y
  ventana, plantillas de groove propias en un JSON, humanizar con ruido 1/f
  (Voss-McCartney) que mueve juntos los golpes simultáneos, y un diagnóstico
  («vas 12 ms por detrás; donde más, en el 3»). La IA solo elige ajustes: la
  rejilla que mejor explica lo tocado y el 70 % de fuerza.
- **Sonidos.** Batería sintetizada (808 y 909 rehechas con nodos: seno que cae
  para el bombo, seis cuadradas de la 808 para el metal) y cajón con palmas y
  pitos. Muestras de 5 paquetes, 3,2 MB en total, servidas desde
  `public/samples/`, bajadas al abrir el instrumento y guardadas en Cache
  Storage `aura-samples-v1`; la primera carga baja 0 MB. smplr (MIT) las toca
  con un programador propio que entrega todo al momento (el suyo usa un
  `setInterval` que pierde notas en un OfflineAudioContext). Licencias
  comprobadas en la fuente: piano Salamander (CC BY 3.0, crédito en Ajustes),
  bajo Growlybass de Karoryfer, piano eléctrico TX81Z de VCSL, cuerdas
  VSCO-2-CE y guitarra de nailon de FreePats (CC0). Detalle y citas en
  `public/samples/LICENCIAS.md`.
- **Sin muestras** (sin red la primera vez) suena una síntesis en TypeScript
  puro (la regla de la 0005): la cuerda de guitarra es Karplus-Strong ampliado
  (afinada a menos de 6 cents, con test), y el piano, el bajo y el colchón
  salen del sintetizador del músico. La pista guarda con qué sonó y se rehace
  sola cuando llegan las muestras.
- **Si cambia el tempo**, las pistas de notas se rehacen a tu tempo nuevo y el
  clip se escala para seguir en su compás: el audio grabado no puede, las
  notas sí. Por eso el productor puede cambiar el tempo aunque haya pistas de
  notas (solo lo frena el audio grabado).
- **El productor cuadra.** Paso nuevo `cuadrar` (pista, fuerza, swing,
  humanizar): Claude ve cada pista tocada en la pantalla con su diagnóstico
  («vas 14 ms por detrás; donde más, en el 3») y puede proponer «¿lo cuadro al
  70 %?». La app solo acepta nombres de pistas de notas que existen.
**Descartado:** sonar las notas en directo desde el motor (un secuenciador
dentro de `engine.ts`). Habría que tocar `scheduleProject`, `renderMix` y lo
que monte la sesión del mezclador, y el WAV necesitaría su propio camino.
**Descartado:** Karplus-Strong en un AudioWorklet. En un OfflineAudioContext
los mensajes al worklet llegan cuando quieren y el WAV saldría distinto de lo
que oíste; en TypeScript, la misma función hace las dos cosas y se prueba sin
navegador.
**Descartado (licencias):** Splendid Grand Piano (el «dominio público» solo lo
dice un tercero), las muestras de Iowa (licencia propia, no estándar),
jRhodes3 (CC BY-NC) y Ovation Guitar (sin licencia).
**Pendiente:** piano roll; plantillas de groove sacadas del Groove MIDI
Dataset (CC BY 4.0); repetición de nota en los pads; teclados MIDI en Android;
medir la latencia real en un iPhone.
## 0018 · El mezclador: un grafo, efectos nativos y masterizado en TS (17-nov-2026)

Pilar A de la ola 1. Mezclador a pantalla completa (el botón de los faders
de la cabecera, en el sitio del engranaje, que repetía lo que ya hace tocar
el nombre del proyecto): una tira por pista con panorama, fader en dB,
medidor, mute, solo y efectos, y el master fijo a la derecha. Efectos por
pista con seis preajustes («Seco», «Voz cálida», «Guitarra flamenca»,
«Batería con pegada», «Sala», «Catedral») y dos buses compartidos, reverb y
eco a tempo. Todo con nodos del navegador y un solo `buildMixGraph` para
oír y para exportar; `renderMix` ya no copia el limitador a mano.
**Reverb:** respuesta de sala generada por código (ruido con caída, paso
bajo que se cierra y semilla fija): 0 bytes y sin licencias. El nivel de
vuelta de cada sitio está igualado a oído y medida (el estudio volvía 11 dB
más bajo que la catedral con el mismo envío).
**Neutro de verdad:** el compresor de Chrome saca estéreo aunque le entre
mono, y el panorama dejaba de aplicar la ley de igual potencia (+3 dB). La
cadena vuelve a mono antes de panear y una idea de antes suena igual que
antes (mismos picos al exportar). La cadena retrasa ~9 ms y el motor lo
compensa adelantando las fuentes, como la compensación de retardo de un DAW.
**Masterizar de un toque:** sonoridad integrada según BS.1770 (filtro K y
puertas) y pico verdadero con sobremuestreo ×4, en TS. Sube hasta −14 LUFS
(o −16 «para el móvil») con techo −1 dBTP y un limitador con mirada
adelante; se aplica al exportar la mezcla entera, nunca a las pistas
sueltas. Tests con señales sintéticas, también una batería que obliga a
limitar 20 dB.
**El productor mezcla:** paso `mezcla` con valores absolutos (el contexto le
cuenta cómo está cada pista); hasta ocho por pedido, aparte de los cuatro
de siempre.
**Descartado:** Tone.js y worklets propios para los efectos (los nodos
nativos bastan y van en el hilo de audio); masterizar en directo (el
limitador en TS necesita la canción entera: lo que suena es la mezcla sin
masterizar, y el WAV sale masterizado); medidores con estado de React.
**Pendiente:** probar en un iPhone de verdad; el masterizado bloquea el hilo
unos segundos en canciones largas (pasarlo a un Worker); chorus y ranuras
de efectos libres, que el plan pedía y aquí no caben aún.

## 0019 · La claqueta de varias formas y cuadrar tomas de audio (22-nov-2026)

El dueño: «el tic-toc nunca me ha funcionado muy bien… quisiera ponerlo a
negras y en modo bombo, o ponerle ritmos básicos de fondo para grabar, como
rumba suave», y «quiero grabar pistas y que se regraben al tiempo».
**Claqueta** (`src/lib/daw/claqueta/`): sonido (tic-tac, bombo, bombo y caja,
shaker, palmas, baqueta) con las voces del kit de ritmos, cada cuánto
(blancas, negras, corcheas, tresillos) con acento en el 1 que se puede
quitar, volumen propio y un ritmo de fondo (rumba suave, pop, balada,
bulería, bossa) con «Cuánto» y «Fuerza» bajos. Va por el bus de la claqueta:
no pasa por la mezcla, no se graba y no se exporta. La cuenta atrás usa el
mismo sonido. En la hoja de tempo, a dos toques; cada opción suena al
tocarla y se recuerda (`StudioSettings.claqueta`, opcional: sin ella, el
tic-tac de siempre, idéntico). El motor sigue llevando un puntero al
siguiente paso, así que mover el tempo a media toma no da saltos, y la
latencia aprendida mide igual (la rejilla son los pulsos, suene lo que suene).
**Cuadrar tomas de audio** (`src/lib/daw/cuadrar/`): busca los ataques con
`detectarGolpes`, corta 5 ms antes de cada uno, acerca cada trozo a la
rejilla del proyecto con la fuerza elegida (50-100 %) y los une con fundidos
de 4 ms. Si queda un hueco o un trozo pisa al siguiente, lo estira o lo
encoge con WSOLA (entre 0,7 y 1,45 veces) sin cambiar el tono. Lo que cae
lejos de la rejilla no se mueve. No destructivo: la pista guarda la toma
original y la cuadrada (`Track.cuadre`); «Como la toqué / Cuadrada» a un
toque, «Dejar como la toqué» y Deshacer. El recolector de audio cuenta la
original como viva. El paso «cuadrar» del productor vale ahora también para
tomas de audio (solo con la fuerza).
**Descartado:** una voz que cuenta «un, dos, tres, cuatro». El navegador no
puede programar `speechSynthesis` en el reloj de audio (llega cuando quiere,
100-500 ms tarde) y una voz sintetizada a mano no se entendía; queda para
cuando haya muestras grabadas con licencia.
**Descartado:** reutilizar el ritmo de la hoja de Ritmos como fondo. Ese va
por la mezcla y es material musical; el de la claqueta es una señal de
servicio con su volumen.
