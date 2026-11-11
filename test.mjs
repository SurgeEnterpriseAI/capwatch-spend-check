// Offline test with a mocked fetch: node test.mjs
import assert from "node:assert/strict";
import { main, forecast } from "./spend-check.mjs";

const now = new Date("2026-11-11T00:00:00Z");
const replies = {
  "api.anthropic.com/v1/organizations/cost_report": { data: [{ starting_at: "2026-11-01T00:00:00Z", results: [{ amount: "1250.5", workspace_id: null }] }], has_more: false },
  "api.openai.com/v1/organization/projects?": { data: [{ id: "proj_1", name: "web" }] },
  "api.openai.com/v1/organization/costs": { data: [{ start_time: 1, results: [{ amount: { value: 7.5 }, project_id: "proj_1" }] }], has_more: false },
  "api.openai.com/v1/organization/projects/proj_1/rate_limits": { data: [{ model: "gpt-5", max_tokens_per_1_minute: 30000000, max_requests_per_1_minute: 10000 }] },
  "openrouter.ai/api/v1/key": { data: { label: "prod", usage_monthly: 2, limit: 50, limit_remaining: 48 } },
};
globalThis.fetch = async (url) => {
  const hit = Object.keys(replies).find((k) => url.includes(k));
  if (!hit) return new Response("{}", { status: 404 });
  return new Response(JSON.stringify(replies[hit]), { status: 200 });
};

const log = console.log;
let out = "";
console.log = (s) => (out += s + "\n");
const code = await main(["--json", "--budget", "40"], { ANTHROPIC_ADMIN_KEY: "x", OPENAI_ADMIN_KEY: "y", OPENROUTER_API_KEY: "z" }, now);
console.log = log;
const r = JSON.parse(out);
assert.equal(r.mtd_usd, 22.01); // 12.505 + 7.5 + 2
assert.equal(r.providers.length, 3);
assert.equal(r.providers[1].limits.length, 1);
assert.equal(code, 2); // forecast (~66) crosses 40
assert.equal(Math.round(forecast(10, now)), 30);
assert.equal(await main([], {}, now), 1);
log("ok");
