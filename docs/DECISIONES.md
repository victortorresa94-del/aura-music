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

## 0015 · Instrumentos en la pantalla: se graban notas y suena su audio (17-nov-2026)

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
  notas sí.
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
medir la latencia real en un iPhone; un paso `cuadrar` en el productor.
