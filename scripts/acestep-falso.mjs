/**
 * Un ACE-Step de mentira, para desarrollar sin GPU. NO ES IA.
 *
 * Habla el mismo protocolo que el servidor oficial (`/release_task`,
 * `/query_result`, `/v1/audio`, `/health`) y devuelve siempre lo mismo: un La
 * grave de 55 Hz en cada pulso, con 40 ms de retraso A PROPÓSITO para ver en
 * la app que la red de seguridad del cuadre lo detecta y lo corrige. No
 * escucha la toma ni sigue los acordes. El ACE-Step de verdad, en
 * `docs/ACESTEP.md`.
 *
 *   node scripts/acestep-falso.mjs          → escucha en el puerto 8001
 *   ACESTEP_API_URL=http://localhost:8001   → en .env.local de Compás
 */

import { createServer } from 'node:http';

const PUERTO = Number(process.env.PORT ?? 8001);
/** Con «falso» en el nombre: así la app sabe que es de prueba. */
const SERVICIO = 'ACE-Step falso (una nota fija)';
const RETRASO = 0.04;
const tareas = new Map();

function wav(samples, sr) {
  const buf = Buffer.alloc(44 + samples.length * 2);
  buf.write('RIFF', 0);
  buf.writeUInt32LE(36 + samples.length * 2, 4);
  buf.write('WAVEfmt ', 8);
  buf.writeUInt32LE(16, 16);
  buf.writeUInt16LE(1, 20);
  buf.writeUInt16LE(1, 22);
  buf.writeUInt32LE(sr, 24);
  buf.writeUInt32LE(sr * 2, 28);
  buf.writeUInt16LE(2, 32);
  buf.writeUInt16LE(16, 34);
  buf.write('data', 36);
  buf.writeUInt32LE(samples.length * 2, 40);
  samples.forEach((s, i) => buf.writeInt16LE(Math.round(Math.max(-1, Math.min(1, s)) * 32767), 44 + i * 2));
  return buf;
}

function bajo(bpm, duracion) {
  const sr = 48000;
  const out = new Float32Array(Math.round(duracion * sr));
  const T = 60 / bpm;
  for (let t = RETRASO; t < duracion; t += T) {
    const i0 = Math.round(t * sr);
    for (let i = 0; i < T * 0.8 * sr && i0 + i < out.length; i++) {
      const s = i / sr;
      out[i0 + i] = 0.5 * Math.sin(2 * Math.PI * 55 * s) * Math.exp(-s * 3) * Math.min(1, s / 0.004);
    }
  }
  return wav(out, sr);
}

const sobre = (data) => JSON.stringify({ data, code: 200, error: null, timestamp: Date.now() });

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PUERTO}`);
  try {
    if (req.method === 'POST' && url.pathname === '/release_task') {
      const peticion = new Request(url, { method: 'POST', headers: req.headers, body: req, duplex: 'half' });
      const form = await peticion.formData();
      const id = `falsa-${Date.now().toString(36)}`;
      tareas.set(id, {
        bpm: Number(form.get('bpm') ?? 100),
        duracion: Number(form.get('audio_duration') ?? 10),
        pista: form.get('track_name'),
        desde: Date.now(),
      });
      console.log(`[acestep-falso] ${id}: ${form.get('task_type')} ${form.get('track_name')} a ${form.get('bpm')} BPM, ${form.get('key_scale') ?? 'sin tonalidad'}`);
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(sobre({ task_id: id, status: 'queued' }));
      return;
    }
    if (req.method === 'POST' && url.pathname === '/query_result') {
      let cuerpo = '';
      for await (const trozo of req) cuerpo += trozo;
      const [id] = JSON.parse(cuerpo).task_id_list ?? [];
      const tarea = tareas.get(id);
      const listo = tarea && Date.now() - tarea.desde > 3000;
      const item = !tarea
        ? { task_id: id, status: 2 }
        : listo
          ? { task_id: id, status: 1, result: JSON.stringify([{ file: `/v1/audio?path=${encodeURIComponent(`/tmp/${id}.wav`)}` }]) }
          : { task_id: id, status: 0 };
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(sobre([item]));
      return;
    }
    if (req.method === 'GET' && url.pathname === '/v1/audio') {
      const id = (url.searchParams.get('path') ?? '').replace(/^\/tmp\//, '').replace(/\.wav$/, '');
      const tarea = tareas.get(id);
      if (!tarea) return void res.writeHead(404).end();
      res.writeHead(200, { 'Content-Type': 'audio/wav' }).end(bajo(tarea.bpm, tarea.duracion));
      return;
    }
    if (url.pathname === '/health') {
      // Compás busca «falso» en el nombre para no venderlo como IA.
      res.writeHead(200, { 'Content-Type': 'application/json' }).end(sobre({ status: 'ok', service: SERVICIO, version: '1.0' }));
      return;
    }
    res.writeHead(404).end();
  } catch (error) {
    console.error(error);
    res.writeHead(500).end();
  }
}).listen(PUERTO, () => console.log(`[acestep-falso] escuchando en http://localhost:${PUERTO}`));
