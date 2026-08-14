# dsh-o11y-plugin

统一的插件维度可观测（trace / log / metric）插件 for
[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) (dsh)。

[English](README.md) | 中文

## 目标

收敛各插件的 OTel 实现：

- **能接 dsh 的接 dsh**：挂 `session-telemetry/record` waterfall，把会话级
  record（agent 维度）转成 OTel log，免费获得 agent trace。
- **dsh 没有的我们统一维护**：metric 聚合 + 标准 **OTLP/HTTP** 导出
  （trace/log/metric 三个信号），基于官方 OpenTelemetry Node.js SDK，
  与 dsh 的 `session-telemetry-otel` 同款依赖，利于社区协作。
- **标准上报配置**：endpoint / serviceName / 按信号开关 / metric 导出间隔，
  默认关闭网络（endpoint 缺省 `http://localhost:4318`，不配置 collector 时
  batch processor 静默丢弃）。

## 工作原理

插件启动时用 OTel SDK 注册**全局** providers（NodeTracerProvider /
MeterProvider / LoggerProvider + OTLP HTTP exporter）。任何插件只要使用标准
`@opentelemetry/api`（`trace`/`metrics`/`logs`），其 span/metric/log 就会自动
经由本插件导出——无需各自实现 OTel。

第一个使用方：[deepjit](https://github.com/fly3366/DeepJIT)，其 `metrics.ts`
通过 `@opentelemetry/api` 上报 counter/histogram，并为每次 LLM 调用发出
**GenAI 语义约定 span**（`gen_ai.system` / `gen_ai.request.model` /
`gen_ai.usage.*_tokens`），经本插件导出后可在支持 gen_ai 的后端渲染。

## 安装

```sh
dsh plugin --profile web add github:fly3366/dsh-o11y-plugin
```

## 配置

| 配置 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 总开关 |
| `serviceName` | `dsh-plugin` | OTel resource service.name |
| `endpoint` | `''`（→ `OTEL_EXPORTER_OTLP_ENDPOINT` → `http://localhost:4318`） | OTLP HTTP endpoint |
| `enableTraces` / `enableMetrics` / `enableLogs` | `true` | 按信号开关 |
| `metricExportIntervalMs` | `60000` | metric 周期导出间隔 |
| `bridgeSessionTelemetry` | `true` | 是否桥接 dsh 会话遥测到 OTel log |

## 许可

[MIT](LICENSE)
