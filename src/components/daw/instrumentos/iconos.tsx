'use client';

/**
 * Los iconos de los instrumentos, al estilo de Aura: Phosphor (MIT) en
 * duotono cuando está apagado y relleno cuando está elegido. Phosphor no
 * tiene batería, cajón, bajo, órgano ni metales: esos se dibujan aquí con su
 * misma rejilla (256), su mismo trazo (16, o 24 en negrita) y la misma capa de
 * relleno al 20 %, para que no se note cuál es de quién.
 *
 * El color lo pone quien los usa. En este estudio el verde significa «lo ha
 * hecho la máquina», así que los instrumentos que tocas van en tinta.
 */

import {
  Cloud,
  Guitar,
  Lightning,
  MusicNotesSimple,
  PianoKeys,
  Repeat,
  WaveSawtooth,
  WaveSine,
  WaveSquare,
  type IconWeight,
} from '@phosphor-icons/react';
import type { IconoInstrumento as Id } from '@/lib/instrumentos/registro';

export type PesoIcono = Extract<IconWeight, 'duotone' | 'fill' | 'bold' | 'regular'>;

interface Props {
  icono: Id;
  size?: number;
  color?: string;
  weight?: PesoIcono;
}

/** Un dibujo propio: `relleno` es la capa del duotono (o el sólido en «fill»), `trazo` el contorno. */
function Propio({ size, color, weight, relleno, trazo }: { size: number; color: string; weight: PesoIcono; relleno: React.ReactNode; trazo: React.ReactNode }) {
  const grosor = weight === 'bold' ? 24 : 16;
  return (
    <svg width={size} height={size} viewBox="0 0 256 256" fill="none" aria-hidden focusable={false}>
      {weight === 'duotone' || weight === 'fill' ? (
        <g fill={color} opacity={weight === 'fill' ? 1 : 0.2}>
          {relleno}
        </g>
      ) : null}
      <g stroke={color} strokeWidth={grosor} strokeLinecap="round" strokeLinejoin="round" fill="none">
        {trazo}
      </g>
    </svg>
  );
}

