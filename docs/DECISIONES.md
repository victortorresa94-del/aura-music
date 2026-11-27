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

## 0019 · Instrumentos 2.0: batería de verdad, seis bajos y un icono para cada cosa (22-nov-2026)

El dueño, tras probarlo en su iPhone: «el bajo suena feote, deberíamos tener
varios tipos de bajo», «el crash suena poco real», «un icono tipo Aura para
cada cosa» y «obviamente quisiera poder grabar».
- **Batería acústica con muestras reales** (Karoryfer Big Rusty Drums, CC0):
  hasta 3 capas de fuerza y 2 golpes alternos (round robin) por pieza, crash
  y ride de 4,5 s, charles cerrado, de pedal y abierto, y el cerrado apaga el
  abierto como el pie en el pedal. Palmas, pandereta, cencerro, shaker y
  claves de la VCSL (CC0). Cajón de la VCSL con palmas y pitos de D. Smolken
  (CC0) y percusión latina (VCSL y los timbales de Virtuosity Drums, CC0). Un
  kit al que le falte una pieza la toca con la síntesis más parecida. La 808
  y la 909 se quedan, con un platillo nuevo de caída en dos tramos.
- **Seis bajos**, recordados en el móvil y compartidos con el músico al
  momento: con dedos (Swagbass de Karoryfer, cuerdas planas, el de por
  defecto), con púa (Pastabass), contrabajo (D. Smolken), sub, 808 (cae y
  satura) y analógico (sierra con filtro). Los tres últimos son síntesis con
  nodos de Web Audio (`osciladores.ts`), que sostienen mientras pisas y
  suenan igual en el WAV. El Growlybass de antes queda oculto, solo para
  abrir pistas viejas.
- **Más instrumentos:** órgano de tubos (VCSL, con bucle en la parte
  sostenida), órgano eléctrico de ruedas (síntesis), metales y cuerdas en
  pizzicato (VSCO-2-CE), marimba (VCSL), guitarra acústica de acero (Jeff
  Learman, CC0), pad y sinte solista (síntesis). Todo CC0, 6,3 MB nuevos;
  cada paquete se baja al abrirlo. Citas de licencia en
  `public/samples/LICENCIAS.md`.
- **Las cuerdas de «Acordes» no se tocan** (sonido protegido por el dueño):
  mismo paquete, mismos ajustes y su sitio en la tercera baldosa, detrás de
  Española y Piano.
- **«Tocar» con iconos:** Phosphor (MIT), como Aura, en duotono apagado y
  relleno al elegir; los que Phosphor no tiene (batería, cajón, congas, caja
  de ritmos, órgano, cuerdas, metales, marimba, bajo) dibujados con su mismo
  trazo. Familias y sonidos en baldosas con icono, nombre y una línea de cómo
  suena. Siempre en tinta: el verde sigue siendo solo de la máquina.
- **Grabar, inconfundible:** botón rojo con la palabra escrita y el estado
  dentro («Grabar», «Entra en 3», «Parar · 2.3»); las demás herramientas
  llevan icono y etiqueta. La claqueta pasa a «Ajustes del toque».
**Descartado (licencias o sonido):** SM Drums y Ovation (sin licencia), la
guitarra de acero de FreePats (GPL), Terkelsen Marimba (sin licencia),
Unruly Drums (todo con bordonero), Black And Blue y Meatbass (demasiado
oscuros para el altavoz del móvil), Fashionbass (demasiado brillante).
**Pendiente:** el número de la cuenta atrás dentro del botón se pinta con
rAF y no se ha visto en un iPhone; tampoco cómo se oyen de verdad el bucle
del órgano, las capas de la batería y el retardo del MP3 en Safari.
## 0020 · La claqueta de varias formas y cuadrar tomas de audio (22-nov-2026)

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


## 0021 · Loops al tempo de la canción: biblioteca, grabar en bucle y «¿Ha quedado bien?» (22-nov-2026)

El dueño: «quiero poder crear loops al BPM ya configurado en la canción muy
fácilmente, seleccionando loops de bombos o cogiendo esos sonidos y
grabándolos, pero que luego se sincronicen al BPM o me den la opción si no
ha quedado bien».
- **Los loops son notas, no audio.** Cada patrón es una lista de golpes en
  pulsos sobre un kit o un bajo de los que ya hay, así que suena siempre a tu
  tempo y en tu compás, se oye igual en el WAV y si cambias el BPM se rehace
  solo, como cualquier pista de notas. Nada que estirar ni que licenciar.
