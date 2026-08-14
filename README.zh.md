# dsh-o11y-plugin

[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) 的统一
插件维度可观测（trace / log / metric）插件。

[English](README.md) | 中文

## 概述

dsh 自带会话级 OTel 遥测，但未向插件暴露 metric 或插件维度的可观测能力。
dsh-o11y-plugin 收敛该缺口：注册全局 OpenTelemetry providers，使任何使用标准
`@opentelemetry/api` 的插件都能经由单一、统一配置的管线导出 trace / metric /
log，并将 dsh 会话遥测桥接为 OTel log。面向希望获得标准、社区兼容可观测性而
不愿各自实现 OTel 的插件作者。

## 兼容性

| 项 | 值 |
|---|---|
| DSH 版本 | `@deepseek-ai/dsh` `0.1.0-rc.6`（Cordis `4.0.1`） |
| 最后验证 | 2026-08-14（基于 `@deepseek-ai/cordis` `4.0.1` 的单元测试） |
| Node | `^22.19 \|\| >=24` |
| 适用 profile | `headless`、`web` |

基于官方 OpenTelemetry Node.js SDK，与 dsh `session-telemetry-otel` 同依赖族。

## 安装 / 卸载

```sh
# 安装
dsh plugin --profile web add github:fly3366/dsh-o11y-plugin

# 从某 profile 移除
dsh plugin --profile web remove dsh-o11y-plugin

# 或运行时禁用：enabled=false
```

插件无状态，移除无需数据清理。

## 快速开始

```sh
dsh plugin --profile headless add github:fly3366/dsh-o11y-plugin
# 可选：指向 collector（无 collector 时静默丢弃）
OTEL_EXPORTER_OTLP_ENDPOINT=http://localhost:4318 dsh --profile headless "say hi"
```

任何插件经 `@opentelemetry/api` 调用 `trace.getTracer(...)` /
`metrics.getMeter(...)` / `logs.getLogger(...)` 即自动导出。
[deepjit](https://github.com/fly3366/DeepJIT) 为参考使用方，上报管线计数器与
GenAI（`gen_ai.*`）LLM span。

## 配置

| 配置 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 总开关 |
| `serviceName` | `dsh-plugin` | OTel resource `service.name` |
| `endpoint` | `''`（→ `OTEL_EXPORTER_OTLP_ENDPOINT` → `http://localhost:4318`） | OTLP/HTTP endpoint |
| `enableTraces` / `enableMetrics` / `enableLogs` | `true` | 按信号开关 |
| `metricExportIntervalMs` | `60000` | metric 周期导出间隔 |
| `bridgeSessionTelemetry` | `true` | 是否桥接 dsh 会话遥测到 OTel log |

敏感项：不读取、不存储凭据；仅可选的 OTLP endpoint 涉及网络。

## 权限与数据

- **文件**：不写任何文件；遥测导出前均在内存。
- **网络**：仅向配置的 endpoint 发 OTLP/HTTP；无 collector 时静默丢弃。
- **凭据**：无。
- **用户数据**：桥接时在内存观察 session-telemetry record 并转为 OTel log；
  本插件不做任何持久化。

## 故障排查

- endpoint 无 collector → batch 静默丢弃（预期行为）。
- 导出错误 → 经 OTel diag 暴露；检查 `endpoint` 与 collector 可用性。
- 回滚：`dsh plugin --profile <p> remove dsh-o11y-plugin` 或 `enabled=false`。

## 开发

```sh
npm install
npm run typecheck
npm test
npm run build
```

欢迎贡献；请保持 OTel SDK 依赖族与 dsh `session-telemetry-otel` 对齐，以利社区兼容。

## 许可与安全

[MIT](LICENSE)。安全问题请按 [SECURITY.md](SECURITY.md) 私下报告。
