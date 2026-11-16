import { describe, expect, it } from 'vitest';
import { guitarra, SR } from '@/test/senales';
import { escucharToma } from './escucha';
import { afinarTempo } from './pulso';
import { detectarTempo } from '@/lib/daw/analysis/tempo';

/**
 * Con una guitarra de cuerdas de acero (Karplus-Strong), no con senos: es
 * donde salieron los dos fallos que se vieron en el navegador el 16-nov.
 */
describe('una toma de guitarra de verdad', () => {
  const toma = guitarra(['La m', 'Sol', 'Fa', 'Mi'], 96);

  it('saca 96 BPM y no 95: el detector a la unidad se queda corto', () => {
    const bruto = detectarTempo(toma, SR).bpm;
    expect(Math.abs(afinarTempo(toma, SR, bruto) - 96)).toBeLessThanOrEqual(0.2);
  });

  it('oye la cadencia andaluza en las dos vueltas, sin acordes fantasma al final', () => {
    // La claqueta del proyecto está en 100 por defecto: manda lo que has tocado.
    const oido = escucharToma(toma, SR, 100);
    expect(oido.fuenteBpm).toBe('toma');
    const nombres = oido.acordes.filter((a) => a.acorde).map((a) => a.nombre);
    expect(nombres).toEqual(['La m', 'Sol', 'Fa', 'Mi', 'La m', 'Sol', 'Fa', 'Mi']);
    expect(oido.progresion).toBe('La m · Sol · Fa · Mi');
  });

  it('si la claqueta ya iba a 96, manda la claqueta', () => {
    expect(escucharToma(toma, SR, 96).fuenteBpm).toBe('proyecto');
  });
});
