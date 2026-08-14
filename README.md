<p align="center">
  <img src="assets/banner.jpeg" alt="dsh-o11y-plugin banner" width="800">
</p>

# dsh-o11y-plugin

Unified plugin-dimension observability (trace / log / metric) for
[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) (dsh).

[中文文档](README.zh.md)

## Overview

dsh ships session-level OTel telemetry but exposes no metric or plugin-scoped
observability to plugins. dsh-o11y-plugin converges that gap: it registers
global OpenTelemetry providers so any plugin using the standard
`@opentelemetry/api` exports traces, metrics, and logs through a single,
consistently configured pipeline, and it bridges dsh session telemetry into
OTel logs. It is intended for plugin authors who want standard,
community-compatible observability without implementing OTel per plugin.

## Compatibility

| Item | Value |
|---|---|
| DSH version | `@deepseek-ai/dsh` `0.1.0-rc.6` (Cordis `4.0.1`) |
| Last verified | 2026-08-14 (unit tests against `@deepseek-ai/cordis` `4.0.1`) |
| Node | `^22.19 \|\| >=24` |
| Profiles | `headless`, `web` |

Built on the official OpenTelemetry Node.js SDK, the same dependency family as
dsh's `session-telemetry-otel`.

## Install / Uninstall

```sh
# install
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

| Key | Default | Description |
|---|---|---|
| `enabled` | `true` | master switch |
| `serviceName` | `dsh-plugin` | OTel resource `service.name` |
| `endpoint` | `''` (→ `OTEL_EXPORTER_OTLP_ENDPOINT` → `http://localhost:4318`) | OTLP/HTTP endpoint |
| `enableTraces` / `enableMetrics` / `enableLogs` | `true` | per-signal toggles |
| `metricExportIntervalMs` | `60000` | periodic metric export interval |
| `bridgeSessionTelemetry` | `true` | bridge dsh session telemetry into OTel logs |

Sensitive: no credentials are read or stored; only the optional OTLP endpoint is
network-facing.

## Permissions & data

- **Files**: none written; all telemetry is in-memory until exported.
- **Network**: OTLP/HTTP to the configured endpoint only; silent drop when no
  collector is reachable.
- **Credentials**: none.
- **User data**: session-telemetry records are observed in-memory (when
  bridging) and forwarded as OTel logs; nothing is persisted by this plugin.

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
