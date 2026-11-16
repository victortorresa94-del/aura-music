# Compás

**Grabas una guitarra en el móvil y un músico de sesión te toca el bajo a tu tempo y en tu tonalidad.**

Compás es un estudio de bolsillo para maquetar canciones: grabas por capas sin
desfase, y cuando tienes una idea, el músico de sesión la escucha (tempo,
pulso, tonalidad y acordes) y te pone un bajo debajo. Hay dos formas de tocar:

| | Al momento | Con IA |
|---|---|---|
| Quién toca | El bajista de Compás escribe la línea nota a nota con tus acordes y la toca un sintetizador | ACE-Step 1.5 (código abierto, MIT) toca escuchando tu toma |
| Dónde | En el móvil, sin red | En una GPU en la nube |
| Tarda | Menos de un segundo | De 10 a 60 segundos |
| Cuesta | Nada | Céntimos por pista |
| Suena a | Un bajo limpio y exacto | Una banda |

Lo que toca la máquina entra como una pista más, en **ámbar**, que se mueve,
se recorta, se exporta y se deshace igual que las tuyas.

## Arrancar

```bash
npm install
npm run dev          # http://localhost:3000
npm run check        # tipos + tests
```

Para probar el bajo con IA sin GPU, hay un ACE-Step de mentira que habla el
mismo protocolo (y devuelve el bajo 40 ms tarde a propósito, para ver que
Compás lo cuadra):

```bash
npm run ia:falso     # puerto 8001
# y en .env.local:  ACESTEP_API_URL=http://localhost:8001
```

Para el de verdad, ver [docs/ACESTEP.md](docs/ACESTEP.md).

## Variables de entorno

| Variable | Para qué |
|---|---|
| `ACESTEP_API_URL` | Servidor de ACE-Step 1.5. Sin ella, la opción «Con IA» sale como «Sin conectar» |
| `ACESTEP_API_KEY` | La clave de ese servidor. Solo vive en el servidor de Compás, nunca llega al móvil |
| `ACESTEP_MODEL` | Modelo DiT. Por defecto `acestep-v15-base`: los turbo no saben hacer `lego` |
| `ACESTEP_PASOS` | Pasos de difusión. Por defecto 32 |

## Dónde está cada cosa

```
src/
  app/                    Next.js: la app y las rutas /api/musico/*
  components/daw/         Interfaz del estudio (MusicoSheet es el músico de sesión)
  hooks/useStudio.ts      Estado del estudio
  hooks/useMusico.ts      El músico de sesión conectado al estudio
  lib/daw/                Motor de audio: grabar, latencia, guardado, tempo, tonalidad, ritmos
  lib/musico/             El oído y el bajista: acordes, pulso, bajo, sintetizador, WAV
  lib/ia/                 Proveedores de pistas en la nube (ACE-Step hoy)
docs/                     Producto, arquitectura, decisiones e historia
scripts/acestep-falso.mjs ACE-Step de mentira para desarrollar
```

Más en [docs/PRD.md](docs/PRD.md), [docs/ARQUITECTURA.md](docs/ARQUITECTURA.md)
y [docs/DECISIONES.md](docs/DECISIONES.md).
