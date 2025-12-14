# RBx Backend — Stage 1 (NestJS Core + Feature Scaffolds)

Stage 1 is now complete: Stage 1a delivered the bootstrap + health probe and Stage 1b added the feature module scaffolds, ORM config, and e2e tests. Everything reads text and policy from the Stage 0 `globalConfig` file.

## Contents
- Bootstrap: `src/main.ts`, `src/app.module.ts`, global validation pipe, CORS.
- `src/common/global-config.module.ts` exporting `GLOBAL_CONFIG` provider.
- Health controller exposing `{ ok: true }`.
- Feature scaffolds: auth, users, tournaments, teams, matches, payments, admin (controllers + services + DTOs).
- `src/configuration/orm.config.ts` stubbed TypeORM datasource (uses `process.env.DATABASE_URL`).
- Tests: config regression test plus Supertest specs for `/health` and `/auth/send-otp`, DTO validation tests.
- Tooling: updated `package.json`, `tsconfig.json`, Dockerfile, `.dockerignore`.

## Commands
```bash
npm install
npm run start:dev            # http://localhost:3000
curl http://localhost:3000/health
npm run validate-config      # globalConfig typings + Nest sources
npm test                     # Jest (unit + e2e)
```

## Docker
```bash
docker build -t rbx-backend:stage1 .
docker run --rm -p 3000:3000 --env-file .env rbx-backend:stage1
# verify: curl http://localhost:3000/health
```

## Notes
- Do **not** hard-code text or fees; always inject `GLOBAL_CONFIG`.
- DTOs use `class-validator`; services are stubs awaiting repositories/business logic in later stages.
- ORM config is ready for migrations once entities are defined.
- Stage 1b completed — module scaffolds created. Next: implement business logic and wire to DB in Stage 2.
