# Lights Out Board

A community board for reporting cars seen with burnt-out headlights, tail lights, brake lights, turn signals, low or flat tires, and other easy-to-miss problems.

| Path | What it is |
| --- | --- |
| `lights-out.html` | The page. People post a sighting (plate optional, color, make and model, problem, location, time, notes) and see the reports in a list they can filter by problem and by open or fixed. |
| `scripts/serve.mjs` | A tiny dependency-free server that wraps the page in a full HTML document and serves it on port 4173 (`/healthz` for readiness). |
| `tests/` | Playwright end-to-end tests, and the k6 load test in `tests/load/`. |
| `testkube/` | Testkube workflows, templates and the trigger (see below). |
| `k8s/app.yaml` | The app deployed in the cluster (`brubot` namespace), watched by the trigger. |
| `.github/workflows/testkube.yml` | Runs `lights-out-e2e` in Testkube on every pull request. |

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

## Testkube

Everything runs in the `default` environment of the Node Engines org, on the `brubot` runner (each workflow sets it as its default target). The repository is public, so runners clone it without credentials.

### Templates (`testkube/templates/`)

| Template | What it adds |
| --- | --- |
| `lights-out-playwright` | Clones the repo at `revision`, uses `mcr.microsoft.com/playwright:v1.49.1-noble` (matching `@playwright/test` 1.49.1), and installs dependencies (5-minute timeout, retried twice). |
| `lights-out-app` | Runs the app as a [service](https://docs.testkube.io/articles/test-workflows-services) for the whole execution: `node:22-alpine` fetches `lights-out.html` and `scripts/` at `revision` and serves them; steps reach it at `http://{{ services.app.0.ip }}:4173` once `GET /healthz` answers. |

Workflows add them with `use:` and pass their own `revision` through, so one setting picks the code for both the tests and the app.

### Workflows (`testkube/`)

| Workflow | What it does | Options (`--config key=value`) |
| --- | --- | --- |
| `lights-out-e2e` | Playwright against the app service. With `project=all`, desktop and phone run at the same time as two parallel workers, each sending its reports back to `test-results/<project>/`; with `desktop` or `phone`, one run with no workers. Runs nightly at 06:00 UTC. | `project`: `all` (default), `desktop`, `phone` (a dropdown in the dashboard; other values fail straight away). `revision`: default `main`. |
| `lights-out-e2e-sharded` | Splits the whole suite into shards that run at the same time, then merges their blob reports into one HTML report and one JUnit file. | `shards`: default 3. `revision`. |
| `lights-out-k6` | k6 load test (`tests/load/smoke.js`) against the app service. Fails if more than 1% of requests fail or the 95th percentile is over 500 ms; saves `summary.json`. | `vus`: default 10. `duration`: default `30s`. `revision`. |
| `lights-out-deployed` | Waits for the deployed app (`k8s/app.yaml`) to answer, then runs the desktop tests against it. Started by the trigger. | `url`: default `http://lights-out.brubot.svc.cluster.local:4173`. |
| `lights-out-suite` | Runs `lights-out-e2e`, `lights-out-e2e-sharded` and `lights-out-k6` one after another. | `revision`. |

Limits: test steps time out after 10 minutes and are retried once; runs wait at most 10 minutes in the queue (`lights-out-e2e`) and are stopped after 30 minutes (15 for k6 and the deployed smoke test, 60 for the suite).

### Trigger (`testkube/triggers/lights-out-deployed.yaml`)

When the `lights-out` Deployment in the `brubot` namespace changes (a rollout, a restart, a new image), Testkube runs `lights-out-deployed`. Only one run at a time, since a rollout changes the Deployment several times. Try it:

```bash
kubectl rollout restart deployment/lights-out -n brubot
```

### GitHub Actions (`.github/workflows/testkube.yml`)

Every pull request runs `lights-out-e2e` against the PR's own commit (`revision` = the head SHA) and fails the check if the tests fail. It uses the repo variables `TESTKUBE_ORG_ID` and `TESTKUBE_ENV_ID` and the secret `TESTKUBE_API_TOKEN`.

### Failure notifications

Not set up yet. To get a call (for example a Slack incoming webhook) when a Lights Out Board workflow fails or is aborted:

```bash
testkube create webhook --name lights-out-failures --uri <URL> --events end-testworkflow-failed --events end-testworkflow-aborted --selector app=lights-out-board
```

### Create or update everything

```bash
for f in testkube/templates/*.yaml; do testkube create testworkflowtemplate -f "$f" --update; done
```

```bash
for f in testkube/*.yaml; do testkube create testworkflow -f "$f" --update; done
```

```bash
testkube create testtrigger -f testkube/triggers/lights-out-deployed.yaml --update
```

```bash
kubectl apply -f k8s/app.yaml
```
