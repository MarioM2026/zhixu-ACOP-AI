# 知墟变更日志

所有重要变更都会在此文件中记录。格式基于 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
本项目遵循 [语义化版本（Semantic Versioning）](https://semver.org/lang/zh-CN/)。

## [1.2.0] - 2026-06-19

### ✨ 新增功能

- **模型路由优化引擎**：根据任务类型自动选择最优模型的决策引擎，支持 5 种路由策略（成本优先/速度优先/质量优先/均衡/自定义）
- **任务分类器（TaskClassifier）**：基于关键词+正则的文本任务类型识别，支持 14 种任务类型（代码生成/Bug修复/重构/优化/代码审查/通用对话等）
- **模型画像（ModelProfile）**：管理 10 个模型的画像数据（成本/延迟/11维能力评分），支持自定义模型
- **路由规则引擎**：支持条件+策略+优先级的规则匹配，可针对特定场景配置专项路由策略
- **前端模型路由页面**：4 个标签页（路由模拟/模型画像/路由规则/统计概览）

### 🔧 技术实现

- `taskClassifier.ts` — 任务分类器，关键词+正则双层匹配，支持中文
- `modelProfileService.ts` — 模型画像服务，10 个内置模型 + 自定义扩展
- `routerService.ts` — 路由决策引擎，加权评分模型 + 5 种策略
- `routes/router.ts` — RESTful 路由：路由模拟/模型管理/规则管理/统计/历史

### 🔌 API 变更

新增路由相关接口：

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/router/models` | 获取所有模型画像 |
| POST | `/api/router/models` | 新增自定义模型 |
| PUT | `/api/router/models/:modelId` | 更新模型配置 |
| GET | `/api/router/rules` | 获取路由规则 |
| POST | `/api/router/rules` | 创建路由规则 |
| PUT | `/api/router/rules/:id` | 更新规则 |
| DELETE | `/api/router/rules/:id` | 删除规则 |
| POST | `/api/router/route` | 执行路由决策 |
| POST | `/api/router/simulate` | 模拟路由（含调试信息） |
| POST | `/api/router/outcome` | 回填路由结果 |
| GET | `/api/router/stats` | 路由统计 |
| GET | `/api/router/history` | 路由历史 |
| GET | `/api/router/task-types` | 任务类型列表 |

---

## [1.1.0] - 2026-06-19

### ✨ 新增功能

- **适配器真实数据采集**：Trae / Claude Code / Cursor 三个适配器支持 `auto`（自动扫描本地日志目录）和 `manual`（API 手动提交）两种模式
- **日志路径自动检测**：适配器自动检测 Windows/macOS/Linux 系统下的常见日志路径，无需手动配置
- **多格式日志解析**：支持 JSON、JSON Lines、文本格式日志的自动识别与解析
- **数据持久化**：事件、规则、告警通道配置全部持久化到 `data/` 目录，服务重启后数据不丢失
- **前端适配器管理面板**：设置页面新增「适配器管理」标签页，支持实时查看状态、切换模式、触发采集、插入测试事件
- **运行时模式切换**：通过 API 可动态切换适配器模式、配置日志路径、启用/禁用，无需重启服务

### 🔧 技术实现

- `storageService.ts` — 通用持久化服务，JSON 文件读写 + 延迟写入（防抖 2 秒）
- `adapterService.ts` — 适配器生命周期管理 + 定时采集调度（每 15 秒）
- `adapterUtils.ts` — 跨适配器共享工具：日志路径检测、文件扫描、事件解析
- `adapters.ts` — RESTful 路由：状态查询、配置更新、事件提交、批量采集

### 🔌 API 变更

新增适配器相关接口：

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/adapters` | 获取所有适配器状态（健康/采集数/token/延迟） |
| POST | `/api/adapters/collect` | 触发所有适配器手动采集 |
| POST | `/api/adapters/:toolType/config` | 动态配置模式/路径/启用状态 |
| POST | `/api/adapters/:toolType/event` | 通过 API 手动提交事件 |

---

## [1.0.0] - 2026-06-15

### ✨ 新增功能

- **OTEL 数据采集**：支持从 Trae、Cursor、Claude Code 等 AI 编程助手采集运行数据
- **统一监控看板**：提供可视化仪表盘，展示 Token 消耗、响应延迟、错误率等关键指标
- **告警系统**：支持钉钉、飞书、邮件等多渠道告警通知
- **规则引擎**：支持自定义规则，自动检测和响应异常情况
- **数据导出**：支持 CSV、JSON 格式的数据导出
- **API 接口**：提供完整的 RESTful API，支持第三方集成

### 🔧 技术实现

- 前端：React 18 + TypeScript + Vite
- 后端：Node.js + Express + TypeScript
- 数据存储：SQLite（开发环境）/ PostgreSQL（生产环境）
- 监控：OpenTelemetry + Grafana + Prometheus
- 容器化：Docker + Docker Compose
- CI/CD：GitHub Actions

### 📖 文档

- `README.md`：项目简介、快速开始、功能特性
- `DEVELOPMENT.md`：开发环境准备、分支管理、代码规范
- `IMPLEMENTATION_GUIDE.md`：详细开发与落地流程
- `CONTRIBUTING.md`：贡献指南、PR 流程规范
- `API.md`：API 接口文档

### ✅ 测试覆盖

- 单元测试：≥ 80%
- 集成测试：≥ 60%
- E2E 测试：核心路径 100%

### 🚀 部署支持

- Docker Compose 一键部署
- 支持 Linux / macOS / Windows 平台
- 详细部署文档和配置说明

---

## [0.1.0] - 2026-06-01

### ✨ 原型版本

- 项目初始化和基础架构
- 简单的 OTEL 数据采集原型
- 基础前端界面原型
- 数据库结构设计

---

## 版本号说明

- **主版本号（Major）**：不兼容的 API 变更
- **次版本号（Minor）**：向后兼容的功能性新增
- **修订号（Patch）**：向后兼容的问题修正

### 发布频率

- 主要版本：每年 1-2 次重大版本
- 次要版本：每月 1 次功能更新
- 修订版本：根据 bug 修复需求随时发布

---

## 贡献者

感谢以下贡献者对知墟项目的支持：

- 知墟开发团队

---

## 联系方式

- 项目仓库：https://github.com/MarioM2026/zhixu-ACOP-AICodeCopilot
- 问题反馈：https://github.com/MarioM2026/zhixu-ACOP-AICodeCopilot/issues
- 文档地址：https://github.com/MarioM2026/zhixu-ACOP-AICodeCopilot/wiki

---

**最后更新日期**：2026年6月19日
