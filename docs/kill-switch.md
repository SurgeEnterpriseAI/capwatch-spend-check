# AI API kill switch: how to stop spend on each provider

A kill switch stops a runaway key or project before the bill grows. These are the provider API calls behind Capwatch's kill switch. You can run them yourself with an admin key, or let [Capwatch](https://capwatch.surgesoftware.co.in) do it in one tap from the alert, with confirmation and an audit log.

| Provider | Action | Reversible | Call |
|---|---|---|---|
| Anthropic | Pause an API key (set it to inactive) | Yes | `POST https://api.anthropic.com/v1/organizations/api_keys/{key_id}` with `{"status":"inactive"}` |
| Anthropic | Resume the key | | same call with `{"status":"active"}` |
| Vercel | Pause a project (production returns 503) | Yes | `POST https://api.vercel.com/v1/projects/{id}/pause` |
| Vercel | Resume the project | | `POST https://api.vercel.com/v1/projects/{id}/unpause` |
| OpenAI | Delete a project API key | **No**: OpenAI has no pause, so you must make a new key and update your apps | `DELETE https://api.openai.com/v1/organization/projects/{project_id}/api_keys/{key_id}` |
| OpenRouter | No pause API. Set a spend limit on the key instead. | | |

## Examples

```bash
# Anthropic: pause one key
curl -X POST "https://api.anthropic.com/v1/organizations/api_keys/$KEY_ID" \
  -H "x-api-key: $ANTHROPIC_ADMIN_KEY" -H "anthropic-version: 2023-06-01" \
  -H "content-type: application/json" -d '{"status":"inactive"}'

# Vercel: pause a project (add ?teamId=... for team projects)
curl -X POST "https://api.vercel.com/v1/projects/$PROJECT_ID/pause" -H "authorization: Bearer $VERCEL_TOKEN"
```

## How Capwatch uses it

- Off by default, per connection. You turn it on.
- Every pause asks you to confirm, and every attempt (allowed or refused) goes in an audit log.
- Optional auto-pause when a budget reaches 100%.
- Not on the free plan.