- **Biblioteca en una quinta baldosa, «Loops»**, al lado de Batería, Teclado,
  Acordes y Bajo. Batería (rock, funk, reguetón, lo-fi con swing, disco,
  balada con ride, trap en la 808, rock con entrada de toms), bajo (raíz a
  corcheas, raíz y quinta, octavas, dembow en 808, tumbao en contrabajo, 808
  largo; en la tónica de tu idea) y percusión (shaker, pandereta, congas,
  clave de son). Los ritmos de `rhythm/grooves` (bulerías, soleá, rumba,
  tangos, bolero, bossa, pop, balada 6/8) entran convertidos desde la misma
  fuente, sin copiarlos: flamenco en el cajón y latino en la percusión.
- **Pocos toques:** ▶ lo escucha al momento (pegado a la rejilla si la canción
  suena), «Bombo / Con caja / Todo» quita piezas en la batería, «2, 4 u 8
  compases» y «Poner», que lo mete en verde en el compás del cursor. Se avisa
  si el tempo no le va («Pensado para 85 a 110 BPM»), pero no se impide.
- **Grabar un loop tú:** la herramienta «Loop» de arriba cambia entre no, 1,
  2 y 4 compases (se recuerda). Grabando así, el transporte da la vuelta a
  esos compases como una groovebox: lo de las vueltas anteriores suena solo
  mientras tocas la siguiente, la etiqueta dice «Vuelta 3» y «Escuchar» pasa
  a ser «Quitar», que borra la última vuelta con algo. El motor solo gana un
  modo bucle pequeño y comentado (`opciones.bucle` y `onVuelta`), con el
  mismo cambio de ancla que ya usaba `resync`.
- **Que cuadre al tempo, y que puedas decir que no.** Al parar, el loop se
  pliega en sus compases, se cuadra al 70 % (la fuerza y el swing de siempre)
  y se repite hasta llenar unos ocho compases. Sale «¿Ha quedado bien?» con
  «Dejar como lo toqué», «Cuadrar más» (al 100 %) y «Deshacer». Una toma
  normal sale tal cual, con «Cuadrar». Cuadrar se calcula siempre desde lo
  que tocaste, que se guarda en la pista: nunca se pierde. La tarjeta va en
  el flujo, sobre el instrumento y sin taparlo.
- **También con el teclado del ordenador y con MIDI.** `useTecladoPC` toca lo
  abierto por `atril.tocar`, igual que el dedo y que `useTecladoMidi`: los
  pads en 1234 / QWER / ASDF / ZXCV en su sitio de la pantalla, el teclado
  como un piano en la fila de en medio, Z y X para la octava, Intro graba y
  Espacio escucha. Explicado en «Ajustes del toque». Arreglada de paso la
  fuerza del MIDI, que llegaba de 0 a 1 en vez de 1 a 127.
- **El bucle que suena mientras grabas** (`ReproductorDeBucle`) programa
  120 ms por delante cada 25 ms; si el temporizador se duerme, salta lo
  atrasado en vez de tocarlo todo junto. Tiene test con reloj falso.
**Pendiente:** no se ha oído en un iPhone. Falta comprobar que la vuelta del
bucle no se note con el proyecto lleno (el motor reprograma 200 ms antes del
final; un bloqueo más largo del hilo principal en ese momento la retrasaría)
y que el pulgar llega bien a «Quitar» mientras toca.

## 0022 · Percusión de verdad en los ritmos, la claqueta y los kits (22-nov-2026)

El dueño: «hay sonidos que suenan súper mal, por ejemplo el bolero suena
hiper digital, 0 real, y muchas percusiones en general».
- **Lo que sonaba a síntesis, y desde dónde.** Todo salía de `playVoice` en
  `rhythm/kit.ts` (ruido filtrado y senos):
  - los nueve ritmos de la hoja «Ritmos» (`engine.setGroove`);
  - los sonidos de la claqueta (bombo, bombo y caja, shaker, palmas, baqueta),
    sus cinco ritmos de fondo y su ejemplo al elegirla;
  - los ritmos convertidos en pista (`renderGroove`, desde el estudio y desde
    el músico);
  - en «Tocar», 10 de los 16 pads del cajón (bongós, congas, clave, shaker,
    pandereta, güiro, nudillos, cencerro) y 4 de la latina (bombo, aro, palmas
    y un platillo que era el de la 909).
