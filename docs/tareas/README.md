# Cómo se desarrolla este proyecto con agentes

El proyecto se construye por **oleadas** de tareas (`docs/PLAN.md` §D). Todo
el ciclo puede hacerse con agentes de Google Antigravity, sin Claude Code: tú
solo lanzas agentes con los mensajes de abajo y haces `git push`.

Cada oleada tiene tres pasos, y cada paso es un agente distinto:

```
1. PREPARAR  →  2. EJECUTAR (una tarea por agente, en paralelo)  →  3. REVISAR
      ↑                                                                  │
      └──────────────── siguiente oleada ◄── aprobada ───────────────────┘
```

El estado de cada tarea está en `docs/ESTADO.md`. La especificación de las
tareas aún no escritas está en `docs/tareas/BACKLOG.md`.

## Paso 1 — Preparar la oleada (un agente)

> Actúa como **preparador** según `docs/tareas/README.md`. Prepara la
> siguiente oleada pendiente indicada en `docs/ESTADO.md`.

El preparador:

1. Lee `AGENTS.md`, `docs/ESTADO.md`, `docs/PLAN.md` §B–§D y las entradas de
   `docs/tareas/BACKLOG.md` de la oleada. Comprueba que la oleada anterior
   esté `aprobada`.
2. Lee el código ya entregado del que dependen las tareas, para citar rutas y
   funciones reales.
3. Hace los **cambios de base común** que la oleada necesita, de modo que las
   tareas paralelas no compartan archivos:
   - contratos en `packages/contracts` (esquemas de entrada y salida y la
     tabla de endpoints, como en `packages/contracts/src/auth.ts`);
   - dependencias nuevas, cambios de `src/db/schema.ts` con su migración
     (`pnpm db:generate`), variables de entorno, rutas en `lib/rutas.ts`,
     componentes de shadcn (`pnpm dlx shadcn@latest add …`);
   - lo que el BACKLOG marque como «Base común».
4. Escribe un archivo `docs/tareas/T<n>.md` por tarea, copiando
   `_plantilla.md` y siguiendo el nivel de detalle de `T10.md` y `T11.md`:
   archivos permitidos **sin solapamiento entre tareas de la oleada**, pasos
   concretos, criterios verificables, pruebas exigidas y notas con las
   trampas conocidas. Estado: `asignada`.
5. Corre la verificación de `AGENTS.md` §5, actualiza `docs/ESTADO.md` y hace
   un commit: `chore(root): preparar oleada F<fase>-O<n>`.

## Paso 2 — Ejecutar (un agente por tarea, en paralelo)

> Lee `AGENTS.md` y ejecuta la tarea `docs/tareas/T12.md` completa. Respeta
> «Archivos permitidos», documenta el código según AGENTS.md §3, corre la
> verificación de AGENTS.md §5, completa la sección «Entrega» y haz el commit
> de tus archivos según AGENTS.md §7.

Lanza todas las tareas de la oleada a la vez, cada una en su agente.

## Paso 3 — Revisar la oleada (un agente)

> Actúa como **revisor** según `docs/REVISION.md`. Revisa la oleada
> F1-O1 (tareas T10 y T11).

El revisor audita cada tarea, anota los hallazgos en su sección «Revisión» y
deja el estado en `aprobada` o `cambios`. No modifica código de producción.

Si alguna queda en `cambios`, relanza un ejecutor:

> Atiende los hallazgos de la sección «Revisión» de `docs/tareas/T10.md` y
> vuelve a entregar.

y después otra vez el revisor. Máximo dos ciclos; si persiste, decide tú.

Cuando todas estén `aprobada`: `git push` y, con el CI en verde, vuelve al paso 1.

## Reglas

- Una oleada no empieza hasta que la anterior esté `aprobada`.
- Las tareas de una oleada nunca comparten archivos. Si dos lo necesitan, ese
  archivo es base común y lo prepara el preparador.
- Ningún agente hace `push`, cambia de rama ni reescribe historial.
- Las decisiones que el plan deja abiertas (proveedor de correo, despliegue)
  no las toma un agente: las anota en `docs/ESTADO.md` → «Pendientes» y sigue
  con lo que no dependa de ellas.

## Estados

| Estado        | Significado                                   |
| ------------- | --------------------------------------------- |
| `pendiente`   | Definida en el BACKLOG; el archivo no existe  |
| `asignada`    | Archivo listo para lanzar                     |
| `entregada`   | El ejecutor terminó y completó «Entrega»      |
| `en-revision` | El revisor la está auditando                  |
| `cambios`     | Tiene hallazgos que corregir (ver «Revisión») |
| `aprobada`    | Revisada; forma parte de la base              |
