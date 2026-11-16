# Aura Music · Plan maestro

17 de noviembre de 2026. Investigación hecha con cuatro agentes en paralelo:
- los grandes del sector;
- instrumentos tocables y efectos;
- la IA musical;
- la PWA en iPhone y Android.

Las fuentes de cada dato están en los informes de los agentes (resumidos aquí) y en `docs/DECISIONES.md`.

> **La apuesta en una frase.** El único estudio de bolsillo donde tocas o grabas una idea, y una banda y un productor que te conocen la convierten en canción, a tu tempo, en tu compás y con tu gusto.

---

## 0. Dónde estamos hoy

**Ya funciona:**
- **Grabar:** multipista en el navegador con latencia que se aprende de las tomas; regla de compases, mover, recortar y repetir clips, deshacer.
- **Ritmos:** flamencos y pop.
- **Músico de sesión:** oye tu toma (tempo, tonalidad, acordes) y pone bajo, batería o teclas al momento, o 8 instrumentos con ACE-Step 1.5.
- **Productor con Claude:** le pides con palabras, ejecuta y recuerda tus gustos.
- **Salida:** canción entera con IA, exportar WAV, enlace en Vercel.
- **Aspecto:** blanco estilo Aura.

**Lo que falta y es básico** (lo dicen los agentes y lo dijiste tú):
- **Mezcla:** mezclador, panorama, efectos (reverb, eco, ecualizador, compresor) y masterizado.
- **Instrumentos tocables** como los de GarageBand.
- **Edición:** piano roll y separar pistas de una canción.
- **Cuenta y nube:** cuenta, guardado en la nube y cerebro compartido con Aura.
- **PWA:** que funcione de verdad sin conexión.

---

## 1. Lo que tienen los grandes (y lo que nadie hace bien)

Comparados: GarageBand, Logic Pro 12 / Logic para iPad 3 (enero de 2026), Ableton Live 12 / Note / Move, FL Studio 2026 (con su agente Gopher), BandLab (que compró Aiode en julio de 2026), Soundtrap, Koala, Suno Studio 2.0, Moises, Google Flow Music (Lyria 3.5), ElevenMusic y Mozart AI.

**Lo mínimo que se espera** (lo tienen todos, a nosotros nos falta):
- **Mezcla:** efectos de inserción, panorama y envíos. Es el hueco más grande.
- **Instrumentos y edición:** instrumentos táctiles y acordes que tocan solos, como en GarageBand; pads de batería y secuenciador; piano roll y automatización.
- **IA y salida:** separar pistas (Logic, Ableton 12.3, BandLab, Moises, Suno); masterizado de un toque (Logic, BandLab); exportar pistas sueltas y MIDI para acabar en Logic o Ableton.
- **Tomas y nube:** varias tomas y quedarse con lo mejor de cada una (comping); copia en la nube.

**Donde ya vamos por delante:**
- **El músico desde una toma cruda:** Logic necesita Chord ID y un iPad potente; nosotros lo hacemos desde una toma de guitarra en cualquier móvil.
- **La latencia** se aprende de las tomas (BandLab hace un test y ya).
- **Un productor que actúa y recuerda.** El de FL edita pero no recuerda, y el chat de Suno vive solo en una sesión.
- **Crear de verdad a tamaño de móvil.** Logic es solo iPad y Soundtrap móvil solo reproduce.

**Lo que más gusta a la gente:**
- gratis y de verdad;
- tocar en la pantalla;
- músicos que siguen tus acordes;
- canciones al instante;
- quitar instrumentos a una canción para practicar;
- un flujo tipo sampler;
- comunidad.

**Lo que más odian:**
- perder trabajo tras actualizar;
- tomas desfasadas con Bluetooth;
- muros de pago;
- IA que no hace caso y gasta créditos;
- quitar descargas de un día para otro;
- pistas separadas con sangrado;
- acordes mal leídos;
- rejillas que no saben de 3/4 ni de 6/8.

