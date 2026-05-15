# Expose User Info from ZIP Exports

**Date:** 2026-05-14
**Status:** Approved (brainstorming phase)

## Problem

When a Claude data-export ZIP is loaded, the viewer reads `conversations.json` but ignores `users.json`. The user's identity (name, email) is present in the archive but never surfaced.

## Goal

When loading a ZIP that contains `users.json`, display the user's name and email in the conversation-browser header and the master-detail header. Loading paths that don't expose `users.json` (single-JSON paste, drag-dropped JSON, sample data, URL `?file=` param) are unchanged.

## Non-goals

- Persisting user info across sessions
- Showing user info in the single-conversation view
- Reading other export files (`projects.json`, etc.)
- Editing or copying the user info
- Multi-user display (Claude exports are single-user; defensively use the first record)

## Approach (Option A from brainstorming)

Thread an optional `user` field through the existing `onConversationList` callback by widening its second argument from `warning?: string` to an options bag `opts?: { warning?: string; user?: UserExport }`.

This is the smallest plumbing change that keeps related export metadata together and leaves the door open for future export-level metadata (e.g., projects).

## Data shape

`users.json` in a Claude export is a JSON array of user objects. We only need a couple of fields and parse defensively (the export schema evolves).

```ts
// src/schemas/chat.ts (additions)
export const UserExportSchema = z
  .object({
    uuid: z.string().optional(),
    full_name: z.string().optional(),
    email_address: z.string().optional(),
  })
  .passthrough();

export type UserExport = z.infer<typeof UserExportSchema>;
```

Parsing rule: `z.array(UserExportSchema).safeParse(...)` → on success take `[0]`. On any failure (missing file, bad JSON, schema mismatch, empty array) → silently skip. Loading must never break because of `users.json`.

## Component changes

### `src/components/JsonInput.tsx`

1. In the ZIP branch of `handleFileUpload` (around line 583), after the existing `conversationsFile` read succeeds, attempt to read `users.json`:
   - `zip.file("users.json")` → if present, `.async("string")` → `JSON.parse` → `z.array(UserExportSchema).safeParse`.
   - On any failure, `userInfo` stays `undefined`. Swallow the error — no UI warning.
2. Widen the prop type:
   ```ts
   onConversationList: (conversations: ChatData[], opts?: { warning?: string; user?: UserExport }) => void;
   ```
3. Widen `processJsonData` to accept an `extras?: { user?: UserExport }` param. Pass `extras?.user` when it forwards to `onConversationList`. From the ZIP path, call `processJsonData(parsed, { user: userInfo })`.
4. Update all existing call sites that pass `warningMsg` to use the opts shape: `onConversationList(list, { warning: warningMsg, user: extras?.user })`.

### `src/components/ChatViewer.tsx`

1. Update `handleConversationList` signature to match.
2. Add a `userInfo` state: `const [userInfo, setUserInfo] = useState<UserExport | undefined>(undefined)`.
3. Set it inside `handleConversationList` from `opts?.user`. Clear it on `handleBack`/reset paths that already clear `conversationList`.
4. Pass `userInfo` as a prop to both `<ConversationBrowser>` and `<MasterDetailView>`.

### `src/components/ConversationBrowser.tsx`

1. Add optional prop: `userInfo?: UserExport`.
2. Inside the header `<div className="mb-6">`, render to the right of the "Back to Input" button:
   ```tsx
   {userInfo && (full_name or email_address present) && (
     <span className="text-sm text-gray-500">
       {userInfo.full_name}
       {userInfo.full_name && userInfo.email_address && " · "}
       {userInfo.email_address}
     </span>
   )}
   ```
   Wrap the existing Back button and this badge in a flex row so the badge sits on the same line.

### `src/components/MasterDetailView.tsx`

1. Add the same optional prop.
2. The header at line 149-154 already uses `flex items-center justify-between` — drop the badge into the right slot of that flex row.

## Edge cases and behavior

| Situation | Behavior |
|---|---|
| ZIP has no `users.json` | No badge. No warning. |
| `users.json` is malformed JSON | No badge. No warning. Conversations still load. |
| `users.json` is an array of objects that fail schema | No badge. No warning. (`passthrough` should make this rare.) |
| `users.json` is an empty array | No badge. |
| `users.json` has more than one user | Use the first; ignore the rest. |
| User has `full_name` but no `email_address` | Show just the name. |
| User has `email_address` but no `full_name` | Show just the email. |
| Both missing | No badge. |
| Loading paste/drop JSON or sample data | No badge (no `users.json` available). |
| Switching between conversations within the browser | Badge persists (it's tied to the export, not the conversation). |
| Going back to the JSON input screen | `userInfo` cleared along with `conversationList`. |

## Success criteria

1. Loading a ZIP with valid `users.json` shows a badge with name/email in the browser header.
2. Loading the same ZIP and clicking into a conversation: badge is also visible in the master-detail header (left sidebar header).
3. Single conversation view (the right pane / standalone view) shows no badge.
4. Loading a ZIP without `users.json` works exactly as it does today — no error, no badge.
5. Loading a ZIP with corrupted `users.json` works exactly as it does today — no error, no badge.
6. Loading a `conversations.json` directly (no ZIP) works exactly as it does today — no badge.
7. Existing unit tests still pass.
8. `bun run build` succeeds without TS errors.

## Files touched

- `src/schemas/chat.ts` — add `UserExportSchema`, export `UserExport` type.
- `src/components/JsonInput.tsx` — read `users.json` in ZIP path; widen callback + `processJsonData` signatures.
- `src/components/ChatViewer.tsx` — accept user in callback; hold `userInfo` state; pass to children; clear on back.
- `src/components/ConversationBrowser.tsx` — accept `userInfo?` prop; render badge.
- `src/components/MasterDetailView.tsx` — accept `userInfo?` prop; render badge.

## Out of scope (deferred)

- Reading other export files (`projects.json`, account-info-style files).
- Showing user info in printable/exported output.
- Persisting user info to localStorage alongside the last-viewed conversation.
- A "switch account" affordance.
