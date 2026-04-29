#!/usr/bin/env node
/**
 * NotebookLM MCP Server (stdio).
 *
 * 暴露 NotebookClient 作为 MCP tools 给 AI agent 调用 (Claude Code / Claude Desktop).
 *
 * 部署: 本地 stdio. 在 ~/.claude.json (Claude Code) 或 claude_desktop_config.json
 * 加 mcpServers.notebooklm = { command: "notebooklm-mcp" }.
 *
 * 登录前提: 用户需先跑过 `notebooklm export-session` 完成首次浏览器登录,
 * session 存到 ~/.notebooklm/session.json. MCP server 后台进程不能弹 GUI,
 * 必须用已 provisioned session 走 headless transport.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { NotebookClient } from './client.js';

const POLITE_DELAY_MS = 1500;

// 单例 client, 跨多次 tool call 复用 transport 和 session
let _clientPromise: Promise<NotebookClient> | null = null;

async function getClient(): Promise<NotebookClient> {
  if (!_clientPromise) {
    _clientPromise = (async () => {
      const c = new NotebookClient();
      // 'auto' 走 headless (curl-impersonate / tls-client / http), 不弹 GUI
      // 不会撞 puppeteer Runtime.callFunctionOn 大 source 数 timeout
      await c.connect({ transport: 'auto' });
      return c;
    })();
  }
  return _clientPromise;
}

const server = new Server(
  { name: 'notebooklm', version: '0.1.0' },
  { capabilities: { tools: {} } }
);

const TOOLS = [
  {
    name: 'create_notebook',
    description:
      '创建新 NotebookLM notebook 并设置标题. 返回 notebookId. 后续给该 notebook 加 source 用 add_url_sources.',
    inputSchema: {
      type: 'object',
      properties: {
        title: {
          type: 'string',
          description: 'Notebook 标题, 建议格式 "<公司名> <股票代码>" 例 "贵州茅台 600519"',
        },
      },
      required: ['title'],
    },
  },
  {
    name: 'add_url_sources',
    description:
      '批量给已有 notebook 添加 URL 类型 source. 内置 1.5s polite delay 防 NBLM 反滥用. 自动按 title 字段重命名 source (NBLM 默认会用 URL 字符串当 source title, 不可读). 返回每条成败 + sourceId.',
    inputSchema: {
      type: 'object',
      properties: {
        notebook_id: { type: 'string' },
        sources: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              url: {
                type: 'string',
                description: 'PDF 或网页 URL. NBLM 后端会去 fetch.',
              },
              title: {
                type: 'string',
                description:
                  '可选可读标题. 强烈建议传, 不传 NBLM 会用 URL 字符串当 title.',
              },
            },
            required: ['url'],
          },
        },
      },
      required: ['notebook_id', 'sources'],
    },
  },
  {
    name: 'list_notebooks',
    description: '列出当前账号所有 notebook (id + title + sourceCount).',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_notebook_detail',
    description:
      '查 notebook 详情: title + source 列表 (sourceId, title, wordCount, sourceUrl 等). 用于上传后 audit / chat 前列 sourceIds.',
    inputSchema: {
      type: 'object',
      properties: { notebook_id: { type: 'string' } },
      required: ['notebook_id'],
    },
  },
  {
    name: 'chat_with_citations',
    description:
      '在 notebook 上问问题, 返回带 per-citation metadata 的答案 (sourceId, relevance 0-1, charStart/End, excerpt 原文摘录, chunkId). 用于做带原文引用的投研分析. 不传 source_ids 默认用全部 source.',
    inputSchema: {
      type: 'object',
      properties: {
        notebook_id: { type: 'string' },
        question: { type: 'string' },
        source_ids: {
          type: 'array',
          items: { type: 'string' },
          description: '可选, 限定只用这些 source 回答 (做 source filter 时用); 不传则全部',
        },
      },
      required: ['notebook_id', 'question'],
    },
  },
  {
    name: 'delete_notebook',
    description: '删除 notebook (不可逆, 慎用). 主要用于清理实验残留.',
    inputSchema: {
      type: 'object',
      properties: { notebook_id: { type: 'string' } },
      required: ['notebook_id'],
    },
  },
];

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const name = req.params.name;
  const args = (req.params.arguments ?? {}) as Record<string, any>;

  try {
    let result: any;
    switch (name) {
      case 'create_notebook': {
        const c = await getClient();
        const { notebookId } = await c.createNotebook();
        await c.renameNotebook(notebookId, args.title);
        result = { notebookId, title: args.title };
        break;
      }

      case 'add_url_sources': {
        const c = await getClient();
        const sources = (args.sources ?? []) as Array<{ url: string; title?: string }>;
        const out: any[] = [];
        for (let i = 0; i < sources.length; i++) {
          const s = sources[i];
          if (!s) continue;
          try {
            const r = await c.addUrlSource(args.notebook_id, s.url);
            if (!r || !r.sourceId) {
              throw new Error(`empty sourceId: ${JSON.stringify(r)}`);
            }
            if (s.title) {
              try {
                await c.renameSource(args.notebook_id, r.sourceId, s.title);
              } catch {
                // rename 失败不阻塞 batch, 已经入了 source 还能用
              }
            }
            out.push({
              url: s.url,
              status: 'ok',
              sourceId: r.sourceId,
              title: s.title || r.title,
            });
          } catch (e: any) {
            out.push({ url: s.url, status: 'fail', error: String(e?.message ?? e) });
          }
          if (i < sources.length - 1) {
            await new Promise((r) => setTimeout(r, POLITE_DELAY_MS));
          }
        }
        const ok = out.filter((r) => r.status === 'ok').length;
        result = { total: sources.length, ok, failed: sources.length - ok, results: out };
        break;
      }

      case 'list_notebooks': {
        const c = await getClient();
        result = await c.listNotebooks();
        break;
      }

      case 'get_notebook_detail': {
        const c = await getClient();
        result = await c.getNotebookDetail(args.notebook_id);
        break;
      }

      case 'chat_with_citations': {
        const c = await getClient();
        let sourceIds: string[] = args.source_ids ?? [];
        if (sourceIds.length === 0) {
          const detail = await c.getNotebookDetail(args.notebook_id);
          sourceIds = (detail.sources ?? []).map((s: any) => s.sourceId);
        }
        result = await c.sendChatWithCitations(args.notebook_id, args.question, sourceIds);
        break;
      }

      case 'delete_notebook': {
        const c = await getClient();
        await c.deleteNotebook(args.notebook_id);
        result = { ok: true, notebookId: args.notebook_id };
        break;
      }

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };
  } catch (e: any) {
    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(
            {
              error: String(e?.message ?? e),
              hint:
                'session 过期或未初始化时常见 fix: 跑 `notebooklm export-session` 重新登录',
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