- **Ahora suena grabado, con lo que ya teníamos.** `instrumentos/percusion.ts`
  da a cada voz su muestra CC0 de los paquetes de siempre: batería de la Big
  Rusty Drums (Karoryfer), cajón de la VCSL, palmas y pitos de D. Smolken,
  bongós, congas, güiro, clave, shaker, pandereta y cencerro de la VCSL, y
  timbales de Virtuosity Drums. No ha hecho falta bajar nada nuevo. La capa
  sale de la fuerza y los golpes se alternan (round robin).
- **El motor no cambia.** `playVoice` toca la muestra si la hay y está en
  memoria, y si no, la síntesis (ahora `sintetizarVoz`). Así `engine.ts` y
  la lógica de la claqueta quedan como estaban; solo cambia el sonido.
- **La 808 y la 909 siguen siendo síntesis**, también su cencerro y su
  clave: solo suenan cuando se eligen. El tic-tac del metrónomo tampoco
  cambia. Sin red la primera vez, una voz sin muestra usa la síntesis de
  reserva.
- **Mismo volumen que antes.** Medido en el navegador: los nueve ritmos quedan
  a ±2 dB de su versión sintetizada (las bulerías solo de palmas, +9,5 dB,
  porque antes casi no se oían). Las capas suaves se compensan con su nivel
  medido. Si no, un ritmo tocado suave contaba la fuerza dos veces (capa
  más floja y además ganancia más baja) y el bolero salía 7,5 dB por debajo.
  La capa da el color; la fuerza, el volumen.
- **Respira y no es una máquina.** La fuerza de los ritmos varía a los dos
  lados y con poco (±7 % con la mano a la mitad), y los loops de la
  biblioteca entran con `humanizar` al 30 % (unos ±3,6 ms y ±4 de fuerza,
  ruido rosa; los golpes simultáneos se mueven juntos), salvo los de la 808
  y la 909, que van clavados. Los platillos suenan enteros: nada los corta
  salvo el final del clip, y el charles abierto lo cierra el cerrado, como el
  pie.
- **Carga:** tras el primer toque, y con el navegador desocupado, se bajan
  las 14 voces de los ritmos y la claqueta (68 ficheros, 478 KB; luego salen
  de Cache Storage). Los platillos, toms y timbales que completan un kit
  se piden al abrir ese kit, y un render a pista espera a sus muestras antes
  de programar.
**Pendiente:** oírlo en el iPhone. La claqueta en «palmas» o «shaker» sale
de 6 a 14 dB más fuerte que con la síntesis, que era muy floja; si molesta,
se baja con el volumen de la claqueta. La VCSL no trae slap de conga: el
tumbao del bolero usa el golpe apagado del quinto.

## 0023 · Tu cuenta de Aura y las mismas ideas en el móvil y en el PC (22-nov-2026)

Pilar D, ola 2 (fase 1). En Ajustes, «Tu cuenta de Aura»: entrar con Google
o con correo y contraseña en el Firebase de Aura (`aether-app-59bd1`), ver
quién está dentro y salir. Con sesión, las ideas, su audio y el cerebro del
productor se ponen al día solos entre dispositivos. Sin configuración
(`NEXT_PUBLIC_FIREBASE_*`) no se carga el SDK ni se enseña nada: la app es la
de antes. Pasos del usuario en `docs/CUENTA.md`.
- **Local primero.** IndexedDB sigue mandando: grabar y guardar no esperan a
  la red. `storage.ts` avisa con un evento al guardar o borrar
  (`saveProject(p, { silencioso })` para lo que escribe la propia nube) y el
  motor (`src/lib/nube/motor.ts`) sube por detrás. No sabe de Firebase ni de
  IndexedDB: habla con un `Remoto` y un `Local`, y así se prueba entero con los
  dos simulados (`motor.test.ts`, dos dispositivos contra una nube en
  memoria).
- **Dónde va.** Cada idea, en `users/{uid}/auraMusicProjects/{id}` como texto
  JSON (Firestore no admite listas dentro de listas y tumba un `undefined`;
  pasado 600 KB va en gzip), con `updatedAt`, el dispositivo, sus audios y la
  hora del servidor para pedir solo lo nuevo. Cada audio, un FLAC en
  `users/{uid}/aura-music/{id}/{bufferId}` con subida reanudable. El cerebro,
  en `users/{uid}/auraMusic/cerebro`. Las reglas de Aura ya lo permiten
  (`users/{uid}/**` del dueño).
