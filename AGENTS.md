# Sentimenta Agent Guide

## Project Context

Sentimenta is a SaaS for digital reputation analytics. It has a FastAPI backend,
Celery/Redis workers, PostgreSQL persistence, a Next.js web app, and a Vite PWA.
The critical product promise is that user-visible data is real, traceable, and
not invented when ingestion or analysis fails.

## Guardrails

- Do not connect to, modify, restart, or deploy production unless the user
  explicitly asks for that production operation in the current task.
- Never print or commit secrets. Treat `.env`, tokens, database dumps, cookies,
  API responses with credentials, and OAuth values as sensitive.
- Keep changes small and reviewable. Prefer one narrow fix with tests over broad
  refactors.
- Do not run destructive database commands outside a throwaway local/test
  database.
- Do not call real Apify, LLM, Stripe, Instagram, TikTok, or YouTube APIs in CI
  unless a task explicitly marks the run as an external-integration test.
- Preserve existing dirty worktree changes. Do not revert files you did not edit.

## Required Checks

Run the smallest relevant set first, then broaden when touching shared behavior:

- Backend: `cd backend && python -m pytest`
- Shared/web: `npm run build:packages`, `npm run type-check`, `npm run build:web`
- Mobile: `npm run build --workspace=@sentimenta/mobile --if-present`
- E2E smoke: `npm run test:e2e:smoke`
- Security/deps: `npm run audit:prod`

If a check cannot run because the local environment is missing dependencies,
report that directly and rely on GitHub Actions after the PR.

## Review Guidelines

- Flag P0/P1 issues only unless asked for a broad audit.
- Prioritize auth bypass, IDOR, token exposure, unsafe CORS, leaked PII/secrets,
  billing/credit abuse, destructive data changes, and user-visible data
  correctness.
- Verify that dashboard metrics and pipeline statuses cannot imply success when
  ingestion, analysis, or LLM calls failed.
- Prefer adding deterministic tests with mocks/fixtures over tests that require
  external providers.

## Automation Scope

Scheduled agents may inspect the codebase and produce issues/reports. They may
not push code, edit secrets, deploy, or touch the VPS. Implementation work should
happen through normal branches and PRs with CI passing.
