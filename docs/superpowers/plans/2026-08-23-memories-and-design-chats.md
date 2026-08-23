# Memories and Design Chats Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface the `memories/` and `design_chats/` categories of the new split Claude export format in the viewer: design chats browse alongside regular conversations; memories get a dedicated per-user view.

**Architecture:** Design chats are adapted into the existing `ChatData` shape by a pure function (`designChatToChatData`) and appended to the conversation list, so the existing master-detail browser, search, sort, and export all work on them unchanged. Memories are not chats, so they get a net-new `MemoriesView` (user list → memory text), reached from a button in the master-detail sidebar. The folder loader in `JsonInput` reads three additional archive families (`memories-*.zip`, `design_chats-*.zip`, `projects-*.zip` — the last only to map project UUIDs to names).

**Tech Stack:** React 18 + TypeScript, Zod schemas, JSZip (lazy-loaded), ReactMarkdown, Tailwind. Tests run with `bun test`.

**Spec:** This document doubles as the spec; the data-shape findings below were measured from a real export folder.

## Data shapes (measured from a real split export)

- `memories-*.zip` contains `memories/<account-uuid>.json`, each:
  `{ account_uuid: string, conversations_memory: string (markdown), project_memories?: { [projectUuid: string]: string } }`
  `project_memories` may be absent. `account_uuid` matches entries in `users.json`.
- `design_chats-*.zip` contains `design_chats/<uuid>.json`, each:
  `{ uuid, title, project?: { uuid, name }, created_at, updated_at, messages: [...] }`
  Each message: `{ uuid, role: "user" | "assistant", created_at, content: { kind?, content?: string, contentBlocks?: Block[], attachments?: [...], authorAccountUuid?, authorName?, timestamp?, ... } }`
  - User messages (`kind: "chat" | "questions-response"` or absent): text in `content.content`, no `contentBlocks`.
  - Assistant messages: `contentBlocks` with block types `text {text}`, `thinking {text}`, `tool_call {toolCall: {name, input, ...}}`, `user_interjection {message: {content, ...}}`, `error {message}`. `content.content` may be empty.
  - Attachments: `{ id, name, type, content?, path?, hidden?, aspectRatio? }`.
- `projects-*.zip` contains `projects/<uuid>.json` with at least `{ uuid, name }` (plus prompt_template, docs, etc. — out of scope).

## Global Constraints

- Do not put machine-specific absolute paths in committed files.
- Do not put real export content (names, memory text) in committed fixtures — synthetic data only.
- Follow existing code style (Biome), existing schema patterns (`.passthrough()`, optional-tolerant fields).
- The existing single-ZIP and paste flows must be unchanged.
- Verify with: `bun test`, `bun run typecheck`, `bun run build`, plus a scratch end-to-end parse of a real export folder (not committed).

---

### Task 1: Schemas for memories and design chats

**Files:**
- Modify: `src/schemas/chat.ts` (append after `UserExportSchema`)

**Interfaces:**
- Produces: `MemoryExportSchema`, `DesignChatSchema`, types `MemoryExport`, `DesignChatExport`, `DesignChatMessage`.

- [ ] **Step 1: Add schemas**

```ts
// Schema for entries under memories/ in a split Claude data export
export const MemoryExportSchema = z
  .object({
    account_uuid: z.string(),
    conversations_memory: z.string().optional(),
    project_memories: z.record(z.string()).optional(),
  })
  .passthrough();

// Schema for entries under design_chats/ in a split Claude data export.
// Message content is intentionally loose; designChatToChatData normalizes it.
const DesignChatMessageSchema = z
  .object({
    uuid: z.string().optional(),
    role: z.string(),
    content: z.record(z.any()).optional(),
    created_at: z.string().optional(),
  })
  .passthrough();

export const DesignChatSchema = z
  .object({
    uuid: z.string(),
    title: z.string().optional(),
    project: z.object({ uuid: z.string().optional(), name: z.string().optional() }).passthrough().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    messages: z.array(DesignChatMessageSchema),
  })
  .passthrough();

export type MemoryExport = z.infer<typeof MemoryExportSchema>;
export type DesignChatExport = z.infer<typeof DesignChatSchema>;
export type DesignChatMessage = z.infer<typeof DesignChatMessageSchema>;
```

- [ ] **Step 2: Typecheck** — `bun run typecheck`, expect clean.

### Task 2: Design chat adapter (TDD)

**Files:**
- Create: `src/lib/designChatAdapter.ts`
- Test: `src/lib/designChatAdapter.test.ts`

