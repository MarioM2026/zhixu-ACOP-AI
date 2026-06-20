# 知墟贡献指南

欢迎参与知墟项目的开发！本文档记录了项目的贡献流程和规范，请在贡献前仔细阅读。

## 目录

- [行为准则](#行为准则)
- [开发环境](#开发环境)
- [分支管理](#分支管理)
- [代码规范](#代码规范)
- [提交规范](#提交规范)
- [Pull Request 流程](#pull-request-流程)
- [问题反馈](#问题反馈)
- [致谢](#致谢)

---

## 行为准则

参与本项目的所有贡献者都应遵守以下行为准则：

- **尊重他人**：以专业、友善的态度进行沟通
- **包容多样**：欢迎不同背景、经验和观点的贡献者
- **承担责任**：对自己的代码和行为负责
- **持续改进**：保持学习和改进的心态

---

## 开发环境

### 1. 前置要求

- Node.js 18.0.0 或更高版本
- npm 9.0.0 或更高版本
- Git 2.30.0 或更高版本
- 代码编辑器（推荐 VS Code）

### 2. 项目初始化

```bash
# 1. Fork 仓库
# 访问 https://github.com/MarioM2026/zhixu-ACOP-AICodeCopilot 并点击 Fork

# 2. 克隆你的 Fork
git clone https://github.com/MarioM2026/zhixu-ACOP-AICodeCopilot.git
cd zhixu-ACOP-AI

# 3. 添加上游仓库
git remote add upstream https://github.com/MarioM2026/zhixu-ACOP-AICodeCopilot.git

# 4. 安装依赖
npm install

# 5. 配置环境变量
cp .env.example .env
# 编辑 .env 并填写必要的配置

# 6. 启动开发服务
npm run dev
```

### 3. 同步上游仓库

```bash
# 获取上游更新
git fetch upstream

# 合并到本地 develop 分支
git checkout develop
git merge upstream/develop

# 或使用 rebase
git pull --rebase upstream develop
```

---

## 分支管理

### 1. 分支命名规范

| 类型 | 前缀 | 示例 |
|------|------|------|
| 功能开发 | `feature/` | `feature/user-auth` |
| Bug 修复 | `bugfix/` | `bugfix/login-error` |
| 紧急修复 | `hotfix/` | `hotfix/critical-bug` |
| 文档更新 | `docs/` | `docs/update-readme` |
| 性能优化 | `perf/` | `perf/optimize-db` |
| 代码重构 | `refactor/` | `refactor/auth-module` |

### 2. 分支工作流

```
develop ──┬── feature/xxx (功能分支)
          │   ├── 开发...
          │   └── PR → develop
          │
          └── hotfix/xxx (紧急修复)
              ├── 修复...
              └── PR → main + develop
```

### 3. 创建功能分支

```bash
# 从 develop 分支创建
git checkout develop
git pull upstream develop
git checkout -b feature/your-feature-name
```

---

## 代码规范

### 1. TypeScript 规范

- **类型声明**：所有变量和函数都必须声明类型
- **避免 `any`**：尽量避免使用 `any` 类型，必要时使用 `unknown`
- **接口命名**：使用 PascalCase，不使用 `I` 前缀
- **组件命名**：使用 PascalCase

```typescript
// ✅ 正确示例
interface User {
  id: string;
  name: string;
  email: string;
}

function createUser(data: User): Promise<User> {
  return database.create(data);
}

// ❌ 错误示例
interface IUser {  // 不使用 I 前缀
  id: any;         // 避免 any
  name: any;
}

function create(data) {  // 缺少类型声明
  return database.create(data);
}
```

### 2. 代码风格

- 使用 2 空格缩进
- 使用单引号字符串
- 语句末尾不添加分号
- 对象末尾添加尾逗号

```typescript
// ✅ 正确示例
const user = {
  id: '123',
  name: '知墟',
  email: 'zhixu@example.com',
}

// ❌ 错误示例
const user = {
    id: "123",      // 4 空格 + 双引号
    name: "知墟",
    email: "zhixu@example.com"  // 缺少尾逗号
};
```

### 3. 命名规范

| 类型 | 规范 | 示例 |
|------|------|------|
| 变量/函数 | camelCase | `userName`, `getUserById()` |
| 类/接口/类型 | PascalCase | `class User`, `interface AuthConfig` |
| 常量 | UPPER_SNAKE_CASE | `MAX_RETRY_COUNT = 3` |
| 私有成员 | 下划线前缀 | `this._privateField` |
| React 组件 | PascalCase | `function UserProfile() {}` |

### 4. 文件结构

- 组件文件：`components/ComponentName.tsx`
- 服务文件：`services/ServiceName.ts`
- 类型文件：`types/TypeName.ts`
- 工具文件：`utils/utilityName.ts`
- 测试文件：`__tests__/file.test.ts`

### 5. 注释规范

- **避免冗余注释**：代码应该自解释
- **复杂逻辑**：必须添加注释说明
- **公共 API**：必须添加 JSDoc 注释

```typescript
/**
 * 根据 ID 获取用户信息
 * @param userId - 用户唯一标识
 * @returns 用户信息对象
 * @throws 如果用户不存在则抛出错误
 */
async function getUserById(userId: string): Promise<User> {
  const user = await database.findUnique({ where: { id: userId } });
  if (!user) {
    throw new Error(`User ${userId} not found`);
  }
  return user;
}
```

### 6. Lint 检查

```bash
# 运行 lint 检查
npm run lint

# 自动修复
npm run lint:fix

# 格式化代码
npm run format
```

---

## 提交规范

我们遵循 [Conventional Commits](https://www.conventionalcommits.org/zh-cn/v1.0.0/) 规范。

### 1. 提交格式

```
type(scope): description

[optional body]

[optional footer(s)]
```

### 2. 类型说明

| 类型 | 说明 |
|------|------|
| `feat` | 新功能 |
| `fix` | Bug 修复 |
| `docs` | 文档更新 |
| `style` | 代码格式调整（不影响功能） |
| `refactor` | 代码重构（既不新增功能也不修复 bug） |
| `perf` | 性能优化 |
| `test` | 添加或修改测试 |
| `build` | 影响构建系统或外部依赖的更改 |
| `ci` | CI 配置更改 |
| `chore` | 其他杂项更改 |
| `revert` | 回滚之前的提交 |

### 3. 示例

```bash
# 新功能
git commit -m "feat(auth): 添加用户登录功能"

# Bug 修复
git commit -m "fix(dashboard): 修复 Token 统计显示错误"

# 文档更新
git commit -m "docs(readme): 更新安装说明"

# 代码重构
git commit -m "refactor(api): 重构 API 路由结构"

# 测试
git commit -m "test(user): 添加用户模块测试用例"

# 性能优化
git commit -m "perf(db): 优化数据库查询性能"
```

### 4. 提交规范检查

项目已配置 commitlint，提交时会自动检查格式。

---

## Pull Request 流程

### 1. 准备工作

在创建 PR 之前，请确保：

- ✅ 代码已通过 lint 检查
- ✅ 所有测试通过
- ✅ 已添加必要的测试用例
- ✅ 已更新相关文档
- ✅ 提交消息符合规范

### 2. 创建 PR

```bash
# 1. 推送分支到远程
git push origin feature/your-feature-name

# 2. 访问 GitHub 仓库
# 3. 点击 "Compare & pull request"
# 4. 填写 PR 信息
```

### 3. PR 标题格式

```
type(scope): 简短描述
```

示例：

```
feat(dashboard): 添加 Token 消耗趋势图
fix(collector): 修复 OTEL 数据解析错误
```

### 4. PR 描述模板

```
## 变更内容

- 详细描述本次变更的内容...

## 相关 Issue

- Fixes #123
- Closes #456

## 测试

- [ ] 单元测试已添加/更新
- [ ] 集成测试已添加/更新
- [ ] E2E 测试已添加/更新

## 截图（如果适用）

## 其他说明
```

### 5. 代码审查

- **至少需要 1 人审核通过**才能合并
- 请耐心等待审核，及时回复评论
- 如果 PR 较长，请拆分多个小 PR
- 保持 PR 专注，避免无关变更

### 6. 合并 PR

审核通过后，项目维护者会将 PR 合并到 `develop` 分支。

---

## 问题反馈

### 1. 报告 Bug

如果发现问题，请：

1. 在 [Issues](https://github.com/MarioM2026/zhixu-ACOP-AICodeCopilot/issues) 中搜索是否已有相同问题
2. 使用 Bug 模板创建新 Issue
3. 提供详细的复现步骤
4. 包含系统信息和日志

### 2. 功能请求

欢迎提出新功能建议：

1. 搜索是否已有相同请求
2. 使用 Feature Request 模板创建 Issue
3. 详细描述功能需求和使用场景
4. 如果可能，提供设计方案或伪代码

### 3. 讨论

- 技术讨论：使用 GitHub Discussions
- 实时交流：使用项目的聊天频道（如果有）

---

## 致谢

感谢所有为知墟项目做出贡献的开发者！

### 贡献者列表

本项目的所有贡献者都会在 [Contributors](https://github.com/MarioM2026/zhixu-ACOP-AICodeCopilot/graphs/contributors) 页面列出。

### 如何成为贡献者

1. 解决 Issues 中的问题
2. 添加新功能或改进现有功能
3. 完善文档
4. 帮助其他贡献者解答问题
5. 分享项目并提供反馈

---

## 版本历史

| 版本 | 日期 | 更新说明 |
|------|------|---------|
| v1.0 | 2026-06-15 | 初始版本 |

---

如有疑问，请通过 Issues 联系项目维护者。祝编码愉快！🎉
