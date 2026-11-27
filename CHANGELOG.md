# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.4.0] - 2026-11-27

### Added
- Read-only Web status panel on the plugin detail page (web profiles): active
  signals, OTLP endpoint, service name/namespace, source attribution, session
  bridge, core scope prefixes. Hand-written browser bundle `web/client.js`
  rendered into `plugins.detail.section`, fed by `GET /api/o11y/status`.
- Plugin display metadata (`locale/en.json`, `locale/zh.json`) and an icon.

## [0.3.0] - 2026-11-27

### Changed
- Repositioned as the unified metric/log/trace adaptation layer for dsh **and**
  its plugins (enterprise): global OTel providers/exporters for standard
  `@opentelemetry/api` emission.
- Session bridge now exports the **post-redaction** waterfall record and maps
  the official record shape (`body`/`channel`/`severity`/`attributes`), fixing
  pre-redaction leakage and the dropped body.

### Added
- Configurable enterprise namespacing: `serviceNamespace` + `resourceAttributes`
  on a shared merged resource; per-signal `dsh.source` (core|plugin) /
  `dsh.source.name` via span/log processors; per-data-point `dsh.namespace` via
  a metric view attributes processor; `coreScopePrefixes`, `sourceAttribution`.

### Removed
- Dead `registerSettingsSection` / `@deepseek-ai/dsh-settings` dependency (the
  settings-namespace API is absent in the supported dsh line).

## [0.2.0] - 2026-11-26

### Changed
- Aligned pins to dsh `0.2.2-rc.5` (cordis `4.1.0`, schemastery `3.19.0`).
- Teardown scoped to enabled signals so in-process reload can re-register
  globals; published to npm as 0.2.0.

## [0.1.0] - 2026-08-13

### Added
- Initial unified plugin-dimension observability: global OTel trace/metric/log
  providers with OTLP/HTTP exporters, per-signal toggles, and a dsh
  session-telemetry bridge into OTel logs.