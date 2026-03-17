---
name: notecraft
description: "Google NotebookLM automation. Create notebooks, add sources, generate podcasts/videos/slides/flashcards, chat, deep research. Activates on intent like create a podcast, research topic, summarize URL."
user-invocable: true
allowed-tools: Bash, Read, Write
argument-hint: "[research|podcast|analyze|chat] [args...]"
---

# NotebookLM

Automate Google NotebookLM via CLI. Generate audio podcasts, analyze content, manage notebooks, and chat.

## Setup

```bash
npm i notebooklm-client
npx notebooklm export-session   # One-time: opens Chrome, log in to Google
npx notebooklm list --transport auto  # Verify
```

## When This Skill Activates

Recognize requests like:
- "Create a podcast about [topic]"
- "Research [topic] in depth"
- "Summarize this URL"
- "Generate flashcards / slides"
- "Chat with my notebook"
- "What notebooks do I have?"

## CLI Commands

All commands use `--transport auto` for headless mode.

| Task | Command |
|------|---------|
| List notebooks | `npx notebooklm list --transport auto` |
| Notebook details | `npx notebooklm detail <id> --transport auto` |
| Chat | `npx notebooklm chat <id> --transport auto --question "..."` |
| Podcast from URL | `npx notebooklm audio --transport auto --url "https://..." -o /tmp/audio -l en` |
| Podcast from topic | `npx notebooklm audio --transport auto --topic "Minecraft" -o /tmp/audio` |
| Analyze content | `npx notebooklm analyze --transport auto --url "https://..." --question "Summarize"` |
| Diagnose issues | `npx notebooklm diagnose` |
| Import session | `npx notebooklm import-session <file-or-json>` |

### `audio` options

```
--url <url>              Source URL
--text <text>            Source text
--topic <topic>          Research topic (web search)
--research-mode <mode>   fast | deep (default: fast)
-o, --output <dir>       Output directory (required)
-l, --language <lang>    Language (default: en)
--custom-prompt <prompt> Custom prompt
--keep-notebook          Keep notebook after
```

## Multi-Account

```bash
npx notebooklm --home ~/.notebooklm-work list --transport auto
# or
NOTEBOOKLM_HOME=~/.notebooklm-work npx notebooklm list --transport auto
```

## Autonomy Rules

**Run automatically:** `list`, `detail`, `diagnose`

**Ask before running:** `audio` (long-running), `analyze` (creates notebook), delete operations

## Common Workflows

### Quick podcast from URL
```bash
npx notebooklm audio --transport auto --url "https://example.com/article" -o ./output -l en
```

### Research a topic
```bash
npx notebooklm audio --transport auto --topic "quantum computing" --research-mode deep -o ./output
```

### Analyze and ask questions
```bash
npx notebooklm analyze --transport auto --url "https://example.com/paper.pdf" --question "What are the key findings?"
```

### Chat with existing notebook
```bash
npx notebooklm list --transport auto
npx notebooklm chat <notebook-id> --transport auto --question "Summarize the main points"
```

## Error Handling

| Error | Action |
|-------|--------|
| "No session available" | `npx notebooklm export-session` |
| "Session expired" | Auto-refreshes; if fails, re-export |
| "Quota exceeded" | Daily limit hit — wait or upgrade |
| "Rate limited" | Wait a few minutes, retry |

## Known Limits

- Audio generation takes 5-10 minutes
- Daily generation limits exist per type (audio, video, slides, etc.) — no API to check remaining
- Studio types are dynamic — Google may add/remove types anytime
- Session auto-refreshes; re-export if auth errors persist
