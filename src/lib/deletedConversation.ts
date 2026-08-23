import type { ChatData, ChatMessage } from "../schemas/chat";

// Deleted conversations survive in Claude exports as husks: the conversation
// row and message metadata (dates, attachments) remain, but every message's
// content array and text are stripped. A conversation with no messages at all
// is treated as merely empty, not deleted.

function messageHasContent(message: ChatMessage): boolean {
  if ((message.text ?? "").trim()) return true;
  return (message.content ?? []).some((item) => {
    if (item.type === "text") return Boolean(item.text?.trim());
    if (item.type === "thinking") return Boolean(item.thinking?.trim());
    // Any other content item (tool_use, tool_result, voice_note, unknown)
    // counts as content.
    return true;
  });
}

export function isDeletedConversation(conversation: ChatData): boolean {
  const messages = conversation.chat_messages ?? [];
  if (messages.length === 0) return false;
  return !messages.some(messageHasContent);
}
