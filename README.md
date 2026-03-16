# notebooklm-client

[English](#english) | [中文](#中文)

---

<a id="english"></a>

Standalone CLI & library for Google's [NotebookLM](https://notebooklm.google.com/) — generate audio podcasts, analyze content, manage notebooks, and chat, all via reverse-engineered Boq RPC.

## Requirements

- **Node.js 20+**
- **Google Chrome** (auto-detected on macOS / Linux / Windows) — only needed for initial login
- A Google account with NotebookLM access

## Install

```bash
git clone https://github.com/icebear0828/notebooklm-client.git && cd notebooklm-client
npm install
npm run build
```

## Transport Modes

The client supports two transport modes:

| | Browser (default) | HTTP |
|---|---|---|
| How it works | Launches Chrome, runs `fetch()` inside browser context | Direct Node.js HTTP via undici |
| TLS fingerprint | Authentic Chrome | Chrome-like (cipher list + sigalgs) |
| Requires Chrome | Yes (always) | Only for initial login |
| Speed | Slower (browser overhead) | Faster |
| Resource usage | ~300MB (Chrome process) | ~20MB |

**Recommended workflow:** Use browser mode once to log in and export a session, then switch to HTTP mode for all subsequent calls.

## Quick Start

### 1. Export session (one-time, needs Chrome)

```bash
npx notebooklm export-session
# Opens Chrome → log in to Google → session saved to ~/.notebooklm/session.json
```

### 2. Use HTTP mode (no browser needed)

```bash
# List notebooks
npx notebooklm list --transport http

# Generate audio podcast
npx notebooklm audio --transport http --url "https://en.wikipedia.org/wiki/TypeScript" -o /tmp/audio -l en

# Analyze content
npx notebooklm analyze --transport http --url "https://example.com/paper.pdf" --question "What are the key findings?"

# Chat with existing notebook
npx notebooklm chat <notebook-id> --transport http --question "Summarize this"
```

### 3. Or use browser mode directly (no export needed)

```bash
# First run opens Chrome for Google login (cookies persist in ~/.notebooklm/chrome-profile)
npx notebooklm audio --url "https://en.wikipedia.org/wiki/TypeScript" -o /tmp/audio
```

## CLI Reference

All commands accept these shared options:

```
Transport options:
  --transport <mode>       Transport mode: browser or http (default: browser)
  --session-path <path>    Session file path for HTTP mode

Browser options (ignored in HTTP mode):
  --profile <dir>          Chrome profile directory (default: ~/.notebooklm/chrome-profile)
  --headless               Run browser in headless mode
  --chrome-path <path>     Chrome executable path
```

### `notebooklm export-session`

Launch browser, log in to Google, and export session for HTTP mode.

```bash
npx notebooklm export-session
npx notebooklm export-session -o /path/to/session.json
```

### `notebooklm audio`

Generate an audio podcast from source material.

```
Options:
  --url <url>              Source URL
  --text <text>            Source text content
  --topic <topic>          Research topic (creates web search)
  --research-mode <mode>   fast or deep (default: fast)
  -o, --output <dir>       Output directory (required)
  -l, --language <lang>    Audio language (default: en)
  --custom-prompt <prompt> Custom generation prompt
  --keep-notebook          Don't delete notebook after completion
```

```bash
npx notebooklm audio --transport http --url "https://example.com/article" -o ./output -l zh
npx notebooklm audio --transport http --topic "quantum computing" --research-mode deep -o ./output
npx notebooklm audio --transport http --text "Your content here..." -o ./output
```

### `notebooklm analyze`

Analyze source material with a question.

```
Options:
  --url/--text/--topic     Source (one required)
  --question <q>           Question to ask (required)
```

```bash
npx notebooklm analyze --transport http --url "https://example.com" --question "What are the key findings?"
```

### `notebooklm list`

List all notebooks in your account.

```bash
npx notebooklm list --transport http
```

### `notebooklm detail <notebook-id>`

Show notebook title and sources.

```bash
npx notebooklm detail abc-123 --transport http
```

### `notebooklm chat <notebook-id>`

Chat with an existing notebook.

```
Options:
  --question <q>           Question (required)
  --source-ids <ids>       Comma-separated source IDs (default: all)
```

```bash
npx notebooklm chat abc-123 --transport http --question "Summarize the main points"
npx notebooklm chat abc-123 --transport http --question "Explain section 3" --source-ids "src-1,src-2"
```

## Library API

### HTTP mode (recommended)

```typescript
import { NotebookClient } from 'notebooklm-client';

const client = new NotebookClient();
await client.connect({ transport: 'http' });
// Loads session from ~/.notebooklm/session.json automatically

const notebooks = await client.listNotebooks();
const { notebookId } = await client.createNotebook();
await client.addUrlSource(notebookId, 'https://example.com');
const detail = await client.getNotebookDetail(notebookId);
const { text } = await client.sendChat(notebookId, 'Summarize', detail.sources.map(s => s.id));

await client.disconnect();
```

### Browser mode

```typescript
const client = new NotebookClient();
await client.connect({ transport: 'browser', headless: true });

// Same API as HTTP mode, plus:
// - Auto-saves session on connect
// - Can export session for later HTTP use
const sessionPath = await client.exportSession();

await client.disconnect();
```

### Provide session directly (no file)

```typescript
import { NotebookClient } from 'notebooklm-client';
import type { NotebookRpcSession } from 'notebooklm-client';

const session: NotebookRpcSession = {
  at: 'csrf-token',
  bl: 'boq_labs-tailwind-frontend_...',
  fsid: '...',
  cookies: 'SID=...; HSID=...; SSID=...',
  userAgent: 'Mozilla/5.0 ...',
};

const client = new NotebookClient();
await client.connect({ transport: 'http', session });
```

### Full API reference

```typescript
// ── Lifecycle ──
await client.connect(options)        // Connect (browser or http)
await client.disconnect()            // Clean up
await client.exportSession(path?)    // Export session to file (browser mode only)
client.getTransportMode()            // Returns 'browser' | 'http'
client.getSession()                  // Get session info
client.getRpcSession()               // Get raw RPC session data

// ── Notebooks ──
await client.listNotebooks()                          // → NotebookInfo[]
await client.createNotebook()                         // → { notebookId }
await client.getNotebookDetail(notebookId)            // → { title, sources }
await client.deleteNotebook(notebookId)               // → void

// ── Sources ──
await client.addUrlSource(notebookId, url)            // → { sourceId, title }
await client.addTextSource(notebookId, title, text)   // → { sourceId, title }
await client.createWebSearch(notebookId, query, mode) // → { researchId }
await client.getSourceSummary(sourceId)               // → { summary }
await client.deleteSource(sourceId)                   // → void

// ── Chat ──
await client.sendChat(notebookId, message, sourceIds) // → { text, threadId }
await client.deleteChatThread(threadId)               // → void

// ── Artifacts (audio, flashcards, etc.) ──
await client.generateArtifact(notebookId, type, sourceIds, options) // → { artifactId, title }
await client.getArtifacts(notebookId)                 // → ArtifactInfo[]
await client.downloadAudio(downloadUrl, outputDir)    // → filePath
await client.deleteArtifact(artifactId)               // → void

// ── High-level Workflows ──
await client.runAudioOverview(options, onProgress?)   // → { audioPath, notebookUrl }
await client.runAnalyze(options, onProgress?)          // → { answer, notebookUrl }
await client.runMindMap(options, onProgress?)           // → { imagePath, notebookUrl }
await client.runFlashcards(options, onProgress?)        // → { cards, notebookUrl }
```

### Session persistence utilities

```typescript
import { saveSession, loadSession, hasValidSession, refreshTokens } from 'notebooklm-client';

await saveSession(session, '/path/to/session.json');
const session = await loadSession('/path/to/session.json');
const valid = await hasValidSession('/path/to/session.json', 2 * 60 * 60 * 1000); // 2h max age

// Refresh tokens without browser (uses long-lived cookies to GET new CSRF tokens)
const refreshed = await refreshTokens(oldSession, '/path/to/session.json');
```

## How it works

NotebookLM uses Google's **Boq** RPC framework (same as Gemini). All operations go through:

```
POST https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute
```

Each request contains:
- **RPC ID** (e.g., `CCqFvf` for create notebook)
- **Payload** as nested JSON arrays
- **CSRF token** (`SNlM0e`) extracted from `WIZ_global_data`
- **Session cookies** (including HttpOnly cookies extracted via CDP)

**Browser mode** launches Chrome with anti-detection, runs `fetch()` inside the browser context for authentic TLS fingerprints.

**HTTP mode** sends requests directly from Node.js using undici with Chrome-like TLS configuration (cipher suite order, signature algorithms, ALPN). Session data (cookies + tokens) is exported from a prior browser session. Tokens auto-refresh when expired — no browser needed.

Chat uses a separate streaming endpoint (`GenerateFreeFormStreamed`).

## Testing

```bash
# Unit tests (55 tests)
npm test

# E2E tests against real API (18 tests, requires valid session)
npm run test:e2e
```

## Config

| File | Purpose |
|------|---------|
| `~/.notebooklm/chrome-profile` | Chrome persistent login profile |
| `~/.notebooklm/session.json` | Exported session for HTTP mode (auto-refreshes tokens) |
| `~/.notebooklm/rpc-ids.json` | RPC ID overrides (when Google updates IDs) |

## License

MIT

---

<a id="中文"></a>

# notebooklm-client（中文文档）

Google [NotebookLM](https://notebooklm.google.com/) 的独立 CLI 和编程库 —— 通过逆向 Boq RPC 协议实现音频播客生成、内容分析、笔记本管理和对话功能。

## 环境要求

- **Node.js 20+**
- **Google Chrome**（自动检测 macOS / Linux / Windows）—— 仅首次登录需要
- 一个有 NotebookLM 访问权限的 Google 账号

## 安装

```bash
git clone https://github.com/icebear0828/notebooklm-client.git && cd notebooklm-client
npm install
npm run build
```

## 传输模式

支持两种传输模式：

| | 浏览器模式（默认） | HTTP 模式 |
|---|---|---|
| 工作方式 | 启动 Chrome，在浏览器上下文内执行 `fetch()` | Node.js 通过 undici 直接发 HTTP |
| TLS 指纹 | 原生 Chrome | 模拟 Chrome（cipher 顺序 + sigalgs） |
| 需要 Chrome | 始终需要 | 仅首次登录 |
| 速度 | 较慢（浏览器开销） | 快 |
| 资源占用 | ~300MB（Chrome 进程） | ~20MB |

**推荐用法：** 用浏览器模式登录一次并导出 session，之后全部切换到 HTTP 模式。

## 快速开始

### 1. 导出 session（一次性操作，需要 Chrome）

```bash
npx notebooklm export-session
# 打开 Chrome → 登录 Google 账号 → session 保存到 ~/.notebooklm/session.json
```

### 2. 使用 HTTP 模式（无需浏览器）

```bash
# 列出所有笔记本
npx notebooklm list --transport http

# 生成音频播客
npx notebooklm audio --transport http --url "https://zh.wikipedia.org/wiki/TypeScript" -o /tmp/audio -l zh

# 分析内容
npx notebooklm analyze --transport http --url "https://example.com/paper.pdf" --question "主要发现是什么？"

# 与已有笔记本对话
npx notebooklm chat <notebook-id> --transport http --question "帮我总结一下"
```

### 3. 或者直接使用浏览器模式（无需导出）

```bash
# 首次运行会打开 Chrome 登录（cookie 持久化到 ~/.notebooklm/chrome-profile）
npx notebooklm audio --url "https://example.com/article" -o /tmp/audio
```

## CLI 命令参考

所有命令共享以下选项：

```
传输选项：
  --transport <mode>       传输模式：browser 或 http（默认 browser）
  --session-path <path>    HTTP 模式的 session 文件路径

浏览器选项（HTTP 模式下忽略）：
  --profile <dir>          Chrome 配置目录（默认 ~/.notebooklm/chrome-profile）
  --headless               无头模式运行浏览器
  --chrome-path <path>     Chrome 可执行文件路径
```

### `notebooklm export-session`

启动浏览器，登录 Google，导出 session 供 HTTP 模式使用。

```bash
npx notebooklm export-session
npx notebooklm export-session -o /path/to/session.json
```

### `notebooklm audio`

从素材生成音频播客。

```
选项：
  --url <url>              素材 URL
  --text <text>            素材文本内容
  --topic <topic>          研究主题（创建网页搜索）
  --research-mode <mode>   fast 或 deep（默认 fast）
  -o, --output <dir>       输出目录（必填）
  -l, --language <lang>    音频语言（默认 en）
  --custom-prompt <prompt> 自定义生成提示词
  --keep-notebook          完成后不删除笔记本
```

```bash
npx notebooklm audio --transport http --url "https://example.com/article" -o ./output -l zh
npx notebooklm audio --transport http --topic "量子计算" --research-mode deep -o ./output
npx notebooklm audio --transport http --text "你的内容..." -o ./output
```

### `notebooklm analyze`

对素材提出问题进行分析。

```bash
npx notebooklm analyze --transport http --url "https://example.com" --question "核心观点是什么？"
```

### `notebooklm list`

列出账号下所有笔记本。

```bash
npx notebooklm list --transport http
```

### `notebooklm detail <notebook-id>`

显示笔记本标题和素材来源。

```bash
npx notebooklm detail abc-123 --transport http
```

### `notebooklm chat <notebook-id>`

与已有笔记本对话。

```bash
npx notebooklm chat abc-123 --transport http --question "总结要点"
npx notebooklm chat abc-123 --transport http --question "解释第三部分" --source-ids "src-1,src-2"
```

## 编程 API

### HTTP 模式（推荐）

```typescript
import { NotebookClient } from 'notebooklm-client';

const client = new NotebookClient();
await client.connect({ transport: 'http' });
// 自动从 ~/.notebooklm/session.json 加载 session

const notebooks = await client.listNotebooks();
const { notebookId } = await client.createNotebook();
await client.addUrlSource(notebookId, 'https://example.com');
const detail = await client.getNotebookDetail(notebookId);
const { text } = await client.sendChat(notebookId, '帮我总结', detail.sources.map(s => s.id));

await client.disconnect();
```

### 浏览器模式

```typescript
const client = new NotebookClient();
await client.connect({ transport: 'browser', headless: true });

// API 与 HTTP 模式相同，额外支持：
// - 连接时自动保存 session
// - 可导出 session 供后续 HTTP 模式使用
const sessionPath = await client.exportSession();

await client.disconnect();
```

### 直接传入 session（不读文件）

```typescript
import { NotebookClient } from 'notebooklm-client';
import type { NotebookRpcSession } from 'notebooklm-client';

const session: NotebookRpcSession = {
  at: 'csrf-token',
  bl: 'boq_labs-tailwind-frontend_...',
  fsid: '...',
  cookies: 'SID=...; HSID=...; SSID=...',
  userAgent: 'Mozilla/5.0 ...',
};

const client = new NotebookClient();
await client.connect({ transport: 'http', session });
```

### 完整 API 参考

```typescript
// ── 生命周期 ──
await client.connect(options)        // 连接（浏览器或 HTTP）
await client.disconnect()            // 断开并清理资源
await client.exportSession(path?)    // 导出 session 到文件（仅浏览器模式）
client.getTransportMode()            // 返回 'browser' | 'http'
client.getSession()                  // 获取 session 信息
client.getRpcSession()               // 获取原始 RPC session 数据

// ── 笔记本 ──
await client.listNotebooks()                          // → NotebookInfo[]
await client.createNotebook()                         // → { notebookId }
await client.getNotebookDetail(notebookId)            // → { title, sources }
await client.deleteNotebook(notebookId)               // → void

// ── 素材来源 ──
await client.addUrlSource(notebookId, url)            // → { sourceId, title }
await client.addTextSource(notebookId, title, text)   // → { sourceId, title }
await client.createWebSearch(notebookId, query, mode) // → { researchId }
await client.getSourceSummary(sourceId)               // → { summary }
await client.deleteSource(sourceId)                   // → void

// ── 对话 ──
await client.sendChat(notebookId, message, sourceIds) // → { text, threadId }
await client.deleteChatThread(threadId)               // → void

// ── 产物（音频、闪卡等） ──
await client.generateArtifact(notebookId, type, sourceIds, options) // → { artifactId, title }
await client.getArtifacts(notebookId)                 // → ArtifactInfo[]
await client.downloadAudio(downloadUrl, outputDir)    // → filePath
await client.deleteArtifact(artifactId)               // → void

// ── 高级工作流 ──
await client.runAudioOverview(options, onProgress?)   // → { audioPath, notebookUrl }
await client.runAnalyze(options, onProgress?)          // → { answer, notebookUrl }
await client.runMindMap(options, onProgress?)           // → { imagePath, notebookUrl }
await client.runFlashcards(options, onProgress?)        // → { cards, notebookUrl }
```

### Session 持久化工具

```typescript
import { saveSession, loadSession, hasValidSession, refreshTokens } from 'notebooklm-client';

await saveSession(session, '/path/to/session.json');
const session = await loadSession('/path/to/session.json');
const valid = await hasValidSession('/path/to/session.json', 2 * 60 * 60 * 1000); // 2 小时有效期

// 无需浏览器刷新 token（使用长期 cookie 获取新的 CSRF token）
const refreshed = await refreshTokens(oldSession, '/path/to/session.json');
```

## 工作原理

NotebookLM 使用 Google 的 **Boq** RPC 框架（与 Gemini 相同），所有操作通过以下端点：

```
POST https://notebooklm.google.com/_/LabsTailwindUi/data/batchexecute
```

每个请求包含：
- **RPC ID**（如 `CCqFvf` 对应创建笔记本）
- **Payload**：嵌套 JSON 数组
- **CSRF token**（`SNlM0e`）：从 `WIZ_global_data` 提取
- **Session cookies**（包括通过 CDP 提取的 HttpOnly cookie）

**浏览器模式** 启动带反检测的 Chrome，在浏览器上下文中执行 `fetch()` 获得原生 TLS 指纹。

**HTTP 模式** 通过 Node.js 的 undici 直接发请求，配置类 Chrome 的 TLS 参数（cipher 顺序、签名算法、ALPN）。Session 数据从浏览器导出后持久化使用，token 过期时自动刷新，无需再开浏览器。

对话使用独立的流式端点（`GenerateFreeFormStreamed`）。

## 测试

```bash
# 单元测试（55 个）
npm test

# E2E 测试（18 个，需要有效 session）
npm run test:e2e
```

## 配置文件

| 文件 | 用途 |
|------|------|
| `~/.notebooklm/chrome-profile` | Chrome 持久登录配置 |
| `~/.notebooklm/session.json` | HTTP 模式的导出 session（token 自动刷新） |
| `~/.notebooklm/rpc-ids.json` | RPC ID 覆盖配置（Google 更新 ID 时使用） |

## 许可证

MIT

---

## Changelog / 更新日志

### v0.1.0 (2026-03-16)

**Initial Release / 首次发布**

- Boq RPC protocol reverse-engineering (`batchexecute` + `GenerateFreeFormStreamed`)
- Two transport modes: Browser (Puppeteer) and pure HTTP (undici + Chrome TLS fingerprint)
- Session persistence with auto token refresh — no browser needed after initial login
- Full API: notebooks CRUD, sources (URL/text/web search), chat (multi-turn), artifacts (audio/flashcards)
- Audio download with HTTP 302 redirect following
- Anti-detection: fingerprint spoofing, webdriver hiding, canvas noise, WebGL masking
- CLI with all commands supporting `--transport http`
- 55 unit tests + 18 E2E tests (all passing)

---

- Boq RPC 协议逆向（`batchexecute` + `GenerateFreeFormStreamed` 流式端点）
- 双传输模式：浏览器模式（Puppeteer）和纯 HTTP 模式（undici + Chrome TLS 指纹）
- Session 持久化 + token 自动刷新 —— 首次登录后无需再开浏览器
- 完整 API：笔记本增删查、素材来源（URL/文本/网页搜索）、多轮对话、产物（音频/闪卡）
- 音频下载支持 HTTP 302 重定向跟随
- 反检测：指纹伪造、webdriver 隐藏、canvas 噪声、WebGL 参数掩码
- CLI 所有命令支持 `--transport http`
- 55 个单元测试 + 18 个 E2E 测试（全部通过）