**Cinco cosas que nadie hace bien y pueden ser nuestras:**
1. **La banda te sigue a ti, no a una claqueta.** Mapa de tempo desde tomas tocadas libres (rubato, el acelerando de la bulería), rejillas nativas del doce y del 6/8–3/4, y acordes afinados para el frigio.
2. **Sesión manos libres.** Con la guitarra colgada dices «otra desde el estribillo» y lo hace; la orden se recorta sola de la toma.
3. **Un cerebro que se ve y se edita:** tu batería, tu reverb, tus tonos. Cada acción del productor es un paso con nombre que se deshace y se compara A/B.
4. **Comping automático con consejo.** Escucha todas tus tomas, monta la mejor por compás y afinación, explica por qué y dice qué volver a grabar.
5. **Músicos que diriges por secciones, y salida limpia:** pistas sueltas, MIDI, mapa de tempo y acordes hacia Logic o Ableton, y lo que haces es tuyo.

---

## 2. Los pilares

Cada pilar es un bloque de trabajo con su carpeta, para que varios agentes trabajen a la vez sin pisarse.

### A · Mezcla y efectos (lo básico que falta)

- **Mezclador** a pantalla completa:
  - por pista: volumen en dB, panorama, mute y solo;
  - medidores de nivel en vivo, master con limitador;
  - en el móvil, una tira por pista que se desliza de lado.
- **Efectos por pista**, con 4 ranuras: ecualizador de 3 bandas, compresor, saturación, chorus, eco (delay) y reverb.
- **Dos envíos compartidos** (reverb y eco), como en un estudio: una sola reverb para todas las pistas suena más junta y gasta menos.
- **Ajustes de fábrica pensados para el móvil:** «Voz cálida», «Guitarra flamenca», «Batería con pegada», «Sala», «Catedral».
- **Exportar con todo:** el mismo grafo se monta en `OfflineAudioContext` y el WAV sale igual que suena.
- **Masterizado de un toque:** objetivo de −14 LUFS y techo de −1 dBTP para plataformas; −16 LUFS para escucha en el móvil. Las cifras salen de la skill `audio-mixing-mastering` y de la guía de Spotify.
- **El productor también mezcla:** «súbele la voz», «más reverb a la guitarra», «déjalo como una maqueta de bar».
- **Cómo:**
  - Por pista: recorte, ecualizador de 3 bandas, compresor, saturación (tanh con sobremuestreo), panorama y fader.
  - **Reverb** con respuesta de sala generada por código: 0 bytes y sin licencias.
  - Placa de dominio público y salas reales de OpenAIR (CC-BY, revisando cada una) como extra.
  - **Delay** sincronizado al tempo; **chorus** con dos líneas moduladas.
  - Todos los nodos son nativos del navegador. Una sola función, `buildMixGraph`, monta el grafo para escuchar y para exportar, así que lo exportado suena idéntico.
- **Carpeta:** `src/lib/daw/mezcla/` y `src/components/daw/mezclador/`.

### B · Instrumentos tocables, «como GarageBand»

- **Batería en pads:** acústica, electrónica (808/909) y cajón flamenco, con pads sensibles a dónde tocas y repetición de nota.
- **Teclado:** piano, piano eléctrico y sinte, con tamaño de teclas que se ajusta, escala para no fallar y arpegiador.
- **Tiras de acordes:** los acordes de tu tonalidad en botones. Tocas uno y suena bien, con rasgueo de guitarra, piano o cuerdas, y modo automático como el Smart Guitar.
- **Bajo:** cuerdas táctiles o notas de la escala.
- **Lo que tocas se graba como notas, no como audio**, para poder editarlo y cambiar el sonido luego.
- **«La IA lo graba bien»:**
  - cuantizar con fuerza ajustable y swing;
  - cuantizar con el groove de tu toma de guitarra, no solo con la rejilla;
  - humanizar velocidades;
  - quitar notas fantasma;
  - convertir tu golpe flojo en un patrón de batería que encaja.
  - El productor lo propone: «lo has tocado bien pero arrastras en el 3; ¿lo cuadro al 70 %?».
- **Piano roll** sencillo para corregir notas.
- **Sonidos** con muestras de licencia libre, descargadas por paquetes y guardadas para usarlas sin red.
- **Carpeta:** `src/lib/instrumentos/` y `src/components/daw/instrumentos/`.

**Cómo, según el agente de instrumentos** (fuentes en su informe):

- **Librerías:**
  - **smplr 1.2.0** (MIT, al día): instrumentos con muestras. Usa nuestro propio contexto de audio y sirve también para exportar.
  - **tonal 6.6** (MIT): escalas y acordes.
  - **spessasynth** (Apache-2.0): un set General MIDI completo, más adelante.
