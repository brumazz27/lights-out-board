# Lights Out Board

A community board for reporting cars seen with burnt-out headlights, tail lights, brake lights, turn signals, low or flat tires, and other easy-to-miss problems.

| Path | What it is |
| --- | --- |
| `lights-out.html` | The page. People post a sighting (plate optional, color, make and model, problem, location, time, notes) and see the reports in a list they can filter by problem and by open or fixed. |
| `scripts/serve.mjs` | A tiny dependency-free server that wraps the page in a full HTML document and serves it on port 4173 (`/healthz` for readiness). |
| `tests/` | Playwright end-to-end tests. |
| `testkube/lights-out-e2e.yaml` | Testkube TestWorkflow that runs the tests. |

## Where reports are stored

- **On claude.ai** (the published artifact), reports go to the artifact's shared database, so every viewer sees the same live list.
- **Anywhere else** (local, CI, Testkube), the page uses a store kept in the browser's local storage with the same behavior. The footer says "Running outside claude.ai" and carries `data-testid="store-mode" data-mode="local"`, which the tests check first. Each Playwright test runs in a fresh browser context, so every test starts with an empty board.

Stable hooks for tests: `data-testid="report-card"` on each report (with `data-report-id` and `data-status="open|fixed"`), the counters `#t-open` and `#t-fixed`, the form message `#msg`, and the form fields' labels.

## Run the tests locally

```bash
npm ci
npx playwright install chromium
npm test
```

Playwright starts `scripts/serve.mjs` itself. The suite runs in two projects, `desktop` (Desktop Chrome) and `phone` (Pixel 7). Reports land in `test-results/junit.xml` and `playwright-report/`.

To test a copy that is already running somewhere, set `BASE_URL`, and Playwright skips starting its own server:

```bash
BASE_URL=http://localhost:4173 npm test
```

## Run the tests in Testkube

The workflow clones this repository, installs dependencies in the official Playwright image (`mcr.microsoft.com/playwright:v1.49.1-noble`, matching `@playwright/test` 1.49.1), runs the suite, and saves the JUnit and HTML reports as artifacts. Testkube reads the JUnit file to show results per test.

The repository is public, so the runner clones it without credentials. Create the workflow and run it (add `--target name=<runner>` to pick a runner):

```bash
testkube create testworkflow -f testkube/lights-out-e2e.yaml
```

```bash
testkube run testworkflow lights-out-e2e -f
```

After changing the YAML, push it with `testkube create testworkflow -f testkube/lights-out-e2e.yaml --update`.

Options (`--config key=value`):

- `project`: `all` (default), `desktop` or `phone`.
- `baseUrl`: test a deployed copy, for example `--config baseUrl=http://lights-out.default.svc`, instead of the copy the tests start inside the runner pod.
