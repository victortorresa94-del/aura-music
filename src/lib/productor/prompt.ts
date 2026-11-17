/**
 * Lo que sabe el productor antes de oír tu pedido.
 *
 * El texto de sistema no cambia nunca entre peticiones (catálogo incluido):
 * así se queda en la caché de Anthropic y cada pedido paga solo lo nuevo. Lo
 * que cambia (el proyecto, tu toma, tu cerebro, la conversación) va en el
 * mensaje del usuario, detrás.
 */

import { z } from 'zod';
import { ESTILOS } from '@/lib/musico/bajo';
import { ESTILOS_TECLAS } from '@/lib/musico/teclas';
import { GROOVES } from '@/lib/daw/rhythm/grooves';
import { INSTRUMENTOS } from '@/lib/ia/tipos';
import { MAX_PASOS, SEGUNDOS_CANCION } from './plan';

const catalogo = [
  'Estilos de bajo al momento (id: nombre, cómo suena):',
  ...ESTILOS.map((e) => `- ${e.id}: ${e.nombre}. ${e.descripcion}`),
  '',
  'Estilos de teclas al momento:',
  ...ESTILOS_TECLAS.map((e) => `- ${e.id}: ${e.nombre}. ${e.descripcion}`),
  '',
  'Ritmos de batería al momento (id: nombre, familia, tempos que admite):',
  ...GROOVES.map((g) => `- ${g.id}: ${g.nombre}, ${g.familia}, ${g.bpm[0]}-${g.bpm[1]} BPM`),
  '',
  `Instrumentos con IA: ${INSTRUMENTOS.join(', ')}.`,
].join('\n');

export const SISTEMA = `Eres el productor de Aura Music, un estudio de grabación en el móvil. Hablas con un músico que graba sus ideas por capas, normalmente con la guitarra, y te pide cosas como haría con un productor de verdad: «ponle un bajo funky», «hazme una canción de rumba», «dame dos pistas de cuerdas y metales».

Tu trabajo es convertir cada pedido en un plan corto que la app ejecuta sola. Solo existen estos pasos:

1. al_momento: el músico de la app escribe las notas sobre los acordes de su toma y las toca un sintetizador. Instantáneo, gratis, sin red. Solo bajo, teclado y batería, y solo con los estilos y ritmos del catálogo. Suena a sintetizador, no a banda.
2. con_ia: ACE-Step, un modelo de música, escucha su toma y toca encima un instrumento real (bajo, batería, guitarra, teclado, cuerdas, metales, percusión o sinte). Tarda de 10 a 60 segundos y necesita la GPU encendida. La descripción va en inglés y concreta.
3. tempo: cambia el tempo del proyecto. Solo si todavía no hay tomas grabadas: el audio grabado no se estira.
4. cancion: ACE-Step crea una canción entera desde cero, sin toma, de ${SEGUNDOS_CANCION.min} a ${SEGUNDOS_CANCION.max} segundos, con o sin letra. Necesita la GPU encendida.
5. cuadrar: lleva a la rejilla una pista que tocó en la pantalla (pads, teclado, acordes o bajo), con la fuerza y el swing que digas, y si quieres le da un poco de mano. No borra lo tocado: se puede quitar. Solo vale para las pistas que dicen «tocada en la pantalla».

Reglas:
- Como mucho ${MAX_PASOS} pasos por pedido. Si pide «pistas sueltas» o «dos pistas», es un paso por instrumento.
- al_momento y con_ia tocan sobre la toma elegida. Si no hay toma, no los uses: ofrécele una canción o pídele que grabe.
- ACE-Step vive en una GPU que él alquila en RunPod y enciende cuando quiere. Llámalo «el músico con IA» o «la GPU», nunca «la IA» a secas: tú también eres una IA y «la IA está apagada» no se entiende.
- Si la GPU está apagada, no planees con_ia ni cancion. Usa al_momento cuando el instrumento lo permita y díselo claro; si no hay alternativa, dile que encienda la GPU en RunPod (el pod con ACE-Step).
- Si la GPU es «de prueba», avisa de que no es el músico de verdad: toca siempre la misma nota.
- Elige estilos y ritmos que encajen con el tempo, el compás y lo que sabes de sus gustos. Un ritmo flamenco no va sobre una balada pop salvo que lo pida.
- Si el pedido no se puede hacer con estos pasos (mezclar, masterizar, cambiar una nota concreta), no inventes: dilo en la respuesta y propón lo más cercano.
- Si solo charla o pregunta, contesta sin pasos.
- Si una pista tocada en la pantalla va descuadrada (lo dice su diagnóstico) y pide arreglarla, usa cuadrar; si no lo pide, puedes proponerlo en la respuesta, como un productor: «lo has tocado bien pero arrastras en el 3; ¿lo cuadro al 70 %?».
- La respuesta va en español de España, corta (una a tres frases), directa y cálida, como un productor que sabe lo que hace. Sin rayas largas. Habla de música, no de la app.
- En «recuerda» apunta solo gustos nuevos y duraderos que deduzcas de verdad («le tira la rumba», «prefiere bajos con poco adorno»), nunca el pedido literal.
- En «sugerencias», dos o tres siguientes pedidos que tengan sentido ahora, escritos como los diría él.

Catálogo:
${catalogo}`;

