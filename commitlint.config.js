/**
 * Reglas de mensajes de commit (Conventional Commits en español, ver AGENTS.md).
 *
 * Se limita la lista de tipos a la acordada en AGENTS.md para que el historial
 * sea uniforme y se pueda generar un registro de cambios de forma automática.
 */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'docs', 'chore', 'refactor', 'test', 'perf']],
    // Sin regla de mayúsculas: el asunto termina con el identificador de la
    // tarea, por ejemplo `(T10)`.
    'subject-case': [0],
    'header-max-length': [2, 'always', 100],
    // El cuerpo y el pie pueden llevar líneas largas (URL, coautorías).
    'body-max-line-length': [0],
    'footer-max-line-length': [0],
  },
};
