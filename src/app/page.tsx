'use client';

import dynamic from 'next/dynamic';

// Todo el estudio depende del AudioContext, IndexedDB y del puntero: no hay
// nada que renderizar en el servidor.
const StudioApp = dynamic(() => import('@/components/daw/StudioApp'), {
  ssr: false,
  /* Mientras carga, el tema del estudio todavía no existe (lo inyecta
     StudioApp), así que aquí van los valores del fondo oscuro tal cual. Sin
     texto: es menos de un segundo y un rótulo que parpadea se lee como fallo. */
  loading: () => (
    <div
      aria-busy="true"
      aria-label="Abriendo Compás"
      style={{ position: 'fixed', inset: 0, background: '#0B0B0A' }}
    />
  ),
});

export default function Page() {
  return <StudioApp />;
}
