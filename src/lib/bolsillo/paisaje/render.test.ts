import { describe, expect, it } from 'vitest';
import { medirComoSuena } from './cuidado';
import { mezclarPaisaje, tonoGraveParaAltavoz, wavEstereo } from './render';

const SR = 8000;

function cruces(s: Float32Array): number {
  let c = 0;
  for (let i = 1; i < s.length; i++) if (s[i - 1] < 0 && s[i] >= 0) c++;
  return c;
}

describe('el paisaje que hace el móvil', () => {
  it('sin base, un tono de 142 Hz suena a 142 Hz en una vuelta de 4 s', async () => {
    const [l] = await mezclarPaisaje(null, SR, { tono: { hz: 142, nivel: 0.5 } }, { segundosBucle: 4 });
    expect(l.length).toBe(4 * SR);
    expect(Math.abs(cruces(l) / 4 - 142)).toBeLessThan(1.5);
  });

  it('el binaural pone en cada oído un tono distinto', async () => {
    const [l, r] = await mezclarPaisaje(null, SR, { binaural: { baseHz: 200, difHz: 6, nivel: 0.5 } }, { segundosBucle: 4 });
    expect(Math.round(cruces(l) / 4)).toBe(200);
    expect(Math.round(cruces(r) / 4)).toBe(206);
  });

  it('el modo cuidado suena bastante más bajo que el normal y sin picos', async () => {
    const capas = { tono: { hz: 142, nivel: 0.6 }, ruido: { color: 'marron' as const, nivel: 0.6 } };
    const normal = medirComoSuena(await mezclarPaisaje(null, SR, capas, { segundosBucle: 6 }), SR);
    const cuidado = medirComoSuena(await mezclarPaisaje(null, SR, capas, { segundosBucle: 6, cuidado: true }), SR);
    expect(normal.lufs - cuidado.lufs).toBeGreaterThan(6);
    expect(cuidado.picoVerdadero).toBeLessThanOrEqual(-9 + 0.5);
  });

  it('la costura de la vuelta no salta', async () => {
    const [l] = await mezclarPaisaje(null, SR, { tono: { hz: 142, nivel: 0.6 } }, { segundosBucle: 3 });
    const salto = Math.abs(l[l.length - 1] - l[0]);
    let maximo = 0;
    for (let i = 1; i < l.length; i++) maximo = Math.max(maximo, Math.abs(l[i] - l[i - 1]));
    expect(salto).toBeLessThanOrEqual(maximo * 1.01);
  });

  it('el WAV es estéreo de 16 bits con su cabecera', () => {
    const wav = wavEstereo([new Float32Array(10), new Float32Array(10)], SR);
    const v = new DataView(wav);
    expect(wav.byteLength).toBe(44 + 40);
    expect(v.getUint16(22, true)).toBe(2);
    expect(v.getUint32(24, true)).toBe(SR);
  });

  it('avisa de que el altavoz del móvil casi no da un tono grave', () => {
    expect(tonoGraveParaAltavoz({ tono: { hz: 142, nivel: 0.2 } })).toBe(true);
    expect(tonoGraveParaAltavoz({ tono: { hz: 432, nivel: 0.2 } })).toBe(false);
    expect(tonoGraveParaAltavoz({})).toBe(false);
  });
});