- **Descartadas:**
  - Tone.js: trae su propio reloj y duplicaría el motor.
  - WebAudioFont: GPL.
  - Superpowered: cierra.
  - Elementary: parado desde 2024.
- **Sonidos, todos con licencia libre:**

| Instrumento | Origen y licencia | Peso |
|---|---|---|
| 808/909 | Sintetizados, ampliando el kit que ya tenemos | 0 MB |
| Batería acústica | Karoryfer (CC0), Versilian (CC0) o SM Drums (dominio público) | ~2,5 MB |
| Piano | Splendid Grand (dominio público) | ~2,5 MB ligero, ~24 MB entero |
| Piano eléctrico | Greg Sullivan (CC-BY) o TX81Z (CC0) | ~1,5 MB |
| Bajo | Karoryfer Growlybass / Swagbass (CC0) | ~1,5 MB |
| Guitarra | Karoryfer (CC0), o cuerda sintetizada (Karplus-Strong) | 0–2 MB |
| Cuerdas | VSCO-2-CE (CC0) | ~1,5 MB |

- **Descargas:**
  - La primera carga no baja ninguna muestra.
  - Cada instrumento se baja al abrirlo; todo junto son unos 12 MB.
  - Los paquetes de calidad alta, solo con wifi.
  - Se alojan en nuestro servidor y se guardan en el móvil.
  - Pantalla de créditos automática, que exige la licencia CC-BY.
- **Latencia del toque:**
  - No hay medidas publicadas recientes; estimación: 30–60 ms en iPhone reciente y 50–90 ms en Android bueno.
  - Los pads suenan al apoyar el dedo, sin pasar por React.
  - Calibración propia: «toca 8 veces con la claqueta», distinta de la del micro.
- **Grabar lo que tocas:**
  - Se guardan los golpes en bruto (tiempo, nota, fuerza) y los cambios se aplican sin borrar el original, así que todo se puede deshacer.
  - **Cuantizar** con fuerza y swing, como Ableton.
  - **Grooves** sacados del Groove MIDI Dataset (CC-BY 4.0), un JSON de pocos KB.
  - **Humanizar** con ruido «1/f», que suena más humano que el ruido normal.
  - Quitar dobles golpes de menos de 30 ms.
  - La IA solo elige los ajustes.
- **Captura siempre activa,** como Ableton Note: si tocaste algo bueno sin grabar, se recupera.
- **Teclados MIDI:** en Android Chrome sí. En iPhone no hay Web MIDI; llegará con la app nativa.
- **Cómo se ve:**
  - Pads de 64 px o más.
  - Escala fija por defecto.
  - 8 tiras con los acordes de tu tonalidad.
  - Rasgueo con la dirección y la velocidad del gesto, de 8 a 25 ms entre cuerdas.

### C · IA de primera

- **Productor 2.0.** Hoy decide entre 4 pasos; tendrá más herramientas:
  - mezclar, efectos, cuantizar, tocar un instrumento;
  - separar pistas, rehacer un trozo, versión en otro estilo;
  - masterizar, nombrar y ordenar tus ideas.
- **ACE-Step entero:**
  - **rehacer un trozo** (repaint): «cambia solo el estribillo»;
  - **versión** (cover): tu idea en rumba o en lo-fi;
  - **sacar pistas** (extract);
  - **completar** una canción a medias;
  - **entrenar tu estilo** con tus canciones (LoRA).
**Ranking por «wow por euro»**, con fuentes y licencias en el informe del agente de IA:

1. **Más ACE-Step en la GPU que ya pagamos.** Sin proveedor nuevo y por unos 0,002 € por pista.
   - `repaint`: «rehaz los compases 9 a 12», de 3 a 90 s.
   - `cover`: tu idea en reguetón o en rumba, conservando melodía y acordes.
   - `complete`: cantas y sale la banda debajo.
   - Bien de 30 s a unos 4 min; más largo, se repite.
2. **Tocas la guitarra y salen notas editables**, en el móvil y gratis.
   - Basic Pitch de Spotify (Apache-2.0) y ChordMini en ONNX (MIT, 9,6 MB, WebGPU).
   - Cuantizar y swing sin aprendizaje automático.
3. **Que el productor «oiga».** Por cada toma, un resumen en texto: tonalidad, tempo, acordes, notas, y etiquetas y huella de CLAP.
   - CLAP: código CC0 y modelos Apache-2.0; corre en el navegador, unos 118 MB, se descarga solo si lo activas.
   - Sirve para el cerebro y para «búscame ideas como esta».
