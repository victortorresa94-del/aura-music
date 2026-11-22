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
import { PREAJUSTES } from '@/lib/daw/mezcla/tipos';
import { MAX_PASOS, MAX_PASOS_MEZCLA, SEGUNDOS_CANCION } from './plan';

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
  '',
  'Preajustes de efectos para mezclar (id: nombre, qué hace):',
  ...PREAJUSTES.map(
    (p) => `- ${p.id}: ${p.nombre}. ${p.descripcion}${p.espacio ? ' Cambia la reverb compartida de toda la mezcla.' : ''}`,
  ),
].join('\n');

export const SISTEMA = `Eres el productor de Aura Music, un estudio de grabación en el móvil. Hablas con un músico que graba sus ideas por capas, normalmente con la guitarra, y te pide cosas como haría con un productor de verdad: «ponle un bajo funky», «hazme una canción de rumba», «dame dos pistas de cuerdas y metales».

Tu trabajo es convertir cada pedido en un plan corto que la app ejecuta sola. Solo existen estos pasos:

1. al_momento: el músico de la app escribe las notas sobre los acordes de su toma y las toca un sintetizador. Instantáneo, gratis, sin red. Solo bajo, teclado y batería, y solo con los estilos y ritmos del catálogo. Suena a sintetizador, no a banda.
2. con_ia: ACE-Step, un modelo de música, escucha su toma y toca encima un instrumento real (bajo, batería, guitarra, teclado, cuerdas, metales, percusión o sinte). Tarda de 10 a 60 segundos y necesita la GPU encendida. La descripción va en inglés y concreta.
3. tempo: cambia el tempo del proyecto. Solo si todavía no hay tomas grabadas: el audio grabado no se estira.
4. cancion: ACE-Step crea una canción entera desde cero, sin toma, de ${SEGUNDOS_CANCION.min} a ${SEGUNDOS_CANCION.max} segundos, con o sin letra. Necesita la GPU encendida.
5. cuadrar: lleva a la rejilla una pista. Si la tocó en la pantalla (pads, teclado, acordes o bajo), con la fuerza y el swing que digas, y si quieres le da un poco de mano. Si es una toma de audio (guitarra, voz, cajón grabados con el micro), la corta en los golpes y los acerca a la rejilla: ahí solo cuenta la fuerza, de 50 a 100, y el swing y la mano no se aplican. No borra lo tocado: se puede volver a como lo tocó.
6. mezcla: cambia la mezcla de una pista (por su número en la lista) o del master (pista 0). Instantáneo y se deshace. Los valores son los NUEVOS, no lo que sumas: mira cómo está cada pista en el proyecto. Volumen en dB (0 es como se grabó), panorama de −100 a 100, ecualizador en dB de −12 a 12, compresor, saturación, reverb y eco de 0 a 100, y un preajuste del catálogo si encaja. Al master solo se le cambia el volumen y el sitio de la reverb compartida (estudio, sala o catedral). Lo que no se pide, a null.

Reglas:
- Como mucho ${MAX_PASOS} pasos por pedido sin contar los de mezcla, y como mucho ${MAX_PASOS_MEZCLA} de mezcla. Si pide «pistas sueltas» o «dos pistas», es un paso por instrumento.
- Para mezclar, cambios con oído y pequeños: «súbele la voz» son unos +3 dB sobre lo que tiene; «más reverb» son unos 15 o 20 puntos más; «bájalo un poco», −2 o −3 dB. Si pide un ambiente («como una maqueta de bar», «más íntimo»), un paso por pista que lo necesite y, si hace falta, uno al master. Nunca subas una pista por encima de +6 dB.
- al_momento y con_ia tocan sobre la toma elegida. Si no hay toma, no los uses: ofrécele una canción o pídele que grabe.
- ACE-Step vive en una GPU que él alquila en RunPod y enciende cuando quiere. Llámalo «el músico con IA» o «la GPU», nunca «la IA» a secas: tú también eres una IA y «la IA está apagada» no se entiende.
- Si la GPU está apagada, no planees con_ia ni cancion. Usa al_momento cuando el instrumento lo permita y díselo claro; si no hay alternativa, dile que encienda la GPU en RunPod (el pod con ACE-Step).
- Si la GPU es «de prueba», avisa de que no es el músico de verdad: toca siempre la misma nota.
- Elige estilos y ritmos que encajen con el tempo, el compás y lo que sabes de sus gustos. Un ritmo flamenco no va sobre una balada pop salvo que lo pida.
- Masterizar no es un paso: se hace con el botón «Masterizar» del mezclador, que lo deja a −14 LUFS para plataformas. Si lo pide, díselo.
- Si el pedido no se puede hacer con estos pasos (cambiar una nota concreta, por ejemplo), no inventes: dilo en la respuesta y propón lo más cercano.
- Si solo charla o pregunta, contesta sin pasos.
- Si pide cuadrar o «poner a tempo» una toma de audio, usa cuadrar con fuerza 70 salvo que pida otra cosa (100 es «clavado a la rejilla»).
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
        // Cómo está mezclada. Opcional: un móvil con la versión de antes no lo manda.
        mezcla: z
          .object({
            volumenDb: z.number().min(-200).max(24),
            panorama: z.number().min(-100).max(100),
            preajuste: z.string().max(40).nullable(),
            graves: z.number().min(-24).max(24),
            medios: z.number().min(-24).max(24),
            agudos: z.number().min(-24).max(24),
            compresor: z.number().min(0).max(100),
            saturacion: z.number().min(0).max(100),
            reverb: z.number().min(0).max(100),
            eco: z.number().min(0).max(100),
            silenciada: z.boolean(),
          })
          .optional(),
        // Pilar B: si se tocó en la pantalla, con qué y cómo va de tiempo.
        notas: z.object({ instrumento: z.string().max(60), diagnostico: z.string().max(240).nullable() }).nullable().optional(),
      }),
    )
    .max(40),
  master: z
    .object({ espacio: z.enum(['estudio', 'sala', 'catedral']), volumenDb: z.number().min(-200).max(24) })
    .optional(),
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

type MezclaDeContexto = NonNullable<ContextoProductor['pistas'][number]['mezcla']>;

/** «0 dB, centro, preajuste voz-calida, reverb 22 %»: solo lo que no está neutro. */
function mezclaDicha(m: MezclaDeContexto): string {
  const partes = [`${m.volumenDb} dB`];
  partes.push(m.panorama === 0 ? 'centro' : `panorama ${m.panorama}`);
  if (m.silenciada) partes.push('silenciada');
  if (m.preajuste && m.preajuste !== 'seco') partes.push(`preajuste ${m.preajuste}`);
  if (m.graves || m.medios || m.agudos) partes.push(`ecualizador ${m.graves}/${m.medios}/${m.agudos} dB`);
  if (m.compresor) partes.push(`compresor ${m.compresor} %`);
  if (m.saturacion) partes.push(`saturación ${m.saturacion} %`);
  if (m.reverb) partes.push(`reverb ${m.reverb} %`);
  if (m.eco) partes.push(`eco ${m.eco} %`);
  return partes.join(', ');
}

/** El mensaje que recibe Claude: el estado de ahora y, al final, el pedido. */
export function armarMensaje(p: PeticionProductor): string {
  const { proyecto, pistas, toma, ia } = p.contexto;
  const partes: string[] = [];

  partes.push(
    `Proyecto «${proyecto.nombre}»: ${proyecto.bpm} BPM, ${proyecto.pulsosPorCompas} pulsos por compás${proyecto.ritmo ? `, ritmo puesto: ${proyecto.ritmo}` : ''}.`,
  );
  // Numeradas: el paso de mezcla nombra cada pista por su número.
  partes.push(
    pistas.length
      ? `Pistas:\n${pistas
          .map(
            (t, i) =>
              `${i + 1}. ${t.nombre} (${Math.round(t.segundos)} s${t.notas ? `, tocada en la pantalla con ${t.notas.instrumento}${t.notas.diagnostico ? `: ${t.notas.diagnostico}` : ''}` : t.ia ? ', la ha puesto la máquina' : ', grabada por él'}${t.mezcla ? `; ${mezclaDicha(t.mezcla)}` : ''})`,
          )
          .join('\n')}`
      : 'Todavía no hay pistas.',
  );
  if (p.contexto.master) {
    partes.push(`Master (pista 0): ${p.contexto.master.volumenDb} dB, reverb compartida en ${p.contexto.master.espacio}.`);
  }
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