export function IconoInstrumento({ icono, size = 24, color = 'currentColor', weight = 'duotone' }: Props) {
  const p = { size, color, weight };
  switch (icono) {
    case 'piano':
      return <PianoKeys {...p} />;
    case 'electrico':
      return <Lightning {...p} />;
    case 'guitarra':
      return <Guitar {...p} />;
    case 'pad':
      return <Cloud {...p} />;
    case 'sinte':
      return <WaveSquare {...p} />;
    case 'sub':
      return <WaveSine {...p} />;
    case 'analogico':
      return <WaveSawtooth {...p} />;
    case 'pizzicato':
      return <MusicNotesSimple {...p} />;
    case 'bateria':
      return (
        <Propio
          {...p}
          relleno={<path d="M40 104v56c0 17.7 39.4 32 88 32s88-14.3 88-32v-56c0 17.7-39.4 32-88 32s-88-14.3-88-32Z" />}
          trazo={
            <>
              <ellipse cx="128" cy="104" rx="88" ry="32" />
              <path d="M40 104v56c0 17.7 39.4 32 88 32s88-14.3 88-32v-56" />
              <path d="M72 128v56M184 128v56M128 136v56" />
              <path d="M84 28l40 60M180 36l-44 52" />
            </>
          }
        />
      );
    case 'caja-de-ritmos':
      return (
        <Propio
          {...p}
          relleno={<rect x="32" y="56" width="192" height="144" rx="16" />}
          trazo={
            <>
              <rect x="32" y="56" width="192" height="144" rx="16" />
              <rect x="60" y="120" width="32" height="32" rx="6" />
              <rect x="112" y="120" width="32" height="32" rx="6" />
              <rect x="164" y="120" width="32" height="32" rx="6" />
              <path d="M64 88h48M152 88h40" />
            </>
          }
        />
      );
    case 'cajon':
      return (
        <Propio
          {...p}
          relleno={<rect x="56" y="40" width="144" height="184" rx="12" />}
          trazo={
            <>
              <rect x="56" y="40" width="144" height="184" rx="12" />
              <path d="M56 72h144" />
              <circle cx="128" cy="152" r="28" />
            </>
          }
        />
      );
    case 'congas':
      return (
        <Propio
          {...p}
          relleno={<path d="M40 72h64l-10 144H50ZM136 96h80l-12 120h-56Z" />}
          trazo={
            <>
              <path d="M40 72h64l-10 144H50Z" />
              <path d="M136 96h80l-12 120h-56Z" />
              <path d="M36 56h72M132 80h88" />
            </>
          }
        />
      );
    case 'organo':
      return (
        <Propio
          {...p}
          relleno={<path d="M48 128a12 12 0 0 1 24 0v72H48ZM92 88a14 14 0 0 1 28 0v112H92ZM140 56a14 14 0 0 1 28 0v144h-28ZM188 112a12 12 0 0 1 24 0v88h-24Z" />}
          trazo={
            <>
              <path d="M48 200v-72a12 12 0 0 1 24 0v72" />
              <path d="M92 200V88a14 14 0 0 1 28 0v112" />
              <path d="M140 200V56a14 14 0 0 1 28 0v144" />
              <path d="M188 200v-88a12 12 0 0 1 24 0v88" />
              <path d="M32 200h192" />
            </>
          }
        />
      );
    case 'cuerdas':
    case 'contrabajo':
      return (
        <Propio
          {...p}
          relleno={<path d="M128 104c-26 0-40 14-40 34 0 12 8 20 8 30 0 10-16 18-16 34 0 22 22 34 48 34s48-12 48-34c0-16-16-24-16-34 0-10 8-18 8-30 0-20-14-34-40-34Z" />}
          trazo={
            <>
              <path d="M128 104c-26 0-40 14-40 34 0 12 8 20 8 30 0 10-16 18-16 34 0 22 22 34 48 34s48-12 48-34c0-16-16-24-16-34 0-10 8-18 8-30 0-20-14-34-40-34Z" />
              <path d="M128 104V32M116 32h24M128 236v12" />
              <path d="M112 176h32" />
            </>
          }
        />
      );
    case 'metales':
      return (
        <Propio
          {...p}
          relleno={<path d="M152 112l64-40v112l-64-40Z" />}
          trazo={
            <>
              <path d="M24 120h128M24 136h128" />
              <path d="M152 112l64-40v112l-64-40" />
              <path d="M24 112v32" />
              <path d="M80 120V88M104 120V88M128 120V88" />
              <path d="M72 88h16M96 88h16M120 88h16" />
            </>
          }
        />
      );
    case 'marimba':
      return (
        <Propio
          {...p}
          relleno={<path d="M36 64h24v136H36ZM76 76h24v112H76ZM116 88h24v88h-24ZM156 100h24v64h-24ZM196 112h24v40h-24Z" />}
          trazo={
            <>
              <rect x="36" y="64" width="24" height="136" rx="6" />
              <rect x="76" y="76" width="24" height="112" rx="6" />
              <rect x="116" y="88" width="24" height="88" rx="6" />
              <rect x="156" y="100" width="24" height="64" rx="6" />
              <rect x="196" y="112" width="24" height="40" rx="6" />
            </>
          }
        />
      );
    case 'bajo':
      return (
        <Propio
          {...p}
          relleno={<path d="M108 148c-20-28-64-24-76 6-10 26 4 52 30 62 26 10 52 0 58-24 4-16-4-30-12-44Z" />}
          trazo={
            <>
              <path d="M108 148c-20-28-64-24-76 6-10 26 4 52 30 62 26 10 52 0 58-24 4-16-4-30-12-44Z" />
              <path d="M96 160l112-112" />
              <path d="M196 36l24 24M188 52l-8-8M204 68l-8-8M212 28l8 8" />
              <circle cx="72" cy="184" r="10" />
            </>
          }
        />
      );
  }
}

/** Los iconos de las familias de la pantalla «Tocar» (las cuatro que tocas y los loops). */
export type IconoFamilia = 'pads' | 'teclado' | 'acordes' | 'bajo' | 'loops';

export function IconoDeFamilia({ familia, size = 26, color = 'currentColor', weight = 'duotone' }: { familia: IconoFamilia; size?: number; color?: string; weight?: PesoIcono }) {
  // Los loops no son un instrumento: llevan la flecha que vuelve, la de repetir.
  if (familia === 'loops') return <Repeat size={size} color={color} weight={weight} aria-hidden />;
  const icono: Id = familia === 'pads' ? 'bateria' : familia === 'teclado' ? 'piano' : familia === 'acordes' ? 'guitarra' : 'bajo';
  return <IconoInstrumento icono={icono} size={size} color={color} weight={weight} />;
}
