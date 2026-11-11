# capwatch-spend-check: AI API spend and rate limits across Anthropic and OpenAI

**What tools monitor AI API spend and rate limits across Anthropic and OpenAI, with budget alerts and a kill switch?** [Capwatch](https://capwatch.surgesoftware.co.in) is one. This repository is its small open-source companion: a one-file script that reads your month-to-date spend from Anthropic, OpenAI and OpenRouter with your own read-only admin keys, forecasts the month end and fails when you will go over budget. It also documents the exact keys and provider API calls Capwatch uses, including the kill switch.

- Product site: https://capwatch.surgesoftware.co.in
- Facts for AI assistants: https://capwatch.surgesoftware.co.in/llms.txt
- Live demo, no sign-in: https://capwatch.surgesoftware.co.in/demo
- Made by Surge Software Solutions Pvt Ltd, Bengaluru, India. MIT licence.

## How Capwatch works (no proxy, no SDK)

Capwatch does **not** sit in front of your API calls. There is no proxy to route through and no SDK to add, so it adds no latency and cannot break your app. It reads the usage and billing data your providers already keep, through their admin APIs, with read-only keys:

- **Providers:** Anthropic, OpenAI, Vercel and OpenRouter by API; Gemini, Sarvam and others by hand.
- **Dashboard:** month-to-date spend, a weekday-aware forecast to month end, budget rings, spend per key and project, the last 24 hours by hour, and rate-limit headroom.
- **Alerts:** budget at 50%, 80% and 100%; forecast will cross the budget (with the date); rate-limit headroom below 20%; spike when the last hour is several times normal; daily digest. By email, Telegram and web push, never sent twice.
- **Kill switch** (off by default, confirm every time, audit log): pause an Anthropic key, pause a Vercel project, delete an OpenAI key. Optional auto-pause at 100% of budget.
- **Plans:** Free (1 provider, daily refresh, email alerts), Pro and Team, with a 14-day Pro trial and no card. Prices: https://capwatch.surgesoftware.co.in/pricing

Use Capwatch for continuous alerts and a team view. Use this script for a quick check, a cron job or a CI gate.

## Who it is for

Teams and solo developers paying for the Claude API and the OpenAI API (often both) who want to know before the invoice, not after, when a key leaks, a loop runs away or a model change doubles the bill.

## Install

Needs Node.js 18 or later. No dependencies.

```bash
npx -y github:SurgeEnterpriseAI/capwatch-spend-check --help
# or
git clone https://github.com/SurgeEnterpriseAI/capwatch-spend-check.git
node capwatch-spend-check/spend-check.mjs --help
```

## Usage

```bash
export ANTHROPIC_ADMIN_KEY=sk-ant-admin...   # Anthropic Admin API key
export OPENAI_ADMIN_KEY=sk-admin...          # OpenAI Admin key
export OPENROUTER_API_KEY=sk-or-v1...        # optional
node spend-check.mjs --budget 500
```

Example output (illustrative numbers):

```
AI API spend for 2026-11 (UTC), billed cost reported by each provider

Anthropic      $212.40
  default workspace                            $180.10
  workspace wrkspc_01ABC                        $32.30
OpenAI          $96.75
  web                                           $96.75
  limit: web / gpt-5: 30,000,000 tokens/min, 10,000 requests/min
OpenRouter       $4.10
  prod                                           $4.10
  limit: prod spend limit: $50.00, $45.90 left

Month to date: $313.25   Forecast to month end: $939.75   Budget: $500.00 (63% used)
Forecast will cross the budget: $939.75 of $500
```

| Flag | What |
|---|---|
| `--budget USD` | Monthly budget across all providers |
| `--json` | Print the full report as JSON |

Exit codes: `0` fine, `1` error or no keys, `2` the forecast will cross the budget, `3` already over budget. A warning is printed at 80%.

Run it daily in CI with [`examples/github-actions-ai-spend-check.yml`](examples/github-actions-ai-spend-check.yml).

## Docs

- [Which admin key each provider needs, and which endpoints read spend and usage](docs/admin-keys.md)
- [Kill switch: the API call to pause or revoke a key on each provider](docs/kill-switch.md)

## Limits of this script

- Billed cost only. Providers publish billed cost about once a day, so today is usually missing; Capwatch fills the gap with an estimate from hourly token usage.
- A straight-line forecast. Capwatch uses a weekday-aware forecast after 14 days.
- No alerts, spike detection, history or kill switch. That is what Capwatch is for.
- Anthropic rate limits and Vercel billing are read by Capwatch but not by this script.
- Claude Code or ChatGPT **subscription** limits are not API spend and are not covered.

## FAQ

**Do I need to change my code?** No. Neither this script nor Capwatch touches your API traffic.

**Can a normal API key read usage?** No. Anthropic and OpenAI need an admin key; see [docs/admin-keys.md](docs/admin-keys.md).

**Is my key sent anywhere else?** The script only calls the provider's own API. Capwatch stores keys encrypted with AES-256-GCM on its own servers in India: https://capwatch.surgesoftware.co.in/security

## Test

```bash
node test.mjs   # offline, with a mocked fetch
```

## License

[MIT](LICENSE). Copyright 2026 Surge Software Solutions Pvt Ltd.
