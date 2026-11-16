# Arquitectura

## Tres capas, y la regla que las separa

| Capa | Qué hace | Dónde corre | Código |
|---|---|---|---|
| **Grabar** | Multipista, latencia compensada, edición, guardado | En el móvil, sin red | `src/lib/daw/` |
| **Entender** | Tempo, pulso, tonalidad, acordes | En el móvil, sin red | `src/lib/daw/analysis/`, `src/lib/musico/` |
| **Generar** | Bajo al momento (notas + síntesis) o con IA | Al momento en el móvil; con IA en la nube | `src/lib/musico/bajo.ts`, `src/lib/ia/` |

**La regla** (de agosto, y sigue mandando): si suena mientras tocas, va en
local. Si puedes esperar veinte segundos, puede ir a una API.

## El músico de sesión, de punta a punta

```
  tu toma (AudioBuffer)
        │
        ▼
  escucharToma()                     src/lib/musico/escucha.ts
   ├─ detectarTempo → afinarTempo    tempo a la décima
   ├─ estimarFase                    dónde cae el primer pulso
   ├─ detectarTonalidad              con lectura flamenca
   └─ detectarAcordes                croma + nota grave + Viterbi, pulso a pulso
        │
        ├──────── «Al momento» ─────────────────────────────┐
        │   escribirBajo()  →  sintetizarBajo()             │  todo en el móvil
        │   notas MIDI          síntesis aditiva en TS      │
        │                                                   ▼
        └──────── «Con IA» ──────────┐            addGeneratedTrack()
            WAV mono 32 kHz          │            pista nueva, ámbar,
            POST /api/musico/pista   │            mismo inicio y repeticiones
            (202 + tarea)            │                      ▲
            GET /api/musico/pista?tarea=…  cada 2 s         │
            GET /api/musico/audio?archivo=…                 │
            estimarDesfase + desplazar (cuadre) ────────────┘
```

## La nube: un contrato y no un proveedor

`src/lib/ia/tipos.ts` define `ProveedorDePistas` con tres operaciones:
`iniciar`, `consultar` y `descargar`. ACE-Step es la primera implementación
(`src/lib/ia/acestep.ts`) y `src/lib/ia/proveedores.ts` elige cuál se usa por
variables de entorno. Para añadir otro (Stable Audio, ElevenLabs, la API de
Suno cuando la abran): un fichero que implemente el contrato y una línea en
`proveedores.ts`. Ni la app ni las rutas cambian.

Es **asíncrono a propósito**: generar tarda de 10 a 60 s y ninguna petición
web debería quedarse colgada tanto. La ruta POST devuelve la tarea con un
202 al momento y la app pregunta cada dos segundos, con 180 s de paciencia.

### Seguridad de las rutas

- Las claves de la GPU solo existen en el servidor; el audio generado se
  descarga por un proxy (`/api/musico/audio`) que solo sirve rutas
  `/v1/audio?path=…` del propio servidor de ACE-Step.
- Las rutas solo responden a la propia app (comprobación de origen). No es
  una cerradura: antes de abrirlo al público hacen falta cuentas y un límite
  por persona (fase 6 del PRD).
- La subida está limitada a 4,2 MB y 60 s (el tope de una función de Vercel
  es 4,5 MB por petición): la toma se manda en mono a 32 kHz, 45 s como mucho.

## Decisiones de diseño de la interfaz

- **Ámbar = lo ha tocado la máquina.** El tema del estudio solo tiene dos
  acentos y los dos significan algo: rojo es grabando, ámbar es generado.
- Todo se deshace con el Deshacer de siempre: lo generado es una pista más.
- El análisis se lanza **después** de que la hoja termine de subir (320 ms):
  analizar una toma larga ocupa el hilo y haría ir a tirones la animación.
- Lo que se pulsa se nota al pulsarlo (`.daw-press`, escala 0,97 en 160 ms,
  se apaga con `prefers-reduced-motion`).

## Tests

`npm test` corre 25 pruebas sin navegador:

- `acordes.test.ts`: progresiones con senos (cadencia andaluza, Do-Sol-La m-Fa).
- `guitarra.test.ts`: una guitarra de cuerdas de acero (Karplus-Strong). Aquí
  salieron los dos fallos que se vieron en el navegador (tempo a 95 en vez
  de 96, y un acorde fantasma en el último rasgueo).
- `bajo.test.ts`: los cinco estilos, el registro del mástil, la semilla.
- `sintetizador.test.ts`: afinación (un La1 suena a 55 Hz) y que no satura.
- `pulso.test.ts`: el cuadre de desfases y el WAV.
- `acestep.test.ts`: el protocolo de ACE-Step contra un `fetch` simulado.
