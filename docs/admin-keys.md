# Which key each provider needs to read AI spend and usage

Normal API keys cannot read billing or usage. Each provider has a separate read-capable key. These are the same keys you paste into [Capwatch](https://capwatch.surgesoftware.co.in) or give to `spend-check.mjs`.

| Provider | Key | Where to make it | Starts with |
|---|---|---|---|
| Anthropic (Claude API) | Admin API key | Claude Console, Settings, Admin keys. Only an organisation admin can create one. | `sk-ant-admin` |
| OpenAI | Admin key | platform.openai.com, Settings, Organization, Admin keys | `sk-admin` |
| OpenRouter | Any API key (a management key also shows your credit balance) | openrouter.ai, Settings, Keys / Provisioning keys | `sk-or-v1` |
| Vercel (AI Gateway, v0, hosting) | Access token scoped to your team, with billing read | vercel.com/account/tokens | `vercel_` |

Gemini, Sarvam and providers without a usage API can be entered by hand in Capwatch.

## What the keys can read

| Provider | Endpoint | What it returns |
|---|---|---|
| Anthropic | `GET https://api.anthropic.com/v1/organizations/cost_report` | Billed cost per day, by workspace and line item (cents) |
| Anthropic | `GET https://api.anthropic.com/v1/organizations/usage_report/messages` | Tokens per hour or minute, by API key and model |
| Anthropic | `GET https://api.anthropic.com/v1/organizations/api_keys` | Key names and status |
| OpenAI | `GET https://api.openai.com/v1/organization/costs` | Billed cost per day, by project |
| OpenAI | `GET https://api.openai.com/v1/organization/usage/completions` | Tokens and requests per hour or minute, by project and model |
| OpenAI | `GET https://api.openai.com/v1/organization/projects/{id}/rate_limits` | Tokens per minute and requests per minute per model |
| OpenRouter | `GET https://openrouter.ai/api/v1/key` | Daily and monthly usage, the key's spend limit and what is left |
| OpenRouter | `GET https://openrouter.ai/api/v1/credits` | Total credits and usage (management key) |
| Vercel | `GET https://api.vercel.com/v1/billing/charges` | Billed charges (FOCUS format) per project |

Providers report token usage within minutes but billed cost about once a day, so the last few hours are an estimate from tokens. The bill is the source of truth.

## Keeping keys safe

- Store them in a secret manager or CI secrets, never in the repository.
- `spend-check.mjs` reads them from environment variables and never prints them.
- Capwatch encrypts keys with AES-256-GCM before they reach its database and only ever shows them masked. Details: https://capwatch.surgesoftware.co.in/security