4. **Separar pistas en el servidor** con HTDemucs (MIT), segundos de GPU por canción.
   - En el móvil tardaría minutos.
   - Los modelos RoFormer son mejores, pero sus pesos son de uso solo de investigación: no, sin revisión legal.
5. **Masterizado con referencia:** «que suene como esta canción».
   - Matchering es GPL-3.0: solo en nuestro servidor y nunca en la app, y con revisión legal.
   - RoEx de pago como «master pro», a 1,76–2,20 € por master.
6. **Tu sonido:** entrenar ACE-Step con 10 a 20 canciones tuyas.
   - Modo LoKr, unos 5 minutos de GPU, mínimo 16 GB.
   - Función premium; cargar ese entrenamiento desde la API hay que montarlo.
7. **Segundo motor de canciones:** Lyria 3.5 de Google, 0,08 $ por canción, con voces y marca de agua SynthID.
   - Falta confirmar que esté disponible en la UE.
   - Descartados:
     - ElevenLabs: sus condiciones obligan al plan Enterprise para dárselo a usuarios.
     - Suno y Udio: no tienen API abierta.
8. **Más adelante:**
   - tocar en directo con la IA (Magenta RealTime 2, pesos CC BY 4.0);
   - un músico que acompaña una melodía (Anticipatory Music Transformer, Apache-2.0);
   - voz: tu voz a otro timbre con RVC (MIT), solo con tu propia voz, con consentimiento y avisando.

**Otras ideas:**
- **Pista de acordes visible** que manda a los músicos, como Logic 12 con Chord ID.
- **«Pistas sueltas» de verdad:** separar (HTDemucs) o generar por instrumento (`lego`).

**Cuidado legal:**
- En julio de 2026 un tribunal de Múnich falló contra Suno por los datos de entrenamiento (GEMA contra Suno, en primera instancia).
- Los datos de ACE-Step no están auditados. Los resultados son de uso comercial según su licencia, pero conviene vigilarlo.
- Descartados por licencia no comercial: RAVE, MERT, MuQ, MuScriptor y so-vits-svc (AGPL).

### D · Tu cuenta de Aura y el mismo cerebro

Investigado contra el código de Aura:
- **Entrar:** con tu cuenta de Aura, el mismo Firebase (`aether-app-59bd1`), con Google, Apple o email.
- **Ideas en la nube:** se guardan en `users/{uid}/auraMusicProjects`, y el audio va directo del móvil a Storage (`users/{uid}/aura-music/…`). Las reglas de Aura ya lo permiten.
- **Cerebro:** el mismo que el de Aura, a través de aura-mcp (`api/studio.ts`, que aceptaría tu sesión de Firebase). Así Aura sabe lo que haces en música, y al revés.
- **Sincronizar** entre móvil y PC. En iPhone, la app instalada y Safari no comparten almacenamiento, así que la nube lo arregla.
- **Riesgos:**
  - una regla de Storage solo para audio y con tamaño máximo;
  - permitir la web de Aura Music en el almacenamiento de Aura (CORS);
  - comprobar en nuestro servidor que la cuenta está aprobada.

### E · PWA de primera (abrirla entera desde el móvil)

Prioridad 1:
- **Service worker con Serwist:** guarda toda la app y sus trozos, carga primero lo guardado si no hay red, aviso de «Nueva versión · Actualizar» y nunca se actualiza a media toma.
- **Manifest completo:** `id`, capturas para la instalación de Android, iconos «maskable» y recibir audios compartidos desde WhatsApp (en Android).
- **iPhone:**
  - `navigator.audioSession` («grabar y reproducir» al grabar, «reproducir» al escuchar), que además arregla el interruptor de silencio;
  - pedir el micro solo al tocar Grabar;
  - si el audio se queda mudo al volver a la app, rehacer el contexto de audio;
  - mantener la pantalla encendida mientras grabas.
- **Guía de instalación** en la primera vez: en iPhone no hay botón de instalar.
- **Copias de seguridad:** exportar e importar la idea entera en un zip (pistas y proyecto) a Archivos o iCloud.

Después: la app en el App Store con Capacitor, como Aura. Lo que se gana:
- el micro sin preguntar cada vez;
- grabar con la pantalla bloqueada;
- archivos que no se borran;
- recibir audios desde otras apps.

