# netrecon-action

**Network posture regression checks for CI.** Track DNS, HTTP, TLS, email posture, and CDN across your domains — fail the build when something drifts.

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)

Powered by [netrecon](https://netrecon.pages.dev) — the underlying API is public, no key required.

## What it does

Every run the action:

1. Reads `sites.txt` (one domain/IP/URL per line).
2. Calls `https://netrecon.pages.dev/api/analyze` for each site.
3. Extracts tracked fields (DNS A/AAAA/MX/NS, TLS expiry & issuer, HTTP status, SPF/DMARC, CDN vendor).
4. Diffs against `.netrecon/state.json` (kept in your repo).
5. Posts or updates a sticky comment on the triggering PR.
6. Commits the new state on `push`/`schedule` runs.
7. Exits non-zero when the highest finding meets your severity threshold.

## Quick start

Create `sites.txt` at your repo root:

```
# production
example.com
api.example.com

# marketing
www.example.com
```

Add `.github/workflows/netrecon.yml`:

```yaml
name: netrecon
on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: '17 7 * * *'   # daily

permissions:
  contents: write          # commit state file
  pull-requests: write     # post sticky PR comment
  issues: write

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: Yossibh/netrecon-action@v1
        with:
          severity: warning
```

## Inputs

| Input | Default | Description |
|---|---|---|
| `sites` | `sites.txt` | Path to newline-separated list. `#` starts a comment. |
| `severity` | `warning` | Fail threshold: `none`\|`info`\|`warning`\|`critical`. |
| `api-base` | `https://netrecon.pages.dev` | Override to self-host. |
| `state-path` | `.netrecon/state.json` | Where baseline state lives. |
| `commit-state` | `true` | Commit updated state back (only on `push`/`schedule`). |
| `comment-on-pr` | `true` | Post/update a sticky PR comment. |
| `github-token` | `${{ github.token }}` | For commenting and committing. |

## Outputs

| Output | Description |
|---|---|
| `report` | JSON array of per-site results. |
| `changed` | `"true"` if any tracked field changed. |
| `highest-severity` | `none`\|`info`\|`warning`\|`critical`. |

## Severity taxonomy

| Change | Severity |
|---|---|
| TLS `daysUntilExpiry < 14` | **critical** |
| TLS `daysUntilExpiry < 30` | warning |
| DMARC policy `reject`/`quarantine` → `none` | **critical** |
| SPF record disappears | **critical** |
| HTTP `2xx/3xx` → `5xx` or unreachable | **critical** |
| DNS A/AAAA/MX/NS set changes | warning |
| TLS issuer changes | warning |
| CDN vendor changes | warning |
| Other scalar changes | info |

Adjust the threshold via the `severity` input.

## Example PR comment

> ## netrecon report
>
> ### ⚠️ `api.example.com` — 1 change(s)
>
> | field | before | after | severity |
> |---|---|---|---|
> | `tls.daysUntilExpiry` | `60` | `20` | ⚠️ warning |
>
> ### ✅ `example.com` — no change

## Trust posture

- No API keys required.
- Sends only the inputs you put in `sites.txt` to `netrecon.pages.dev`.
- Source is MIT, audited tests cover the diff + comment logic.
- Self-host the API via `api-base` if you prefer.

## Development

```bash
npm install
npm test
npm run build    # bundles dist/index.js with esbuild
```

`dist/index.js` is committed so the action runs without a build step.

## License

[MIT](./LICENSE) — by [Yossi Ben Hagai](https://yossibh.github.io/) · [netrecon.pages.dev](https://netrecon.pages.dev)
