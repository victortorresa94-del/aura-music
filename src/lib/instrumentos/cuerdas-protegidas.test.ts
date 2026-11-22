/**
 * SONIDO PROTEGIDO · Las cuerdas de «Acordes».
 *
 * El dueño, 22-nov-2026: «el sonido que hay ahora en acordes, cuerdas, me
 * flipa… guárdalo como top, que no se pierda jamás».
 *
 * Es la sección de cuerdas de VS Chamber Orchestra: Community Edition
 * (VSCO 2 CE, Versilian Studios, CC0): chelos, violas y violines sostenidos
 * en forte, con el vibrato de sección del original, 15 notas de Do 2 a Si 5,
 * tocados con ataque 0,06 s y suelta 0,45 s (`packs.ts`, paquete `cuerdas`).
 *
 * Este test falla si cambia un solo byte de esas muestras, sus ajustes o su
 * sitio en «Acordes». Si quieres otras cuerdas, añádelas como instrumento
 * NUEVO (otro paquete, otro id): estas no se tocan. Copia permanente en git:
 * la etiqueta `sonido-cuerdas-favorito`.
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getPaquete } from './packs';
import { getInstrumento } from './registro';

const HUELLAS: Record<string, string> = {
  '36.mp3': '10263bd74581debdac5fcdd4dc12dc64e077da52e256b27d3be5601f73cf869d',
  '40.mp3': 'a8d3117e0b4cb28fc0b0885f700d60003530c35747e82c66a911880508a91a88',
  '43.mp3': 'daeeaae4a10745d2d40e0117265373c6b0b8620b333692b258d3a95903ebd0c0',
  '47.mp3': 'e8f3c284385a971b383e5e1a66a818843f131bd605cc0ca288fc3c9dce24ddf9',
  '50.mp3': '240d23fac23bc3ba1cbd1fcf7ba40b140c77279b54e93580e4770de9aac15162',
  '52.mp3': 'efc77171307028704ab7bc139ffb47a4ab2d5da7f63ae70f7ea17bdcae66804f',
  '55.mp3': '912ded53d029e0411c428a1e81e2a2ac79683ca6de285f029741d895a51d21d7',
  '59.mp3': '0c2fed06ef7d8df34fd3b5f99a44e3c503f1e45e44f8e5d8a5971c86dd8ba053',
  '62.mp3': '24f421546e14732ae15c396990df7e76373c63a28ac7f6f80dc0db4038af96d8',
  '65.mp3': 'e6e1ffe4ed59e266d7c1255910cfb5dacbdf7c73f164a6ef4b177888ff8cf39c',
  '69.mp3': 'c762e71815d6b8aecccfc778b7468bb50a075a8f14fd64d159ec28f278b1b0ca',
  '72.mp3': '0cdbd71b40857890cd360d4b7e0c6c2252570d60eeadc2c433826449baeb3f40',
  '76.mp3': '6344f0ef58fb1d7fe747b9c3addeacae7c8fd00cb4c00ce491157346c44c5db7',
  '79.mp3': '546fe5774adfa27e956dee752f78cc6513ac6762c584431c996e1aef12f65847',
  '83.mp3': '1d9eeda78e8d6d0cbd3885d8d481ba86a4964dacb4ca8889712451069375495d',
};

const AVISO = 'Sonido protegido por el dueño (cuerdas de «Acordes»): no se cambia; añade otras cuerdas como instrumento nuevo.';

describe('sonido protegido: las cuerdas de Acordes', () => {
  it('las 15 muestras son exactamente las de siempre', () => {
    const carpeta = join(process.cwd(), 'public', 'samples', 'cuerdas');
    for (const [nombre, huella] of Object.entries(HUELLAS)) {
      const real = createHash('sha256').update(readFileSync(join(carpeta, nombre))).digest('hex');
      expect(real, `${AVISO} Cambió ${nombre}.`).toBe(huella);
    }
  });

  it('el paquete suena con los mismos ajustes y las mismas notas', () => {
    const paquete = getPaquete('cuerdas');
    expect(paquete, AVISO).not.toBeNull();
    expect(paquete?.sonido, AVISO).toEqual({ ataque: 0.06, suelta: 0.45 });
    expect(paquete?.licencia, AVISO).toBe('CC0-1.0');
    expect(paquete?.archivos.map((a) => a.nombre).sort(), AVISO).toEqual(Object.keys(HUELLAS).sort());
  });

  it('sigue siendo «Cuerdas» y sigue usando ese paquete', () => {
    const def = getInstrumento('cuerdas');
    expect(def.id, AVISO).toBe('cuerdas');
    expect(def.paquete, AVISO).toBe('cuerdas');
  });
});