### F · Diseño Aura premium

- El «3D», los verdes y el cristal de Aura: el cristal solo donde hay algo debajo que se mueve, y el trabajo sobre papel.
- Movimiento y tacto con las skills de Emil (`emil-design-eng`, `mobile-native`).
- Primera vez guiada: graba, ponle algo y pídeselo al productor.
- Accesibilidad AA.

### G · Infraestructura, claves y costes

- **Claves solo en el servidor** (Vercel): `ANTHROPIC_API_KEY`, `ACESTEP_API_URL`, `ACESTEP_API_KEY`. El candado `AURA_MUSIC_CODIGO` va antes que las claves.
- **La GPU que se apaga sola:** el pod de RunPod pasa a servidor «serverless», que solo cobra mientras genera, o se apaga solo tras X minutos sin uso.
- **Límites por cuenta** cuando haya cuentas, contador de gasto y registro de errores.

---

## 3. Cómo lo construimos: olas y agentes

Cada ola son varias sesiones de Claude en paralelo, cada una en su propia rama y carpeta (worktree), con su parte del código. Al final de cada ola, una sesión integra, pasa `npm run check` y lo prueba en el móvil.

| Ola | En paralelo | Qué sale |
|---|---|---|
| **1 · Lo básico de un estudio** | A (mezclador y efectos) · B1 (pads, teclado y tiras de acordes, grabación como notas, cuantizar) · E1 (PWA offline, audioSession, actualización) · G1 (claves en Vercel y candado) | Se mezcla, se toca y se instala de verdad |
| **2 · Tuyo y en la nube** | D (cuenta de Aura, ideas en la nube, cerebro compartido) · C1 (productor 2.0, separar pistas, audio a notas) · B2 (piano roll, más sonidos) | Tus ideas en todos lados y un productor que hace de todo |
| **3 · Lo que nadie tiene** | C2 (tu estilo con LoRA, rehacer un trozo, versiones, voz) · comping automático · sesión manos libres · F (cristal y 3D) · App Store con Capacitor | El mejor estudio del móvil |

**Reglas para que los agentes no se pisen:**
- **Una carpeta por pilar.** Los ficheros comunes (`useStudio`, `engine`, `StudioApp`) solo los toca la sesión de integración, o se amplían por puntos de enganche pequeños.
- **Antes de mezclar:** cada sesión deja tests y su entrada en `DECISIONES.md`.
- **Nada llega a `main`** sin `npm run check` en verde y sin probar en el móvil.

---

## 4. Skills que usamos

- **Diseño** (ya en tu equipo, en este orden): `taste` → `impeccable` → `emil-design-eng`. También `equipo-movimiento-y-tacto`, `equipo-ux-ia`, `equipo-textos-de-interfaz` y `equipo-accesibilidad`.
- **Nuevas en el proyecto**, de skills.sh, MIT y leídas antes de instalar:
  - `mobile-native` (Emil Kowalski): que la web se sienta app en el móvil;
  - `audio-mixing-mastering`: objetivos de volumen y control de calidad de la mezcla;
  - `pwa-development`: offline y caché.
- **Del proyecto:** `compas-musico` (el músico) y `vercel-react-best-practices`.
- **Descartadas:**
  - Tone.js: no tiene licencia;
  - `dsp`: es para C/C++;
  - otras: menos de 100 instalaciones y sin revisar.

---

## 5. Lo que necesito de ti

1. **Clave de Anthropic** en Vercel (ver los pasos abajo), y elegir un código de acceso para el candado.
2. **La GPU:** seguir con el pod que enciendes y apagas a mano, o pasar a «serverless» (pagas solo por canción generada).
3. **Luz verde a la ola 1** con varios agentes a la vez.

### Cómo poner la clave en Vercel (2 minutos)

1. Entra en vercel.com → proyecto **aura-music** → **Settings** → **Environment Variables**.
2. Añade `AURA_MUSIC_CODIGO` con un código que te inventes, para todos los entornos.
3. Añade `ANTHROPIC_API_KEY`. Usa la tuya de console.anthropic.com, o crea una para Aura Music en **API Keys**.
4. Cuando el pod funcione, añade también `ACESTEP_API_URL` y `ACESTEP_API_KEY`.
5. Dímelo y vuelvo a desplegar. El móvil te pedirá el código una vez.
