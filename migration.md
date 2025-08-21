# CLAUDE.md

This file provides instructions for Claude Code when helping with the migration from **TypeORM** to **Prisma**.

## Context

- Prisma is already installed and set up in this project.
- The database schema has been pulled into a `schema.prisma` file.
- TypeORM is currently used across the codebase for entities, repositories, and migrations.
- Goal: Remove TypeORM and replace all persistence logic with Prisma.
- Access the prisma client at @prisma/client
- Replace TypeOrm in each feature folder then check for bugs, if the issues are related to another feature folder, fix those issues as well.
- Use prisma.service in my ./database folder like described at https://www.prisma.io/nestjs

## Migration Guidelines

1. **Entity Replacement**
   - Remove TypeORM entities (`@Entity`, `@Column`, etc.).
   - Update all references to use the corresponding Prisma models (`User`, `Post`, etc.).
   - Always import and use the proper generated types from the Prisma client instead of manually defining interfaces.

2. **Repository & Query Migration**
   - Remove TypeORM repositories.
   - Update any code that depends on them to use Prisma queries.
   - Use `findMany`, `findUnique`, `create`, `update`, `delete`, etc., from the Prisma client.

3. **Migrations**
   - Stop using TypeORM migrations.
   - Use Prisma migrations (`prisma migrate dev` / `prisma migrate deploy`).
   - Clean up TypeORM migration files once confirmed.

4. **Services**
   - Update services to work with Prisma models instead of TypeORM entities/repositories.
   - Do not introduce Prisma calls directly in controllers — services handle all persistence logic.

5. **Error Handling**
   - Replace TypeORM-specific errors with Prisma equivalents.
   - Ensure unique constraint and relation errors are updated (`UniqueConstraintViolation` → `PrismaClientKnownRequestError`).

6. **Testing**
   - Update tests to use Prisma for seeding and querying test data.
   - Use `prisma db seed` or custom seed scripts instead of TypeORM utilities.

## Code Style Notes

- Do **not** mix TypeORM and Prisma — fully migrate one module at a time.
- Preserve existing function signatures and business logic where possible.
- Use generated Prisma client types (`User`, `Post`, etc.) consistently.
- Keep all persistence logic inside services, not controllers.

---

## Tasks for Claude

When editing code in this repository:

- Delete TypeORM entity files.
- Delete TypeORM decorators, repositories, and migration files.
- Ensure all code that referenced TypeORM entities now uses Prisma models and generated types.
- Update services accordingly, keeping controllers unchanged.
- After changes, verify consistency with the `schema.prisma`.
- Make sure everything is typed properly avoid using unknown and any.
