# Autonomous Codex Maintenance

## What Is Enabled

The repository includes a scheduled, read-only Codex maintenance scan:

- Workflow: `.github/workflows/codex-maintenance-scan.yml`
- Prompt: `.github/codex/prompts/sentimenta-autonomous-maintainer.md`
- Cadence: 09:00 and 18:00 Sao Paulo time, represented as `0 12,21 * * *` UTC.
- Output: artifact plus comments in a single GitHub issue named
  `Codex Maintenance Inbox`.

The workflow uses `openai/codex-action@v1`, which the OpenAI docs describe as
the GitHub Action for running Codex in CI/CD with `prompt-file`, `output-file`,
the `final-message` output, `sandbox: read-only`, and an `OPENAI_API_KEY` secret.

## Required Setup

1. Add `OPENAI_API_KEY` as a GitHub Actions repository secret.
2. Create the label `codex-maintenance` in GitHub.
3. Enable branch protection on `main` with required checks from `CI`.
4. Keep scheduled scans read-only until the first five reports are reviewed.

## Promotion Path

After the scan quality is proven:

1. Convert good findings into normal GitHub issues.
2. Ask Codex to implement one issue at a time in a branch or PR.
3. Require all CI checks before merge.
4. Keep production deploy manual until Compose deployment and rollback have been
   exercised at least once.

## Non-Goals

- No direct VPS access from scheduled agents.
- No production deploy from scheduled agents.
- No real Apify/LLM/Stripe/social-provider calls during maintenance scans.
- No automatic merge.

## Suggested Manual Codex Task

Use this for one focused implementation:

```text
Implement the selected Codex Maintenance Inbox finding.
Done when the smallest relevant tests pass, CI-facing checks are updated if needed,
and the PR changes only files related to that finding. Do not touch production,
secrets, or unrelated dirty worktree changes.
```
