# Compás · manual de obra

Producto: lo que es y adónde va, en `docs/PRD.md`. Cómo está montado, en
`docs/ARQUITECTURA.md`. Por qué está así (y qué se descartó), en
`docs/DECISIONES.md`: **antes de proponer algo, mira si ya se descartó ahí.**
El plan de agosto, cuando esto vivía en web-aether, en `docs/historia/`.

**aura Music de bolsillo** (la parte para quien escucha y se hace sus canciones,
artistas y playlists, 27-nov-2026): el plan en `docs/PLAN-BOLSILLO.md` y la
decisión 0029. Lo revisa la skill `equipo-spotify` antes de construir o de
enseñar una maqueta.

## Reglas que no se discuten

1. **Si suena mientras tocas, va en local.** Si puedes esperar veinte
   segundos, puede ir a una API. Nada de lo que suena al tocar depende de red.
2. **La máquina se adapta a tu tempo y a tu compás, nunca al revés.**
3. **Ámbar = lo ha tocado la máquina.** Rojo = grabando. No hay más acentos.
   Ni un color más por decoración.
4. **Las claves solo en el servidor.** Nada de `NEXT_PUBLIC_` con secretos.
5. **Perder una toma es lo único que no se perdona.** Todo lo que se genera
   se guarda en IndexedDB como una pista más.
6. **No se cambia de proveedor de IA tocando la app:** se implementa
   `ProveedorDePistas` (`src/lib/ia/tipos.ts`) y se añade en `proveedores.ts`.

## Cómo se trabaja aquí

- `npm run check` (tipos y tests) antes de dar nada por bueno. Lo de audio se
  prueba con tests sin navegador (`src/test/senales.ts` tiene señales de
  guitarra sintéticas y una de cuerdas de acero con Karplus-Strong).
- Si un fallo se ve en el navegador, **primero un test que lo reproduzca**,
  después el arreglo (así salieron 0006 y 0007 de `DECISIONES.md`).
- Para el músico de la nube sin GPU: `npm run ia:falso` y
  `ACESTEP_API_URL=http://localhost:8001` en `.env.local`.
- Interfaz: estilos en línea con los tokens de `src/components/daw/theme.ts`
  (`T.*`), nunca colores literales. Textos de la interfaz sin rayas largas,
  en castellano de España, directos.
- Rendimiento React: `.claude/skills/vercel-react-best-practices` (Vercel, MIT).
- Comentarios y nombres en castellano, como el resto del código.
