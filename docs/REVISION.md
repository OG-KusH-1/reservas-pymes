# Guía del revisor

El revisor audita una oleada ya entregada. **Solo reporta**: no modifica
código de producción ni pruebas. Escribe únicamente en la sección «Revisión»
de cada tarea, en el campo `estado` de su encabezado y en `docs/ESTADO.md`.

## Procedimiento

1. Lee `AGENTS.md`, la tarea (`docs/tareas/T<n>.md`) completa y su «Entrega».
2. Mira qué cambió: `git log --oneline` y `git show --stat <commit>` de los
   commits de la tarea; lee los archivos completos, no solo el diff.
3. Ejecuta la verificación de `AGENTS.md` §5 (incluye `pnpm test:int` si se
   tocó la API y `pnpm test:e2e` si se tocó la web). No confíes en lo que
   declare la entrega.
4. Prueba a mano lo esencial contra la aplicación en marcha (`pnpm dev`):
   el caso feliz y al menos un caso de error de cada endpoint o pantalla.
5. Recorre la lista de comprobación.
6. Escribe el informe en «Revisión» y fija el estado.

## Lista de comprobación

**Alcance**

- Solo se tocaron los «Archivos permitidos». Todo cambio fuera de ellos es un hallazgo importante.
- Se cumple cada punto de «Criterio de terminado», con una prueba que lo demuestre.
- No se agregaron dependencias sin autorización.

**Seguridad y aislamiento multiempresa** (lo más importante)

- Toda consulta filtra por la empresa de la sesión (`@EmpresaId()`), también en
  `update` y `delete`, y también al validar identificadores relacionados
  recibidos en el cuerpo (un `servicioId` de otra empresa debe responder 404).
- Hay una prueba de integración por endpoint que demuestra que una empresa no
  puede leer ni modificar datos de otra.
- Cada endpoint declara quién puede usarlo (`@Roles` o `@Publico()` justificado).
- Ninguna respuesta ni registro expone `passwordHash`, `tokenHash`, tokens,
  cookies ni datos personales innecesarios.
- Las entradas se validan con esquemas de `@portfolio/contracts`; los
  parámetros de ruta, con `ZodPipe`.
- Los endpoints públicos y los sensibles tienen `@Throttle()`.
- En la web: sin `dangerouslySetInnerHTML`, sin datos de sesión en
  `localStorage`, redirecciones solo a rutas internas.

**Corrección**

- Reglas de negocio según `docs/PLAN.md`, `docs/API.md` y `docs/MODELO_DATOS.md`.
- Operaciones de varios pasos dentro de una transacción.
- Condiciones de carrera: dos peticiones simultáneas no dejan datos
  inconsistentes (la restricción de la base de datos es la garantía final).
- Fechas calculadas en la zona horaria de la empresa, incluidos los cambios de hora.
- Estados de carga, error y vacío en cada vista con datos remotos.

**Calidad**

- Comentarios TSDoc según `AGENTS.md` §3: explican el porqué, lo que hay que
  cuidar y cómo extender. Faltan o son triviales → hallazgo importante.
- Sin `any`, `@ts-ignore`, `eslint-disable`, `.skip` ni código comentado.
- Sin duplicar utilidades existentes (cliente de API, formato, fábricas).
- Las pruebas verifican comportamiento, no detalles de implementación, y
  fallarían si la funcionalidad se rompiera.
- Accesibilidad y diseño adaptable en las pantallas (teclado, etiquetas, 375 px, tema oscuro).

## Informe

Escríbelo en la sección «Revisión» de la tarea:

```markdown
**Veredicto:** Aprobada | Requiere cambios
**Verificación ejecutada:** <comandos y resultado, con número de pruebas>

### Críticos

- `ruta:línea` — qué falla, un escenario concreto que lo demuestra y la corrección.

### Importantes

- …

### Menores

- …
```

- **Críticos:** fuga entre empresas, fallo de seguridad, pérdida o corrupción
  de datos, verificación en rojo, criterio de terminado incumplido.
- **Importantes:** errores de lógica en casos borde, pruebas ausentes,
  comentarios ausentes, cambios fuera de alcance.
- **Menores:** mejoras que no bloquean.

Estado resultante: `aprobada` si no hay críticos ni importantes; si los hay,
`cambios`. No reportes preferencias de estilo: de eso se ocupan Prettier y ESLint.

Al aprobar toda la oleada, actualiza la tabla de avance y la bitácora de
`docs/ESTADO.md`, pasa los «Menores» no resueltos a «Pendientes y avisos» y
haz un commit: `docs: revisar oleada F<fase>-O<n>`.