- **FLAC propio en TypeScript** (`flac.ts`): predictores fijos y Rice con
  particiones, que es FLAC normal. Ida y vuelta exacta, muestra a muestra,
  desde el PCM de 16 bits de IndexedDB (test). Medido: una toma de guitarra con
  ruido de sala, 0,60 del PCM (unos 3,4 MB por minuto en mono a 48 kHz); la
  guitarra sola, 0,54; el silencio, casi nada. Comprobado con ffmpeg en los
  dos sentidos: lee nuestros FLAC idénticos y nosotros leemos los suyos (con
  LPC), muestra a muestra. En el PC codifica un minuto en
  0,8 s y lo lee en 1 s, soltando el hilo cada 24 bloques; mientras grabas no
  se codifica nada.
- **Qué gana.** Con la base (la versión en la que el dispositivo y la nube
  coincidieron) se sabe quién cambió: si uno, gana ese; si los dos, la última
  modificación. Si la que pierde tenía tomas que la ganadora no, se guarda
  aparte («Bulería · copia del iPhone»), y la nube las sube con ella. Un
  borrado de otro dispositivo no se lleva cambios de aquí sin subir (la idea
  vuelve). El audio va antes que el documento: otro dispositivo nunca ve una
  idea sin su audio. Lo que nadie usa se borra de la nube a los 30 días, y
  `deleteProject` ya no borra un audio que use otra idea (las copias de un
  choque comparten los de la original). De una toma cuadrada al tempo (0020)
  viajan los dos audios, el que suena y el original, que no se borra nunca.
- **La idea abierta no cambia por debajo.** Si llega una versión nueva y no
  la has tocado desde que se cargó, se recarga sola; si la has tocado, Ajustes
  pregunta «Cargar la del PC» o «Seguir con la mía», con la misma regla de la
  copia.
- **Cerebro.** Se mezcla en tres partes con la base: lo aprendido en los dos
  se junta, lo olvidado en uno se queda olvidado, los usos suman lo de cada
  uno. Sin base (la primera vez), el mayor.
- **Cola.** Claves («proyecto:id», «cerebro») y no órdenes: diez cambios
  seguidos son una subida (se agrupan 2,5 s, nunca más de 20). Sin red espera
  2, 4, 8 s… hasta 5 min, y al volver la red se reintenta todo. Se guarda con
  la cuenta en localStorage y sobrevive a cerrar la app.
- **Entrar con Google.** Ventana emergente primero, como Aura (le funciona
  también en la app instalada del iPhone); si el navegador la bloquea, la
  redirección. `next.config.ts` sirve `/__/auth/*` de Firebase desde nuestro
  dominio para el día que haga falta poner el `authDomain` propio (paso
  opcional de `CUENTA.md`), y el service worker no toca esas páginas.
- **Estado visible y discreto.** Un icono gris de nube junto al número de
  pistas de la cabecera (al día, subiendo, sin conexión, error, ha cambiado
  en otro sitio) y el detalle bajo tu nombre en Ajustes, con «Reintentar». Sin
  colores nuevos: el rojo es grabar y el verde es Aura tocando.
**Descartado:** Firestore completo con su caché sin conexión. Serían dos
cachés peleándose (Aura sufrió la suya en el iPhone, 25-sep-2026) y ya
tenemos IndexedDB; `firestore/lite` va por peticiones normales y pesa menos.
**Descartado:** escuchar cambios en tiempo real (`onSnapshot`). Mirar al
volver a la app, al volver la red y cada minuto basta para dos dispositivos
de una persona, y una consulta que no trae nada cuesta una lectura.
**Descartado:** WAV de 16 bits en la nube (pesa casi el doble) y
`decodeAudioData` para leer el FLAC (remuestrea a la frecuencia del contexto
y no corre en los tests).
**Descartado:** el cerebro compartido con Aura (`users/{uid}/auraStorage`).
No tiene API HTTP salvo el MCP: fase 2.
**Pendiente:** entrar con Apple; comprobar en el servidor que la cuenta está
aprobada en Aura (hoy cualquiera con cuenta de Firebase de Aura guarda en su
propio espacio, que las reglas ya aíslan); probar en un iPhone de verdad la
ventana de Google en la app instalada; limitar tamaño y tipo del audio con
una regla de Storage propia para `aura-music/`; predictores LPC en el FLAC
(ffmpeg al máximo saca un 15 % menos que el nuestro).