/** Lo que manda el móvil sobre el proyecto. Se valida en el servidor. */
export const ContextoSchema = z.object({
  proyecto: z.object({
    nombre: z.string().max(120),
    bpm: z.number().min(20).max(400),
    pulsosPorCompas: z.number().int().min(1).max(16),
    ritmo: z.string().max(80).nullable(),
  }),
  pistas: z
    .array(
      z.object({
        nombre: z.string().max(120),
        ia: z.boolean(),
        segundos: z.number().min(0).max(3600),
        // Pilar B: si se tocó en la pantalla, con qué y cómo va de tiempo.
        notas: z.object({ instrumento: z.string().max(60), diagnostico: z.string().max(240).nullable() }).nullable().optional(),
      }),
    )
    .max(40),
  toma: z
    .object({
      nombre: z.string().max(120),
      bpm: z.number().min(20).max(400),
      tonalidad: z.string().max(40).nullable(),
      progresion: z.string().max(300),
      segundos: z.number().min(0).max(3600),
    })
    .nullable(),
  ia: z.object({ disponible: z.boolean(), prueba: z.boolean() }),
});

export const TurnoSchema = z.object({
  de: z.enum(['musico', 'productor']),
  texto: z.string().max(1200),
});

export const PeticionProductorSchema = z.object({
  pedido: z.string().trim().min(1).max(600),
  contexto: ContextoSchema,
  cerebro: z.string().max(6000),
  conversacion: z.array(TurnoSchema).max(8),
});

export type ContextoProductor = z.infer<typeof ContextoSchema>;
export type TurnoProductor = z.infer<typeof TurnoSchema>;
export type PeticionProductor = z.infer<typeof PeticionProductorSchema>;

/** El mensaje que recibe Claude: el estado de ahora y, al final, el pedido. */
export function armarMensaje(p: PeticionProductor): string {
  const { proyecto, pistas, toma, ia } = p.contexto;
  const partes: string[] = [];

  partes.push(
    `Proyecto «${proyecto.nombre}»: ${proyecto.bpm} BPM, ${proyecto.pulsosPorCompas} pulsos por compás${proyecto.ritmo ? `, ritmo puesto: ${proyecto.ritmo}` : ''}.`,
  );
  partes.push(
    pistas.length
      ? `Pistas: ${pistas.map((t) => `${t.nombre} (${Math.round(t.segundos)} s${t.notas ? `, tocada en la pantalla con ${t.notas.instrumento}${t.notas.diagnostico ? `: ${t.notas.diagnostico}` : ''}` : t.ia ? ', la ha puesto la máquina' : ', grabada por él'})`).join('; ')}.`
      : 'Todavía no hay pistas.',
  );
  partes.push(
    toma
      ? `Toma elegida: «${toma.nombre}», ${Math.round(toma.segundos)} s, a ${Math.round(toma.bpm)} BPM${toma.tonalidad ? `, en ${toma.tonalidad}` : ''}${toma.progresion ? `, acordes: ${toma.progresion}` : ''}.`
      : 'No hay ninguna toma grabada elegida.',
  );
  partes.push(
    `Músico con IA (ACE-Step en su GPU de RunPod): ${ia.disponible ? (ia.prueba ? 'encendido, pero es el servidor de prueba' : 'encendido') : 'apagado'}.`,
  );

  if (p.cerebro.trim()) partes.push(`\nLo que recuerdas de él:\n${p.cerebro.trim()}`);

  if (p.conversacion.length) {
    partes.push('\nConversación reciente:');
    for (const t of p.conversacion) partes.push(`${t.de === 'musico' ? 'Él' : 'Tú'}: ${t.texto}`);
  }

  partes.push(`\nSu pedido ahora: ${p.pedido}`);
  return partes.join('\n');
}
