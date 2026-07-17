# Domain modules

The application is an incremental modular monolith. New behavior belongs to a
domain under `modules/` and is exposed through a small public entry point.

## Dependency direction

`app` and `components` -> module public API -> application/domain -> infrastructure -> `shared`

- Route handlers and UI must not import another module's internal files.
- Only `infrastructure` code may access the privileged database client.
- Application code coordinates use cases and depends on ports, not framework APIs.
- Domain code contains types and business rules without Next.js or Supabase imports.
- `shared` is limited to genuinely cross-cutting authentication, database,
  validation, observability, and configuration code.

Existing implementations in `lib/server` and `services` remain behind module
facades while each domain is migrated. This keeps the refactor deployable and
avoids a flag-day rewrite.