## 0024 · Lo básico de un DAW: cabecera, selección, atajos y edición (22-nov-2026)

El dueño: «necesito atajos de teclado de toda la vida, como estar encima de
una pista, darle a la tecla borrar y ciao» y «necesito poder tocar el volumen
de cada pista».
- **Cabecera de pista con lo de siempre** (`cabecera/CabeceraPista.tsx`):
  nombre y «⋯»; M, S y el volumen; en el PC también el panorama, como
  perilla (una segunda raya al lado del volumen se confundía con él). Los
  mandos siguen las reglas del mezclador: arrastre relativo, se oye al
  mover, se guarda al soltar (un paso de Deshacer), doble clic al 0 dB o al
  centro, misma escala de fader. En el móvil el fader mide 48 px pero el
  recorrido son 180 px de dedo: se afina igual. El panorama no cabe en
  128 px y sigue en el mezclador.
- **Elegida = la fila más opaca** (cabecera y calle) y el filo de tinta en el
  clip. Sin franja de color a un lado: el color aquí significa algo.
- **Atajos en la misma tabla que los menús.** Los de un DAW (Espacio, R,
  S, M, Mayús+S, Supr, flechas, Inicio, Fin, Ctrl+C/X/V/D, + y −) se suman a
  `lib/daw/menus/comandos.ts` (0023 de menús): un solo registro para la
  barra, el menú del móvil, la chuleta de Ayuda y el teclado. Lo que hacen
  vive en `hooks/useEdicion.ts`, al que delega `useArchivo().ejecutar`.
  `atajoPermitido` decide dónde valen: las teclas sueltas que editan la
  línea de tiempo solo con el estudio a la vista (no con una hoja, el
  mezclador o «Tus ideas» encima), y con «Tocar» abierto tampoco Espacio,
  porque el teclado toca notas. En un deslizador, las flechas lo mueven a
  él. Ctrl+S sigue siendo Guardar y Ctrl+R del navegador: S y R solas
  cortan y graban.
- **Una pista sigue siendo un clip.** Cortar en el cursor (S) deja la segunda
  mitad en una pista nueva justo debajo, con la misma mezcla; pegar (Ctrl+V)
  crea una pista con el clip en el cursor. Es lo mismo que al grabar, cada
  toma en su pista. Pasar a varios clips por pista tocaba el motor, el
  mezclador, el guardado, el productor y el músico a la vez, con cinco
  sesiones trabajando en paralelo: no compensaba. Por eso tampoco se
  arrastran clips de una pista a otra.
- **Cortar un clip con repeticiones** corta entre dos vueltas, la más
  cercana: media vuelta más varias enteras no cabe en un clip.
- **Con el ratón se arrastra a la primera** (clips y regla); con el dedo, el
  primer toque elige y el segundo arrastra, para que desplazar la lista no
  mueva clips sin querer. Un clic sin mover ya no deja un paso de Deshacer
  vacío. El imán a la rejilla vale también al recortar los bordes; Alt lo
  suelta. Clic en la regla o en la calle vacía lleva el cursor ahí.
- **Rehacer** es el de la rama de menús (`redo`, `hayRehacer`), traído tal
  cual para que las dos ramas no choquen.

## 0025 · La barra de tiempo en «Tocar» (22-nov-2026)

El dueño, con el bajo y el GO:KEYS a 1786 px: «cuando grabo MIDI también
debería ver la barra de tiempo, poder echar pa' atrás, etc.».
- **Una tira de tiempo bajo GRABAR** (`TiraDeTiempo.tsx`), en las cinco
  pestañas: compases numerados, el cursor (rojo grabando), la zona del loop
  y, en pequeño, las notas. Lo que estás grabando sale en tinta, plegado al
  loop si grabas en bucle; las pistas del mismo instrumento, en gris; las
  demás pistas de notas, atenuadas; el audio, como una raya abajo. Caben
  unos 28 px por compás: 8 en un móvil y hasta 32 en un PC, por páginas que
  siguen al cursor.
