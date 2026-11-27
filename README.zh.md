<p align="center">
  <img src="assets/banner.jpeg" alt="dsh-o11y-plugin banner" width="800">
</p>

# dsh-o11y-plugin

[deepseek-harness](https://github.com/deepseek-ai/deepseek-harness) (dsh) 的统一
插件维度可观测（trace / log / metric）插件。

[English](README.md) | 中文

## 概述

dsh-o11y-plugin 是面向 **dsh 及其插件的统一 metric / log / trace 适配层**，
为企业级部署设计。dsh 官方遥测（`ctx.otel`）仅提供私有、feedback 门控、脱敏的
会话/产品 **log** 通道，不安装全局 OTel provider，也不向插件暴露 metric/trace
API。o11y 填补该缺口：注册全局 OpenTelemetry providers，使 dsh 本体与任何使用
标准 `@opentelemetry/api` 的插件都能经由单一、统一配置的管线导出 trace /
metric / log。

企业级特性：

- **可配置命名空间**——部署/租户级 `service.namespace` 与自定义 resource 属性
  作用于所有信号；并对每条信号做来源归因（`dsh.source` = `core` | `plugin`、
  `dsh.source.name` = 发射方 scope），便于后端区分租户、把遥测归因到 dsh 本体
  或具体插件。
- **合规会话桥接**——dsh 会话遥测经官方脱敏 waterfall 的**脱敏后**记录桥接为
  OTel log，与官方 backend 收到的一致（不泄露脱敏前内容）。

面向希望获得标准、社区兼容、可归因可观测性而不愿各自实现 OTel 的平台团队与
插件作者。

## 兼容性

| 项 | 值 |
|---|---|
| DSH 兼容性 | `@deepseek-ai/dsh` `0.2.2-rc.5`（已确认 `session-telemetry/record` 桥接事件仍存在；无 dsh 服务依赖） |
| 运行时依赖 | 仅 `@deepseek-ai/cordis` `4.1.0` |
| 最后验证 | 基于 `@deepseek-ai/cordis` `4.1.0` / dsh `0.2.2-rc.5` 遥测契约的单元测试 |
| Node | `^22.19 \|\| >=24` |
| 适用 profile | `headless`、`web` |

基于官方 OpenTelemetry Node.js SDK，与 dsh `session-telemetry-otel` 同依赖族。

## 安装 / 卸载

```sh
# 从 npm 安装
dsh plugin --profile web add dsh-o11y-plugin

# 或 git 直装
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

配置由文件/环境变量驱动（cordis patch / profile config）；影响 provider 的取值
下次 dsh 启动生效。

| 配置 | 默认 | 说明 |
|---|---|---|
| `enabled` | `true` | 总开关 |
| `serviceName` | `''`（→ `OTEL_SERVICE_NAME` → `dsh-plugin`） | OTel resource `service.name` |
| `endpoint` | `''`（→ `OTEL_EXPORTER_OTLP_ENDPOINT` → `http://localhost:4318`） | OTLP/HTTP endpoint |
| `enableTraces` / `enableMetrics` / `enableLogs` | `true` | 按信号开关 |
| `metricExportIntervalMs` | `60000` | metric 周期导出间隔 |
| `bridgeSessionTelemetry` | `true` | 是否桥接 dsh 会话遥测（脱敏后）到 OTel log |
| `serviceNamespace` | `''` | 部署/租户命名空间 → resource `service.namespace` + 每信号 `dsh.namespace` |
| `resourceAttributes` | `{}` | 合并到所有信号的额外 resource 属性（企业标签） |
| `sourceAttribution` | `true` | 为传入 trace/log 打 `dsh.source` / `dsh.source.name` |
| `coreScopePrefixes` | `['dsh','@deepseek-ai']` | 视为 dsh 本体的 scope 前缀（其余为插件） |

敏感项：不读取、不存储凭据；仅可选的 OTLP endpoint 涉及网络。

## 权限与数据

- **文件**：不写任何文件；遥测导出前均在内存。
- **网络**：仅向配置的 endpoint 发 OTLP/HTTP；无 collector 时静默丢弃。
- **凭据**：无。
- **用户数据**：桥接时在内存观察**脱敏后**的 session-telemetry record 并转为
  OTel log；本插件不做任何持久化，脱敏前内容绝不导出。

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
