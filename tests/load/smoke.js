// k6 load test for the Lights Out Board: loads the page and the health check under a small,
// steady load. BASE_URL points at the app (Testkube sets it to the app service).
import http from "k6/http";
import { check, sleep } from "k6";

const BASE_URL = __ENV.BASE_URL || "http://localhost:4173";

export const options = {
  vus: Number(__ENV.VUS || 10),
  duration: __ENV.DURATION || "30s",
  thresholds: {
    http_req_failed: ["rate<0.01"], // fewer than 1% failed requests
    http_req_duration: ["p(95)<500"], // 95% of requests under 500 ms
    checks: ["rate>0.99"],
  },
};

export default function () {
  const page = http.get(`${BASE_URL}/`, { tags: { name: "page" } });
  check(page, {
    "page returns 200": (r) => r.status === 200,
    "page has the board title": (r) => r.body.includes("<title>Lights Out Board</title>"),
  });

  const health = http.get(`${BASE_URL}/healthz`, { tags: { name: "healthz" } });
  check(health, { "health check is ok": (r) => r.status === 200 && r.body === "ok" });

  sleep(1);
}