- **Mover el cursor sin salir de «Tocar»:** tocar o arrastrar en la tira lo
  lleva a ese compás (con captura del puntero, también si el dedo se sale), y
  los botones van al principio y un compás atrás o adelante. Las flechas e
  Inicio solo funcionan con el foco en la tira, para no cruzarse con los
  atajos del estudio. GRABAR empieza donde está el cursor, al principio de
  su compás, con la cuenta atrás de siempre.
- **Sin tocar el motor:** `irA` (en `useInstrumentos`) usa lo que ya tenía
  `engine.ts`. Parado, `seek`. Escuchando, para, salta y vuelve a sonar
  «sin fin», porque el `seek` del estudio lo relanzaría con fin. Grabando no
  se mueve: se perdería la toma.
- **«¿Ha quedado bien?», en una fila:** «Tal cual / Cuadrado / Del todo»,
  deshacer y vale. Se monta encima de la fila de sonidos, con su misma
  altura, así que el teclado no se mueve ni un píxel. Antes era una tarjeta
  de 131 px que lo empujaba hacia abajo. La pregunta escrita sale de 480 px
  en adelante.
- **En PC, una columna:** todo «Tocar» va en unos 940 px centrados, GRABAR
  no pasa de 360 px y «Ajustes» se va al final. Las filas de teclas tienen
  tope de 240 px de alto, pegadas abajo, y las tiras de acordes de 520 px en
  total. En el móvil no cambia nada.
**Pendiente:** verlo en el iPhone y con el GO:KEYS. El cursor se mueve con
rAF y el panel del navegador de pruebas estaba oculto, así que el
movimiento no se ha visto; lo demás se ha medido en el DOM.

## 0026 · Menús de escritorio, «Tus ideas» y Ajustes solo del equipo (22-nov-2026)

El dueño: «aún no has añadido los menús ni nada». Dirección visual decidida:
plano, blanco con suelo #FAFBFA, sombras suaves teñidas de salvia, negro como
primario, salvia solo para la IA y rojo solo para grabar y borrar.
- **Barra de menús en el PC (1024 px o más):** marca, Archivo, Editar, Pista,
  Ver y Ayuda; la idea en el centro con «Guardado» (y la nube de la cuenta);
  a la derecha el tempo en una píldora, «Productor» (verde, lo hace Aura) y
  «Mezclar». Se abre al apretar, se cambia de menú pasando el ratón sin
  animación y se maneja con flechas, Intro y Escape. Los submenús (Exportar,
  Ideas recientes) salen al lado y se abren a la izquierda si no caben.
- **En el móvil**, el nombre de la idea («Mi canción ⌄») abre lo mismo que
  Archivo, con filas de 44 px y los submenús desplegados debajo.
- **Archivo:** Nueva idea, Abrir…, Ideas recientes, Guardar con «Guardado
  hace N s», Guardar como copia, Renombrar (en el propio nombre, sin hoja),
  Exportar (WAV, pistas sueltas, idea .zip), Importar audio…, Importar una
  idea (.zip)…, Compartir…, Ajustes y cuenta…, Cerrar idea y Borrar idea… en
  rojo con confirmación (no se deshace).
- **Una sola tabla de atajos.** Todos (los de la idea, Ctrl+N, O, S,
  Mayús+S, W y Ctrl+,, y los de edición que añadió la 0024: Espacio, R,
  Ctrl+Z, C, V, X, D, S, M, Supr…) viven en `src/lib/daw/menus/comandos.ts`,
  y un solo oyente en `useArchivo` decide si valen según lo que hay delante
  (el estudio, una hoja o «Tocar»). Lo que dice el menú es lo que hace la
  tecla. Con un menú abierto las letras sueltas no llegan al estudio (una R
  se ponía a grabar). Ctrl+N y Ctrl+W solo llegan con la app instalada: en
  una pestaña son del navegador.
- **«Tus ideas» es la raíz:** a ella llevan Abrir y Cerrar idea. «¿Qué
  tocamos hoy?», Nueva idea, Importar audio, seis accesos rápidos (Batería,
  Teclado, Acordes, Bajo, Grabar voz, Loops: cada uno empieza una idea nueva
  con eso abierto) y la rejilla con buscador y orden. Cada tarjeta dibuja
  sus pistas como franjas de su color. Los iconos son los Phosphor de «Tocar»
  hasta que lleguen los de arcilla.