**Interfaces:**
- Consumes: `DesignChatExport` from Task 1, `ChatData`/`ChatDataSchema` from `src/schemas/chat.ts`.
- Produces: `designChatToChatData(chat: DesignChatExport): ChatData`.

- [ ] **Step 1: Write failing tests** (synthetic fixture covering: user chat message with attachments, questions-response, assistant with text/thinking/tool_call/user_interjection/error blocks, assistant with no blocks). Assert:
  - result validates against `ChatDataSchema`
  - `name` is `[Design] <project name> — <title>` (project/title fallbacks: "Design")
  - `account.uuid` equals the first user message's `authorAccountUuid`
  - senders map user→human, assistant→assistant; indexes ascend
  - block mapping: text→text, thinking→thinking, tool_call→tool_use (name/input), user_interjection and error → text items with a label prefix
  - attachments map to `{file_name, extracted_content?}`
- [ ] **Step 2: Run to verify failure** — `bun test src/lib/designChatAdapter.test.ts`, expect module-not-found/failures.
- [ ] **Step 3: Implement `designChatToChatData`** — pure mapping, no I/O; skip blocks that map to empty text/thinking.
- [ ] **Step 4: Run tests** — `bun test`, expect pass.

### Task 3: MemoriesView component

**Files:**
- Create: `src/components/MemoriesView.tsx`

**Interfaces:**
- Consumes: `MemoryExport`, `UserExport` types.
- Produces: `MemoriesView: React.FC<{ memories: MemoryExport[]; usersByUuid: Map<string, UserExport>; projectNamesByUuid: Map<string, string>; onBack: () => void }>`.

- [ ] **Step 1: Implement** — two-pane layout matching MasterDetailView styling: left sidebar lists users (full_name from usersByUuid, fallback to truncated uuid), sorted by name; right pane renders selected user's `conversations_memory` via ReactMarkdown, then a "Project memories" section per entry in `project_memories` with the project name (fallback uuid) as heading. "Back" button in sidebar header.
- [ ] **Step 2: Typecheck** — `bun run typecheck`.

### Task 4: Wire loading (JsonInput) and display (ChatViewer, MasterDetailView)

**Files:**
- Modify: `src/components/JsonInput.tsx` (folder handler + `onConversationList` opts)
- Modify: `src/components/ChatViewer.tsx` (state, memories tab, sidebar hook)
- Modify: `src/components/MasterDetailView.tsx` (optional `onShowMemories` button)

**Interfaces:**
- `onConversationList(conversations, opts?)` opts gains `memories?: MemoryExport[]` and `projectNames?: Record<string, string>`.
- `MasterDetailView` gains optional `onShowMemories?: () => void`.

- [ ] **Step 1: JsonInput folder handler** — for each ZIP additionally: parse every file matching `memories/*.json` (validate with `MemoryExportSchema`, ignore invalid), every `design_chats/*.json` (validate with `DesignChatSchema`, adapt with `designChatToChatData`, append to the conversation array after regular conversations), and every `projects/*.json` (extract `uuid`→`name` into a record; plain defensive parse). Change the "no conversations found" guard to error only when there are neither conversations nor design chats. Pass `memories`/`projectNames` through `processJsonData` → `onConversationList`.
- [ ] **Step 2: ChatViewer** — hold `memories` and `projectNamesByUuid` state (set in `handleConversationList`, cleared in `handleBackToInput`); extend `activeTab` union with `"memories"`; render `MemoriesView` full-screen when active (onBack returns to master-detail); pass `onShowMemories` to `MasterDetailView` only when memories exist.
- [ ] **Step 3: MasterDetailView** — render a small "Memories" button beside "Back to Input" when `onShowMemories` is provided.
- [ ] **Step 4: Verify** — `bun test`, `bun run typecheck`, `bun run build` all clean.

### Task 5: End-to-end verification against a real export (not committed)

- [ ] **Step 1:** Scratch bun script (in the session scratchpad, not the repo) that loads all ZIPs from a real export folder with JSZip and runs the same logic: every design chat adapts and validates via `ChatDataSchema`; every memory file validates via `MemoryExportSchema`; project name map resolves all `project_memories` keys.
- [ ] **Step 2:** Load the folder in the dev server and confirm: design chats appear in the list with project-derived names and usernames; Memories button opens the per-user view.

## Self-Review Notes

- Spec coverage: memories view (Task 3/4), design chats browsing (Task 2/4), loader (Task 4), verification (Task 5). No gaps found.
- Single-file ZIP upload of an individual category archive (e.g. only `design_chats-000.zip` via "Choose File") is intentionally out of scope; the folder picker is the entry point for the split format.
- Memories-only folders (no conversations at all) remain an error; acceptable edge case, revisit if it occurs.
