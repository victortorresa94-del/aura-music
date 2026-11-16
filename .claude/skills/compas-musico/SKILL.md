---
name: compas-musico
description: Cómo trabajar en el músico de sesión de Compás (el oído que saca tempo, pulso, tonalidad y acordes; el bajista que escribe notas; el sintetizador; y el proveedor de ACE-Step en la nube). Úsala antes de tocar src/lib/musico, src/lib/ia, src/hooks/useMusico.ts o MusicoSheet.tsx, o al añadir un instrumento o un proveedor de IA.
---

# El músico de sesión de Compás

## Mapa

- `src/lib/musico/escucha.ts` orquesta el oído: `detectarTempo` → `afinarTempo`
  (a la décima) → `estimarFase` → `detectarTonalidad` → `detectarAcordes`.
- `acordes.ts`: croma por pulso + nota grave + plantillas de 24 acordes +
  Viterbi. Cambiar de acorde sin golpe cuesta mucho más (decisión 0007).
- `bajo.ts`: escribe NOTAS (MIDI) con cinco estilos; `sintetizador.ts` las toca.
- `teclas.ts`: acordes con enlace de voces (colchón, a golpes, arpegio);
  `sintetizarTeclas` con timbre «piano» o «colchon».
- `bateria.ts`: los ritmos del estudio a TU tempo (`tempoParaRitmo` prueba el
  doble y la mitad), ordenados por lo bien que encajan, y `colocarRitmo` pone
  el primer golpe en tu primer pulso.
- Todo lo de «al momento» pasa por `tocarAlMomento(track, oido, peticion)` en
  `useMusico.ts`, con `PeticionMomento` (bajo, teclado o batería).
- `pulso.ts`: ataques, fase, tempo fino, desfase entre pistas, desplazar.
- `src/lib/ia/acestep.ts`: protocolo oficial (`/release_task`,
  `/query_result`, `/v1/audio`), tarea `lego`, `track_name` en inglés
  (`bass`, `drums`, `guitar`, `keyboard`, `strings`, `brass`, `percussion`,
  `synth`). Solo modelos base.

## Antes de cambiar nada

1. Escribe el test que falla con una señal de `src/test/senales.ts`
   (`rasgueo` con senos, `guitarra` con Karplus-Strong, `clics`).
2. Arregla. `npm run check`.
3. Si es visible, pruébalo en el navegador: `npm run dev` + `npm run ia:falso`,
   importa una toma (input de fichero) y abre «Ponle un bajo a esta toma».

## Trampas conocidas

- El detector de tempo va en saltos de 10 ms: sin `afinarTempo`, 96 BPM sale 95.
- El quinto armónico del La grave cae en Do#: un La m mal segmentado se lee La.
- El último rasgueo hacia arriba suena con la cuerda grave floja: el último
  acorde necesita dos golpes para contar.
- El detector de tonalidad no entiende la cadencia andaluza (confianza 0):
  la tonalidad se oculta si la confianza es menor de 0,15.
- El servidor de prueba (`npm run ia:falso`) devuelve SIEMPRE la misma nota.
  No sirve para juzgar cómo suena la IA, solo el recorrido.
- Una función de Vercel admite 4,5 MB por petición: la toma va en mono a
  32 kHz y como mucho 45 s.