- **Ajustes, solo del equipo y la cuenta:** «Tu cuenta de Aura» arriba del
  todo, y luego entrada (con «Qué se graba»), salida, latencia, aspecto,
  espacio, instalar, sonido y créditos. Lo de la idea (nombre, lista de
  ideas, exportar, copias) se fue a Archivo y a «Tus ideas»: mezclado con el
  micro, no se encontraba ni lo uno ni lo otro.
**Pendiente:** no se ha visto la cuenta en Ajustes con Firebase configurado
(la carpeta de pruebas no tiene `.env.local`), ni se ha probado en un iPhone.
Los accesos rápidos abren «Tocar» en su instrumento escribiendo la pestaña
en `aura-music:tocar` y volviendo a montar la pantalla: si «Tocar» cambia esa
clave, hay que cambiarlo aquí.

## 0027 · Grabar en bucle en el estudio: el ciclo y una toma por vuelta (22-nov-2026)

El dueño: «debería poder grabar encima de algo reproduciéndolo como un loop».
Es el ciclo de cualquier DAW, para tomas de micro en el estudio principal.
- **El ciclo se marca en la regla.** Un botón «Ciclo» en la esquina de la
  regla abre una hoja con «Repetir 1, 2, 4 u 8 compases» desde el compás del
  cursor, un interruptor para reproducir de largo sin perder la zona y
  «Quitar el ciclo». Con ratón se marca con Mayús y arrastrando por la regla
  (arrastrar sin más mueve el cursor, de la 0024; con el dedo, deslizar
  desplaza la línea de tiempo) y los dos bordes tienen asa: se arrastran con el dedo y saltan de
  compás en compás. Se guarda en pulsos en `Project.ciclo`, así que aguanta
  un cambio de tempo, y no entra en Deshacer, como en cualquier DAW.
- **Se ve qué se repite y en qué vuelta vas.** La zona va en tinta en la
  regla (bordes, asas y un sombreado que baja tenue por las pistas) con una
  pastilla que dice «2 compases», «Vuelta 3» al reproducir o «Toma 3» al
  grabar. Solo grabando se pone en rojo. La pastilla no se recorta: con un
  compás a tempo vivo sale por encima de la regla. Se actualiza leyendo
  `engine.vueltaDelBucle` con requestAnimationFrame, sin redibujar React.
- **El motor es el de «Tocar».** Se reutiliza `opciones.bucle` (ahora también
  da vueltas grabando y espera durante la cuenta) y `record` acepta la zona:
  arranca en su principio, con la claqueta delante. Reproducir con el ciclo
  empieza en el cursor si está dentro de la zona y si no en su principio; un
  salto más allá del final sigue de largo.
- **Una grabación continua, cortada en vueltas.** El micro graba sin cortes y
  al parar la toma se parte: cada vuelta es una región del mismo audio (solo
  cambia `clip.offset`), con la misma compensación de latencia en todas, así
  que todas cuadran igual. Suena la última vuelta entera (se admite que le
  falte un 10 %), porque es la que acabas de tocar y casi siempre la buena;
  elegir «la mejor» a máquina no es fiable. Las demás quedan en la hoja de la
  pista como «Toma 1, 2, 3…»: tocar una la pone a sonar sin parar. «Una pista
  por toma» las saca a pistas propias para superponerlas, con Deshacer. Si no
  llegaste a una vuelta entera, es una toma normal.
- **Detalles que cuadran:** la latencia se aprende solo con la primera vuelta
  (después la línea de tiempo ha vuelto atrás); el repaso al soltar da vueltas
  sobre la zona con la toma que suena; cuadrar al tempo una pista con tomas
  cuadra la que suena y suelta las demás (siguen en Deshacer). Si el clip
  se corta o se recorta con las herramientas de edición, deja de ser una
  vuelta y las tomas se esconden (`tomasUsables`), sin borrarse.
**Pendiente:** no se ha grabado con un micro de verdad (el navegador de
pruebas no tiene; se probó con una toma simulada de tres vueltas y con el
transporte dando vueltas). Falta oírlo en un iPhone y comprobar que el pulgar
llega a las asas sin mover la línea de tiempo.

## 0028 · Un solo «+ Añadir», grabar la voz en el iPhone y leer sus audios (25-nov-2026)

