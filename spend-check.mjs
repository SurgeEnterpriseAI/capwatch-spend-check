#!/usr/bin/env node
// capwatch-spend-check: month-to-date AI API spend, a month-end forecast and a budget check
// for Anthropic, OpenAI and OpenRouter, read with your own read-only admin keys.
// One file, no dependencies, Node 18+. Keys are read from environment variables and never printed.
//
// This is the open-source "do it yourself" version of what Capwatch does for you continuously,
// with alerts, a kill switch and a team dashboard: https://capwatch.surgesoftware.co.in
import { pathToFileURL } from "node:url";
import fs from "node:fs";

const ANTHROPIC = "https://api.anthropic.com/v1/organizations";
const OPENAI = "https://api.openai.com/v1/organization";
const OPENROUTER = "https://openrouter.ai/api/v1";

const num = (v) => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v) : NaN;
  return Number.isFinite(n) ? n : 0;
};
export const monthStart = (now) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
const daysInMonth = (now) => new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 0)).getUTCDate();

/** Straight-line forecast to month end (Capwatch itself uses a weekday-aware forecast). */
export function forecast(mtd, now) {
  const elapsedDays = Math.max((now - monthStart(now)) / 86_400_000, 1);
  return (mtd / elapsedDays) * daysInMonth(now);
}

async function getJson(provider, url, headers) {
  let res;
  try {
    res = await fetch(url, { headers, signal: AbortSignal.timeout(20_000) });
  } catch (e) {
    throw new Error(`Could not reach ${provider}: ${e.message}`);
  }
  const text = await res.text();
  if (!res.ok) {
    let msg = text.slice(0, 200);
    try {
      const j = JSON.parse(text);
      msg = (typeof j.error === "string" ? j.error : j.error?.message) ?? j.message ?? msg;
    } catch {}
    const hint = res.status === 401 || res.status === 403 ? " (needs an admin key with read access; normal API keys cannot read usage)" : "";
    throw new Error(`${provider} said ${res.status}: ${msg}${hint}`);
  }
  return text ? JSON.parse(text) : {};
}

async function pages(provider, url, headers, max = 6) {
  const out = [];
  let next;
  for (let i = 0; i < max; i++) {
    const j = await getJson(provider, next ? `${url}&page=${encodeURIComponent(next)}` : url, headers);
    out.push(...(j.data ?? []));
    if (!j.has_more || !j.next_page) break;
    next = j.next_page;
  }
  return out;
}

/** Anthropic Admin API cost report. Amounts are in cents, as decimal strings. */
export async function anthropic(key, now) {
  const h = { "x-api-key": key, "anthropic-version": "2023-06-01" };
  const buckets = await pages("Anthropic", `${ANTHROPIC}/cost_report?starting_at=${monthStart(now).toISOString()}&group_by[]=workspace_id&limit=31`, h);
  const byScope = {};
  let mtd = 0;
  for (const b of buckets) {
    for (const r of b.results ?? []) {
      const usd = num(r.amount) / 100;
      mtd += usd;
      const s = r.workspace_id ? `workspace ${r.workspace_id}` : "default workspace";
      byScope[s] = (byScope[s] ?? 0) + usd;
    }
  }
  return { provider: "Anthropic", mtd, byScope, limits: [] };
}

/** OpenAI organization costs API (admin key), plus per-project rate limits. */
export async function openai(key, now) {
  const h = { authorization: `Bearer ${key}` };
  const projects = (await getJson("OpenAI", `${OPENAI}/projects?limit=100`, h).catch(() => ({ data: [] }))).data ?? [];
  const names = new Map(projects.map((p) => [p.id, p.name]));
  const start = Math.floor(monthStart(now).getTime() / 1000);
  const buckets = await pages("OpenAI", `${OPENAI}/costs?start_time=${start}&bucket_width=1d&group_by=project_id&limit=31`, h);
  const byScope = {};
  let mtd = 0;
  for (const b of buckets) {
    for (const r of b.results ?? []) {
      const usd = num(r.amount?.value);
      mtd += usd;
      const s = r.project_id ? names.get(r.project_id) ?? r.project_id : "organization";
      byScope[s] = (byScope[s] ?? 0) + usd;
    }
  }
  const limits = [];
  for (const p of projects.filter((x) => x.status !== "archived").slice(0, 5)) {
    const rl = await getJson("OpenAI", `${OPENAI}/projects/${p.id}/rate_limits?limit=100`, h).catch(() => ({ data: [] }));
    for (const r of rl.data ?? []) {
      if (r.max_tokens_per_1_minute) {
        limits.push(`${p.name} / ${r.model}: ${num(r.max_tokens_per_1_minute).toLocaleString("en-US")} tokens/min, ${num(r.max_requests_per_1_minute).toLocaleString("en-US")} requests/min`);
      }
    }
  }
  return { provider: "OpenAI", mtd, byScope, limits: limits.slice(0, 10) };
}

