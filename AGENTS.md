# Guía de Reglas y Directrices para Agentes y Desarrolladores (AGENTS.md)

Este documento define los estándares obligatorios para cualquier agente de IA o desarrollador humano que colabore en este repositorio. Estas reglas garantizan la coherencia, seguridad y mantenibilidad de la base de código.

---

## 1. Permisos y Aislamiento en la API

- **Aislamiento Multiempresa Estricto:** Toda tabla del modelo relacional (excepto la tabla raíz `empresas`) contiene la columna `empresa_id`. En cualquier endpoint, servicio o consulta Drizzle ORM, es **estrictamente obligatorio** filtrar por el `empresa_id` del tenant autenticado o validado en la sesión.
- **Principio de Menor Privilegio:** Los roles y permisos deben ser explícitos. Ningún endpoint debe exponer información de otra empresa bajo ninguna circunstancia.
- **Validación de Parámetros:** Todo parámetro de entrada (`body`, `query`, `param`) debe validarse en la capa de entrada mediante esquemas Zod (`ZodValidationPipe`) antes de ser procesado por la lógica de la aplicación.

---

## 2. Secretos y Credenciales Fuera del Repositorio

- **Prohibido Commitear Secretos:** Nunca incluyas cadenas de conexión reales, contraseñas, tokens JWT, claves privadas ni credenciales en el código fuente o en Git.
- **Uso Estricto de `.env`:** Toda configuración dependiente del entorno debe residir en variables de entorno leídas mediante `process.env`.
- **Mantenimiento de `.env.example`:** Cualquier nueva variable de entorno requerida debe añadirse de inmediato a `.env.example` con valores de muestra ficticios y comentarios explicativos.
- **Archivos Ignorados:** El archivo `.gitignore` debe contener en todo momento `.env`, `.env.local` y cualquier variación de secretos.

---

## 3. Comentarios que Explican el "Porqué"

- **Foco en la Intención Arquitectónica:** No documentes lo que el código hace de forma obvia (ej: evitar `// Asigna el id al usuario`). Documenta **por qué** se tomó esa decisión técnica, el trade-off evaluado o el problema que se está resolviendo.
- **Ayuda para Futuros Mantenedores:** Si un patrón parece inusual o responde a una limitación de una librería (por ejemplo, configuración de decoradores para ESM en Vitest o `empresa_id` redundante para evitar JOINs costosos), incluye una explicación concisa en el bloque de comentarios.
- **Decisiones Importantes a ADRs:** Las decisiones estructurales mayores deben quedar registradas en un archivo ADR dentro de `docs/adr/`.

---

## 4. Pruebas y Validación Antes de Cada Commit

- **Verificación Local Obligatoria:** Antes de ejecutar `git commit`, es obligatorio verificar que la suite completa pase sin fallos:
  ```bash
  # 1. Validación de estilo y tipos
  pnpm lint

  # 2. Ejecución de pruebas unitarias y de integración
  pnpm test

  # 3. Compilación de producción
  pnpm build
  ```
- **Tolerancia Cero a Builds Rotos:** Ningún cambio que impida la compilación o rompa pruebas existentes debe llegar a ramas remotas ni a pull requests.

---

## 5. Conventional Commits en Español

- Todos los mensajes de commit deben seguir la especificación [Conventional Commits](https://www.conventionalcommits.org/) redactados en **español** y en minúsculas (salvo acrónimos).
- **Estructura:**
  ```text
  tipo(ámbito): descripción clara y concisa en minúsculas

  [cuerpo opcional que explique los motivos del cambio]
  ```
- **Tipos Permitidos:**
  - `feat`: Nueva funcionalidad para el usuario o API.
  - `fix`: Corrección de un defecto o bug.
  - `docs`: Modificaciones en documentación o comentarios.
  - `chore`: Tareas de mantenimiento, dependencias o tooling.
  - `refactor`: Cambios en el código que no alteran comportamiento ni corrigen bugs.
  - `test`: Creación o modificación de pruebas automatizadas.
  - `perf`: Mejoras de rendimiento en consultas o renderizado.
- **Ejemplos Válidos:**
  - `feat(api): implementar endpoint get /api/health con chequeo de postgres`
  - `feat(web): agregar tarjeta de estado en vivo para monitoreo de api`
  - `docs: agregar directrices en agents.md y adr de arquitectura`
  - `chore(root): actualizar dependencias de pnpm y configuracion de docker`
