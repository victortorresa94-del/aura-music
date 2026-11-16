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
