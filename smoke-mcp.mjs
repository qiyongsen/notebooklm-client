#!/usr/bin/env node
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';

const transport = new StdioClientTransport({
  command: 'node',
  args: ['./dist/mcp-server.js'],
});

const client = new Client({ name: 'smoke', version: '0.0.0' }, { capabilities: {} });
await client.connect(transport);
console.log('connected');

const tools = await client.listTools();
console.log(`tools: ${tools.tools.length}`);
for (const t of tools.tools) {
  console.log(`  • ${t.name}`);
  console.log(`      ${t.description?.slice(0, 100)}...`);
}

console.log('\n--- list_notebooks call ---');
const res = await client.callTool({ name: 'list_notebooks', arguments: {} });
const txt = res.content?.[0]?.text || '';
const data = JSON.parse(txt);
if (Array.isArray(data)) {
  console.log(`✓ got ${data.length} notebooks`);
  for (const n of data.slice(0, 3)) console.log(`    ${n.notebookId?.slice(0, 8) ?? '?'}  ${n.title}`);
} else {
  console.log('✗ unexpected:', JSON.stringify(data).slice(0, 200));
}

await client.close();
process.exit(0);
