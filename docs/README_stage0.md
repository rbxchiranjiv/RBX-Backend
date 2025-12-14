# RBx Stage 0 — Global Config Layer

This stage delivers the single source of truth for **all customizable knobs** in RBx.

## Contents
- `config/globalConfig.ts` — typed object with every human-visible text, fee, threshold, schedule default, payment toggle, etc.
- `types/globalConfig.d.ts` — strong typings consumed by TypeScript tooling.
- Tooling (`package.json`, `tsconfig.json`, `jest.config.js`) to validate and test the config.

## How it works
1. Import the config anywhere in the backend:
   ```ts
   import globalConfig from "./config/globalConfig";

   const registrationCut = globalConfig.tournament.platformCut;
   ```
2. For Android, expose the same JSON via an endpoint or build asset. Example Kotlin usage:
   ```kotlin
   val configJson = assets.open("globalConfig.json").bufferedReader().readText()
   val config = json.decodeFromString<GlobalConfigDto>(configJson)
   val reminder = config.notifications.templates.thirtyMinReminder
   ```
3. All services (API, workers, Android) must reference this file so changes propagate automatically.

## Updating values
- Edit `config/globalConfig.ts` only; never hard-code elsewhere.
- Run `npm run validate-config` to ensure typings stay aligned.
- Commit alongside a changelog entry so downstream services know about the behavioral shift.

## Commands
```bash
npm install
npm run validate-config  # type-checks the config
npm test                 # executes Jest assertions on key defaults
```

## Test plan
- Jest file `tests/globalConfig.test.ts` ensures critical invariants (platform cuts, BR team size, organizer fees).
- Extend with more cases when new sections are added.

## Verification checklist
1. `npm run validate-config` passes (TypeScript OK).
2. `npm test` succeeds (Jest + ts-jest wired up).
3. Consumers can import `globalConfig` in Node without additional setup.
4. Android build can bundle serialized config (JSON export step to be added in later stages).
5. Environment variables listed in `env.example` cover all sensitive hooks (gateways, DB, Redis, observability).