El dueño, probando en su iPhone: «en vez de poner Importar audio y luego al
lado Tocar instrumento, debería haber un MÁS… ahora mismo no puedo grabarme
la voz». Y un aviso mudo: «No he podido leer ese audio».
- **Un solo «+ Añadir»** en la fila de debajo de las pistas, en el estado
  vacío y en Pista › Añadir del PC. Abre una hoja con una fila por forma de
  meter una pista, cada una con su icono de arcilla: grabar voz o
  instrumento, tocar un instrumento, poner un loop, generar con IA (ponle
  algo debajo o el productor) e importar audio. Grabar y la IA se despliegan
  en su sitio: grabar dice qué entrada graba («las dos juntas», «solo la 1»)
  y deja cambiarla ahí, con la cuenta atrás de la claqueta. El estado vacío
  se queda en «Grabar» (rojo, lo principal) y «+ Añadir».
- **Grabar la voz, sin fallos callados.** Dos causas no se veían en el
  iPhone: la app abierta por http (el enlace del ordenador en casa), donde
  Safari no da micro, y una entrada elegida en Ajustes cuyo id iOS ya no
  reconoce (`deviceId: exact` fallaba siempre). Ahora lo primero se dice tal
  cual («el micro solo funciona en https…») y lo segundo se arregla solo,
  grabando con la entrada del dispositivo y avisando. Permiso denegado dice
  dónde se da en el iPhone y un micro ocupado dice que lo está
  (`src/lib/daw/micro/errores.ts`, con tests). Cualquier otro fallo al
  arrancar ya no se pierde: el transporte lo avisa en vez de no hacer nada.
- **Leer los audios del iPhone.** Plan A, `decodeAudioData` (también en su
  forma de callbacks y sobre una copia de los bytes). Plan B, para lo que el
  navegador reproduce pero no decodifica de golpe (los vídeos .mov y .mp4 de
  la galería, algunos opus): se reproduce en silencio por un
  `MediaElementSource` y se copia lo que suena, contando el avance («Sacando
  el audio del vídeo .mov: 12 de 40 s»). Si ninguno puede, el aviso dice qué
  formato era (`src/lib/daw/importar/`, con tests). El selector acepta
  también vídeos, así el iPhone ofrece la galería.
**Pendiente:** nada de esto se ha probado en un iPhone de verdad. El plan B
no se ha visto funcionar con un vídeo real (Chrome lee los mp4 con el plan
A), y si el navegador no deja reproducir tras elegir el fichero, lo dice.
## 0029 · aura Music de bolsillo: también para quien escucha (27-nov-2026)

El dueño: «quiero crear aura music de bolsillo como un spotify para gente que
se pueda crear sus canciones y playlists pero con un objetivo distinto a
suno… esto es usuario». Solo plan, sin código: `docs/PLAN-BOLSILLO.md`, y el
equipo que lo revisa, `.claude/skills/equipo-spotify/`.
- **Relevo parcial del PRD.** El PRD de Compás decía «Lo que NO vamos a
  hacer: generar canciones enteras desde un texto. Eso es Suno; aquí se
  toca». Sigue valiendo para el ESTUDIO. La app de bolsillo sí hace canciones
  enteras, porque su objetivo es otro: no la cantidad (Suno) sino la canción
  que te quedas, retocada hasta que te gusta y escuchada como en Spotify.
- **El motor y el dinero no se duplican.** Las canciones se piden a
  aura Studio (`/api/fal`, `op:'music'`), que ya cobra del monedero de aura,
  tiene los frenos y va a Lyria por Google. Entra como un `ProveedorDePistas`
  más.
- **Lo que suena una hora se hace en el móvil.** Alargar, tonos, ruido y
  binaurales no gastan créditos, y en el iPhone el bucle se renderiza a un
  fichero y suena con `<audio>` (el `AudioContext` se calla con la pantalla
  bloqueada).
**Descartado:** competir con Suno en precio por canción (a nosotros solo
Lyria nos cuesta 0,08 $; ellos venden a unos 0,02 $). Si ACE-Step convence al
oído en GPU propia, se revisa.
**Descartado:** prometer efectos de salud («alivia la migraña»). La evidencia
no lo sostiene y lo convertiría en producto sanitario.
**Descartado:** artistas que imitan a alguien real y publicar en Spotify en
la v1.
**Pendiente de su sí:** dónde vive (recomendado: la misma app, con Escuchar
como entrada y el estudio como otra puerta), el plan Música (4,99 € + IVA,
120 créditos, monedero de aura) y la maqueta de F0.
