# Sentimenta Autonomous Maintenance Scan

You are running a scheduled maintenance scan for Sentimenta.

## Objective

Find one to three high-leverage improvements that would make Sentimenta safer,
more reliable, more correct, or more premium. Prioritize infrastructure, CI,
data-quality, security, observability, and user-visible reliability.

## Hard Rules

- Read-only scan only. Do not edit files.
- Do not connect to production, SSH, external providers, or real customer data.
- Do not print secrets if discovered. Report only the file/path category and
  remediation.
- Do not propose broad rewrites. Keep recommendations small enough for one PR.
- Ground every finding in concrete repository evidence with paths.

## Scan Lanes

Check these areas in order:

1. CI and tests: missing gate, flaky test, non-blocking check, untested critical path.
2. Data correctness: dashboard numbers, pipeline statuses, LLM parsing, stale data,
   credits/cost accounting, empty states.
3. Security: auth/authz, token storage, CORS/CSP, secret handling, dependency risk.
4. Infra/ops: Docker/Compose, backups, restore, Celery Beat, health checks, alerts.
5. Premium UX: places where real data/error states could feel misleading or brittle.

## Output Format

Return Markdown only:

```markdown
## Verdict
<one sentence>

## Findings
- [P1/P2/P3] <title> — <path or subsystem>
  Evidence: <short concrete evidence>
  Impact: <why it matters>
  Recommended PR: <small implementation scope>
  Suggested checks: <commands/tests>

## No-Change Option
<what to monitor if no PR is worth opening>
```

If there are no worthwhile findings, say that clearly and suggest one monitoring
metric or test-health improvement.
