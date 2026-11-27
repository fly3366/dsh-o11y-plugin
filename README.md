<p align="center">
  <img src="assets/banner.jpeg" alt="dsh-o11y-plugin banner" width="800">
</p>

# dsh-o11y-plugin

Unified plugin-dimension observability (trace / log / metric) for
[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) (dsh).

[中文文档](README.zh.md)

## Overview

dsh-o11y-plugin is the **unified metric / log / trace adaptation layer for dsh
and its plugins**, built for enterprise deployments. dsh's official telemetry
(`ctx.otel`) provides only private, feedback-gated, redacted session/product
**log** channels and installs no global OTel provider; it exposes no plugin
metric or trace API. o11y fills that gap: it registers global OpenTelemetry
providers so dsh core and any plugin using the standard `@opentelemetry/api`
export traces, metrics, and logs through one consistently configured pipeline.

Enterprise features:

- **Configurable namespacing** — a deployment/tenant `service.namespace` plus
  custom resource attributes on every signal, and per-signal source attribution
  (`dsh.source` = `core` | `plugin`, `dsh.source.name` = emitting scope) so
  backends can separate tenants and attribute telemetry to dsh core or a plugin.
- **Compliant session bridge** — dsh session telemetry is bridged into OTel logs
  using the **post-redaction** record from the official redaction waterfall, so
  exported session logs match what the official backend receives (no
  pre-redaction leakage).

It is intended for platform teams and plugin authors who want standard,
community-compatible, attributable observability without implementing OTel per
plugin.

## Compatibility

| Item | Value |
|---|---|
| DSH compatibility | `@deepseek-ai/dsh` `0.2.2-rc.5` (`session-telemetry/record` bridge event confirmed present; no dsh service deps) |
| Runtime dependency | `@deepseek-ai/cordis` `4.1.0` only |
| Last verified | unit tests against `@deepseek-ai/cordis` `4.1.0` / dsh `0.2.2-rc.5` telemetry contract |
| Node | `^22.19 \|\| >=24` |
| Profiles | `headless`, `web` |

Built on the official OpenTelemetry Node.js SDK, the same dependency family as
dsh's `session-telemetry-otel`.

## Install / Uninstall

```sh
# install from npm
dsh plugin --profile web add dsh-o11y-plugin

# or install from git
dsh plugin --profile web add github:fly3366/dsh-o11y-plugin

# disable for one profile
dsh plugin --profile web remove dsh-o11y-plugin

# or disable at runtime via config: enabled=false
```

The plugin is stateless; removal requires no data cleanup.

## Quick start

```sh
dsh plugin --profile headless add github:fly3366/dsh-o11y-plugin
# point exports at a collector (optional; silent without one)
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 dsh --profile headless "say hi"
```

Any plugin that calls `trace.getTracer(...)` / `metrics.getMeter(...)` /
`logs.getLogger(...)` from `@opentelemetry/api` is then exported automatically.
[deepjit](https://github.com/fly3366/DeepJIT) is the reference consumer,
emitting pipeline counters and GenAI (`gen_ai.*`) LLM spans.

## Configuration

Config is file/env-driven (cordis patch / profile config); provider-affecting
values apply on the next dsh start.

| Key | Default | Description |
|---|---|---|
| `enabled` | `true` | master switch |
| `serviceName` | `''` (→ `OTEL_SERVICE_NAME` → `dsh-plugin`) | OTel resource `service.name` |
| `endpoint` | `''` (→ `OTEL_EXPORTER_OTLP_ENDPOINT` → `http://localhost:4318`) | OTLP/HTTP endpoint |
| `enableTraces` / `enableMetrics` / `enableLogs` | `true` | per-signal toggles |
| `metricExportIntervalMs` | `60000` | periodic metric export interval |
| `bridgeSessionTelemetry` | `true` | bridge dsh session telemetry (post-redaction) into OTel logs |
| `serviceNamespace` | `''` | deployment/tenant namespace → resource `service.namespace` + per-signal `dsh.namespace` |
| `resourceAttributes` | `{}` | extra resource attributes merged onto every signal (enterprise labels) |
| `sourceAttribution` | `true` | stamp incoming traces/logs with `dsh.source` / `dsh.source.name` |
| `coreScopePrefixes` | `['dsh','@deepseek-ai']` | scope prefixes treated as dsh core (everything else is a plugin) |

Sensitive: no credentials are read or stored; only the optional OTLP endpoint is
network-facing.

## Permissions & data

- **Files**: none written; all telemetry is in-memory until exported.
- **Network**: OTLP/HTTP to the configured endpoint only; silent drop when no
  collector is reachable.
- **Credentials**: none.
- **User data**: post-redaction session-telemetry records are observed in-memory
  (when bridging) and forwarded as OTel logs; nothing is persisted by this
  plugin. Pre-redaction payloads are never exported.

## Troubleshooting

- No collector at the endpoint → batches are dropped silently (expected).
- Export errors → surface via OTel diag; verify `endpoint` and collector
  availability.
- Roll back with `dsh plugin --profile <p> remove dsh-o11y-plugin` or set
  `enabled=false`.

## Development

```sh
npm install
npm run typecheck
npm test
npm run build
```

Contributions welcome; keep the OTel SDK dependency family aligned with dsh's
`session-telemetry-otel` for community compatibility.

## License & security

[MIT](LICENSE). Report vulnerabilities privately per [SECURITY.md](SECURITY.md).
