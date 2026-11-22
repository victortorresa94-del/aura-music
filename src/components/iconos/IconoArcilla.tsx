/**
 * Un icono de arcilla (`lib/iconos/arcilla.ts`). Es una imagen, no un trazo:
 * no toma color, y se pinta a su tamaño sin más (el webp es de 256 px, así
 * que hasta 128 px se ve nítido en una pantalla retina).
 *
 * Por defecto es decorativo (va junto a su nombre escrito): `alt` vacío. Si
 * va solo, pásale `etiqueta` y se lee.
 */

import { urlArcilla, type IdArcilla } from '@/lib/iconos/arcilla';

export function IconoArcilla({
  id,
  tamano = 40,
  etiqueta,
  apagado,
  style,
}: {
  id: IdArcilla;
  /** Lado en px. */
  tamano?: number;
  /** Texto para el lector de pantalla si el icono va sin nombre al lado. */
  etiqueta?: string;
  /** Sin elegir: un poco más tenue, para que destaque el elegido. */
  apagado?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    // eslint-disable-next-line @next/next/no-img-element -- iconos estáticos de 10 KB: next/image no aporta nada aquí
    <img
      src={urlArcilla(id)}
      alt={etiqueta ?? ''}
      aria-hidden={etiqueta ? undefined : true}
      width={tamano}
      height={tamano}
      decoding="async"
      draggable={false}
      style={{
        width: tamano,
        height: tamano,
        flexShrink: 0,
        objectFit: 'contain',
        userSelect: 'none',
        pointerEvents: 'none',
        opacity: apagado ? 0.72 : 1,
        transition: 'opacity 160ms cubic-bezier(0.23, 1, 0.32, 1)',
        ...style,
      }}
    />
  );
}