/** OpenRouter key info: running monthly total and the key's own spend limit. */
export async function openrouter(key) {
  const d = (await getJson("OpenRouter", `${OPENROUTER}/key`, { authorization: `Bearer ${key}` })).data ?? {};
  const label = d.label || "key";
  const limits = d.limit ? [`${label} spend limit: $${num(d.limit).toFixed(2)}, $${num(d.limit_remaining).toFixed(2)} left`] : [];
  return { provider: "OpenRouter", mtd: num(d.usage_monthly), byScope: { [label]: num(d.usage_monthly) }, limits };
}

export function parseArgs(argv) {
  const o = { budget: 0, json: false, help: false };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--budget") o.budget = num(argv[++i]);
    else if (argv[i] === "--json") o.json = true;
    else if (argv[i] === "-h" || argv[i] === "--help") o.help = true;
  }
  return o;
}

const HELP = `capwatch-spend-check: AI API spend, forecast and budget check

  node spend-check.mjs [--budget USD] [--json]

Keys (read-only admin keys, from environment variables):
  ANTHROPIC_ADMIN_KEY   Anthropic Admin API key (starts with sk-ant-admin)
  OPENAI_ADMIN_KEY      OpenAI Admin key (starts with sk-admin)
  OPENROUTER_API_KEY    any OpenRouter key

Exit codes: 0 ok, 1 error, 2 forecast will cross the budget, 3 already over budget.
Continuous alerts, spike detection and a kill switch: https://capwatch.surgesoftware.co.in`;

export async function main(argv, env = process.env, now = new Date()) {
  const o = parseArgs(argv);
  if (o.help) {
    console.log(HELP);
    return 0;
  }
  const jobs = [];
  if (env.ANTHROPIC_ADMIN_KEY) jobs.push(anthropic(env.ANTHROPIC_ADMIN_KEY, now));
  if (env.OPENAI_ADMIN_KEY) jobs.push(openai(env.OPENAI_ADMIN_KEY, now));
  if (env.OPENROUTER_API_KEY) jobs.push(openrouter(env.OPENROUTER_API_KEY));
  if (!jobs.length) {
    console.error("No keys set. Set ANTHROPIC_ADMIN_KEY, OPENAI_ADMIN_KEY and/or OPENROUTER_API_KEY.\n\n" + HELP);
    return 1;
  }
  const settled = await Promise.allSettled(jobs);
  const results = settled.filter((s) => s.status === "fulfilled").map((s) => s.value);
  const errors = settled.filter((s) => s.status === "rejected").map((s) => s.reason?.message ?? String(s.reason));
  const mtd = results.reduce((s, r) => s + r.mtd, 0);
  const fc = forecast(mtd, now);
  const report = { month: now.toISOString().slice(0, 7), mtd_usd: +mtd.toFixed(2), forecast_usd: +fc.toFixed(2), budget_usd: o.budget || null, providers: results, errors };

  if (o.json) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    const $ = (n) => `$${n.toFixed(2)}`;
    console.log(`AI API spend for ${report.month} (UTC), billed cost reported by each provider\n`);
    for (const r of results) {
      console.log(`${r.provider.padEnd(11)} ${$(r.mtd).padStart(10)}`);
      for (const [s, v] of Object.entries(r.byScope).sort((a, b) => b[1] - a[1]).slice(0, 8)) console.log(`  ${s.slice(0, 40).padEnd(40)} ${$(v).padStart(10)}`);
      for (const l of r.limits) console.log(`  limit: ${l}`);
    }
    const used = o.budget ? `   Budget: ${$(o.budget)} (${Math.round((mtd / o.budget) * 100)}% used)` : "";
    console.log(`\nMonth to date: ${$(mtd)}   Forecast to month end: ${$(fc)}${used}`);
    for (const e of errors) console.error(`! ${e}`);
  }

  if (errors.length && !results.length) return 1;
  if (o.budget && mtd >= o.budget) {
    console.error(`Over budget: $${mtd.toFixed(2)} of $${o.budget}`);
    return 3;
  }
  if (o.budget && fc >= o.budget) {
    console.error(`Forecast will cross the budget: $${fc.toFixed(2)} of $${o.budget}`);
    return 2;
  }
  if (o.budget && mtd >= o.budget * 0.8) console.error(`Warning: ${Math.round((mtd / o.budget) * 100)}% of the budget used`);
  return 0;
}

const isMain = (() => {
  try {
    return import.meta.url === pathToFileURL(fs.realpathSync(process.argv[1] || "")).href;
  } catch {
    return false;
  }
})();
if (isMain) main(process.argv.slice(2)).then((code) => (process.exitCode = code));
