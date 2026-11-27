'use client';

import dynamic from 'next/dynamic';

// Todo depende de IndexedDB y del audio del navegador: nada que pintar en el servidor.
const BolsilloApp = dynamic(() => import('@/components/bolsillo/BolsilloApp'), {
  ssr: false,
  loading: () => (
    <div aria-busy="true" aria-label="Abriendo aura Music" style={{ position: 'fixed', inset: 0, background: '#FAFBFA' }} />
  ),
});

export default function Page() {
  return <BolsilloApp />;
}
