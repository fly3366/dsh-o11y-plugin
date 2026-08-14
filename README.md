# dsh-o11y-plugin

Unified plugin-dimension observability (trace / log / metric) for
[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) (dsh).

[中文文档](README.zh.md)

## Goals

Converge every plugin's OTel implementation in one place:

- **Use dsh where dsh has it**: hook the `session-telemetry/record` waterfall to
  turn session-level records (agent dimension) into OTel logs, getting agent
  traces for free.
- **Maintain what dsh lacks**: metric aggregation + standard **OTLP/HTTP**
  export for all three signals (trace/log/metric), built on the official
  OpenTelemetry Node.js SDK — the same dependency family as dsh's
  `session-telemetry-otel`, to stay community-compatible.
- **Standard export config**: endpoint / serviceName / per-signal toggles /
  metric export interval. No network by default (endpoint falls back to
  `http://localhost:4318`; without a collector the batch processors drop
  silently).

## How it works

On boot the plugin registers **global** OTel providers (NodeTracerProvider /
MeterProvider / LoggerProvider + OTLP HTTP exporters). Any plugin that uses the
standard `@opentelemetry/api` (`trace` / `metrics` / `logs`) then has its spans,
metrics, and logs exported through this plugin — no per-plugin OTel needed.

First consumer: [deepjit](https://github.com/fly3366/DeepJIT). Its `metrics.ts`
reports counters/histograms via `@opentelemetry/api` and emits **GenAI
semantic-convention spans** (`gen_ai.system` / `gen_ai.request.model` /
`gen_ai.usage.*_tokens`) per LLM call, rendered by gen_ai-aware backends once
exported here.

## Install

```sh
dsh plugin --profile web add github:fly3366/dsh-o11y-plugin
```

## Configuration

| Key | Default | Description |
|---|---|---|
| `enabled` | `true` | master switch |
| `serviceName` | `dsh-plugin` | OTel resource `service.name` |
| `endpoint` | `''` (→ `OTEL_EXPORTER_OTLP_ENDPOINT` → `http://localhost:4318`) | OTLP HTTP endpoint |
| `enableTraces` / `enableMetrics` / `enableLogs` | `true` | per-signal toggles |
| `metricExportIntervalMs` | `60000` | periodic metric export interval |
| `bridgeSessionTelemetry` | `true` | bridge dsh session telemetry into OTel logs |

## License

[MIT](LICENSE)
