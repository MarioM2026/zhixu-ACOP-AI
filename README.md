# 🧠 知墟 · ZhiXu — AI Code Copilot Observability Platform

> **观测 · 诊断 · 进化 / Observe · Diagnose · Evolve**

[![GitHub Stars](https://img.shields.io/github/stars/MarioM2026/zhixu-ACOP-AICodeCopilot?style=social)](https://github.com/MarioM2026/zhixu-ACOP-AICodeCopilot/stargazers)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue)](LICENSE)
[![Node.js](https://img.shields.io/badge/node-%3E%3D18-green)](package.json)
[![TypeScript](https://img.shields.io/badge/lang-TypeScript-blue)](https://www.typescriptlang.org/)
[![React](https://img.shields.io/badge/frontend-React-blue)](https://react.dev/)
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen)](CONTRIBUTING.md)

---

## 🎯 一句话定位 / One-Line Pitch

**把分散在 Trae / Claude Code / Cursor 等 AI 编程助手中的 Token、错误率、延迟、上下文质量，集中到一个仪表盘；并通过可扩展的规则引擎，自动把"坏的上下文"清理、"低效的模型"切换、"可优化的提示"注入。**

> **Unify tokens, errors, latency and context quality from Trae / Claude Code / Cursor / v0 into one dashboard — then use a pluggable rule engine to auto-clean bloated sessions, auto-switch models, and auto-inject optimization hints.**

不是监控工具 — 是 AI 的"体检中心 + 健康管家 + 进化引擎"。

> It's not just a monitor. It's a **"Checkup → Diagnosis → Evolution"** engine for your AI coders.

---

## 🇨🇳 中文版

### 📊 你将获得什么

| 痛点 | 用知墟前 | 用知墟后 |
|------|----------|----------|
| 💰 **成本失控** | 月底看账单才惊觉 "Token 花在哪了" | Token 实时报表 + 成本告警 + 自动降级低效调用 |
| 🧻 **上下文糊掉** | 长对话后输出质量骤降，不知道清理什么 | 会话画像评分，一键归档/清理历史事件 |
| 📉 **看不到 ROI** | 用了 AI，但不知道它到底省多少时间/加了多少 bug | 错误率/成功率/响应速度可视化 |
| 🧩 **多工具数据孤岛** | Trae 在一份日志、Cursor 在另一处 | **统一采集 + 统一分析** |
| 🔔 **被动等问题** | 只有崩了才发现 | 规则引擎主动预警，甚至自动修复 |

### ✨ 核心功能

#### 📈 监控看板（Dashboard）
一眼掌握全局状态：Token 总览 · 延迟分析 · 成本分维度 · 错误追踪

#### 📋 事件流（Events）
每次 AI 调用都留下痕迹：统一事件格式 `AICodeEvent` · 跨工具统一采集 · 搜索/筛选/分页

#### 🧹 上下文管理（Context Management）
自动给"脏会话"打分，让你知道该不该清理：
- **四因子重要度评分**：时效性 · Token 量 · 代码接受率 · 任务复杂度
- **AI 决策建议**：保持 / 归档 / 清理 / 建议新建会话
- **操作历史可回溯**

#### ⚙️ 规则引擎（Rules Engine）— 知墟的灵魂
让"被动监控"升级为"主动进化"：

```
IF  会话 Token > 60k  AND  错误率 > 25%   →   THEN  标记为"建议清理"
IF  模型调用延迟 > 3s  AND  高峰时段       →   THEN  自动切轻量模型
IF  TTFT > 2s                             →   THEN  注入并发调用提示
```

- 规则以 YAML / JSON 配置，无需改代码
- 动作可扩展到钉钉、邮件、Webhook

#### 🧭 模型路由（Model Routing）
根据任务类型、Token 预算、当前响应速度，自动路由到最合适的模型。

### ⚡ 快速开始

```bash
# 克隆项目
git clone https://github.com/MarioM2026/zhixu-ACOP-AICodeCopilot.git
cd zhixu-ACOP-AI

# 安装依赖（Node.js ≥ 18）
npm install

# 启动后端（默认 http://localhost:3001）
npm run dev:server

# 启动前端（Vite，默认 http://localhost:3000）
npm run dev:client
```

打开浏览器：

- 前端看板 → <http://localhost:3000>
- 事件 API → <http://localhost:3001/api/events>
- 上下文 API → <http://localhost:3001/api/context/sessions>

**连接你的 AI 编程助手：**

1. **Trae**：设置页输入 Trae 日志目录（默认 `%APPDATA%/TRAE SOLO CN/logs`），保存后自动开始扫描
2. **Cursor / Claude Code**：对应适配器已就绪，在 Settings 页启用即可

### 🏗️ 架构

```
┌─────────────────────────────────────────────────────────┐
│                      知墟 (ZhiXu)                        │
│                                                          │
│   ┌────────────┐  ┌────────────┐  ┌────────────┐       │
│   │  Trae      │  │Cursor      │  │ Claude Code│ ...    │  ← 适配器
│   │  适配器    │  │ 适配器      │  │ 适配器     │       │
│   └──────┬─────┘  └──────┬─────┘  └──────┬─────┘       │
│          │                │                │             │
│          └────────────────┼────────────────┘             │
│                           ↓                              │
│             ┌──────────────────────────┐                │
│             │    统一事件流 (AICodeEvent)              │  ← 事件 / 会话聚合
│             └─────────────┬────────────┘                │
│                           ↓                              │
│      ┌───────────────┐ ┌────────────────┐              │
│      │  仪表板 API   │ │  上下文管理服务│              │  ← 评分、建议
│      └──────┬────────┘ └────────┬───────┘              │
│             │                    │                      │
│             └─────────┬──────────┘                      │
│                       ↓                                  │
│               ┌──────────────┐                          │
│               │   规则引擎    │                          │  ← 自动化进化
│               └──────┬───────┘                          │
│                      ↓                                  │
│            告警 / 自动清理 / 模型切换 / Prompt 注入     │
└─────────────────────────────────────────────────────────┘
```

### ⌨️ 技术栈

| 层级 | 技术 |
|------|------|
| 前端 | React · Vite · TypeScript |
| 样式 | 自定义科技风 CSS（无 UI 库依赖，可自由定制） |
| 后端 | Node.js · Express · TypeScript |
| 适配器 | Trae / Cursor / Claude Code 日志解析 |
| API | REST · JSON |
| 协议 | Apache License 2.0 |

### 🗺️ 路线图

- ✅ v1.0 数据采集层（Trae 适配器）
- ✅ v1.1 看板与事件流
- ✅ v1.2 上下文管理（评分 + 建议）
- 🔜 v1.3 规则引擎落地（告警 / 自动清理）
- 🔜 v2.0 模型路由 + 多适配器（Cursor / Claude Code）
- 🔜 v2.1 插件系统（扩展自己的规则）
- 🔜 v3.0 反馈闭环（自动注入优化 Prompt）

### 🤝 参与贡献

欢迎 Issue / PR！

- 如果你有适配新 AI 编程工具的想法，欢迎提交 `packages/adapter-xxx`
- UI / 可视化方向的改进非常受关注
- 规则引擎的 action 扩展（如飞书、企业微信、Webhook）欢迎提交

详见 [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 🇬🇧 English

### 📊 Why You Need It

| Pain | Before ZhiXu | After ZhiXu |
|------|--------------|-------------|
| 💰 **Cost Bloating** | Surprised by end-of-month token bills | Live cost dashboard + alerts + auto downgrade |
| 🧻 **Dirty Context** | Output quality drops mid-session, no clue what to clean | Session health score + one-click archive / cleanup |
| 📉 **No Visible ROI** | Using AI but unsure if actually saving time or adding bugs | Error rate / success rate / response speed all visualized |
| 🧩 **Data Silos** | Trae in one log, Cursor in another | **Unified collection + unified analysis** |
| 🔔 **Passive Debug** | Only find problems when things crash | Proactive alerts + auto remediation |

### ✨ Core Features

#### 📈 Dashboard
Instant overview, powered by real data flowing in from your AI copilot sessions.

#### 📋 Events Stream
Every AI call, aggregated into a standard `AICodeEvent` format — searchable, filterable, paginated.

#### 🧹 Context Management
Automatically score your sessions with a **4-factor engine**: *recency · token usage · quality · task complexity* — then recommend keep / archive / cleanup / new session.

#### ⚙️ Rules Engine — The Soul of ZhiXu
Turn passive monitoring into active evolution:

```
IF  session tokens > 60k   AND  error_rate > 25%   →   MARK "cleanup recommended"
IF  model latency > 3s     AND  peak-hour           →   AUTO switch to lightweight model
IF  TTFT > 2s                                    →   INJECT parallel-call hint
```

- Rules configured via YAML/JSON, zero code
- Extensible actions: DingTalk · Email · Webhook

#### 🧭 Model Routing
Route every call to the best model based on task type, token budget, and current responsiveness.

### ⚡ Quick Start

```bash
# Clone
git clone https://github.com/MarioM2026/zhixu-ACOP-AICodeCopilot.git
cd zhixu-ACOP-AI

# Install (Node.js >= 18 required)
npm install

# Backend (default: http://localhost:3001)
npm run dev:server

# Frontend (Vite, default: http://localhost:3000)
npm run dev:client
```

Then open:

- Dashboard → <http://localhost:3000>
- Events API → <http://localhost:3001/api/events>
- Context API → <http://localhost:3001/api/context/sessions>

**Connecting Your AI Copilots:**

1. **Trae**: Go to Settings, point it at `%APPDATA%/TRAE SOLO CN/logs`, save — scanning starts automatically.
2. **Cursor / Claude Code**: Adapters ready in Settings; just toggle them on.

### 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                         ZhiXu                           │
│                                                          │
│   ┌──────────┐  ┌──────────┐  ┌──────────┐              │
│   │  Trae    │  │  Cursor  │  │ Claude   │ ...          │ ← Adapters
│   │ Adapter  │  │ Adapter  │  │ Code     │              │
│   └────┬─────┘  └────┬─────┘  └────┬─────┘              │
│        │              │              │                   │
│        └──────────────┼──────────────┘                   │
│                       ↓                                  │
│            ┌────────────────────┐                        │
│            │  Unified AICodeEvent │                        │ ← Event / session aggregation
│            └──────────┬──────────┘                        │
│                       ↓                                  │
│     ┌────────────┐ ┌──────────────┐                    │
│     │ Dashboard  │ │ Context Mgmt │                    │ ← Scoring + recommendations
│     └──────┬─────┘ └──────┬───────┘                    │
│            │              │                              │
│            └──────┬───────┘                              │
│                   ↓                                      │
│              ┌───────────┐                               │
│              │   Rules   │                               │ ← Active evolution
│              └─────┬─────┘                               │
│                    ↓                                     │
│        Alerts / Auto-cleanup / Model-switch / Hints      │
└─────────────────────────────────────────────────────────┘
```

### ⌨️ Tech Stack

| Layer | Stack |
|-------|-------|
| Frontend | React · Vite · TypeScript |
| Styling | Custom sci-fi CSS, no UI lib lock-in, fully customizable |
| Backend | Node.js · Express · TypeScript |
| Adapters | Trae / Cursor / Claude Code log parsers |
| API | REST · JSON |
| License | Apache License 2.0 |

### 🗺️ Roadmap

- ✅ v1.0 Data collection (Trae adapter)
- ✅ v1.1 Dashboard & events stream
- ✅ v1.2 Context management (scoring + recommendations)
- 🔜 v1.3 Production-ready rules engine (alerts / auto-cleanup)
- 🔜 v2.0 Model routing + multi-adapter (Cursor / Claude Code)
- 🔜 v2.1 Plugin system
- 🔜 v3.0 Feedback loop (auto-inject optimized prompts)

### 🤝 Contributing

Issues and PRs are welcome:

- Got a new AI tool to integrate? Ship it as `packages/adapter-xxx`.
- UI / visualization improvements are especially high-value.
- Extend rule actions (Lark/Feishu, WeCom, more webhooks).

See [CONTRIBUTING.md](CONTRIBUTING.md)

---

## 📜 许可证 / License

**Apache License 2.0** — 详见 [LICENSE](LICENSE)

> 你可以 **自由使用、修改、分发、商用** 本项目，只需保留版权与许可证声明，并在修改时明确标注。
>
> You can **freely use, modify, distribute, and commercially adopt** this project. Just keep the copyright and license notice, and state any changes you made.

---

## 📣 给知墟一个 Star ⭐ / Star the Project ⭐

如果你认同"**把 AI 编程助手从监控升级到进化**"的方向，请在 GitHub 给一颗 Star：

👉 [github.com/MarioM2026/zhixu-ACOP-AICodeCopilot](https://github.com/MarioM2026/zhixu-ACOP-AICodeCopilot)

If you believe **"AI copilots should evolve, not just be watched"**, give us a star on GitHub. 每一颗 Star / every star 都是社区对"让 AI 越来越聪明"的认可。
