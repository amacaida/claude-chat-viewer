import type { ChatData, DesignChatExport, DesignChatMessage } from "../schemas/chat";

// Adapts a design chat (Claude's Designs/artifacts-builder surface, exported
// under design_chats/ in the split export format) into the viewer's ChatData
// shape so it flows through the existing conversation browser unchanged.
//
// Design chat messages use role + content.contentBlocks instead of
// sender + content[]. Block mapping:
//   text -> text, thinking -> thinking, tool_call -> tool_use,
//   user_interjection / error -> labeled text items.

type ContentItem = Record<string, unknown> & { type: string };

type DesignAttachment = {
  name?: string;
  content?: string;
};

type DesignBlock = {
  type?: string;
  text?: string;
  toolCall?: { name?: string; input?: Record<string, unknown> };
  message?: { content?: string } | string;
};

function blockToContentItem(block: DesignBlock): ContentItem | null {
  switch (block.type) {
    case "text":
      return block.text ? { type: "text", text: block.text } : null;
    case "thinking":
      return block.text ? { type: "thinking", thinking: block.text } : null;
    case "tool_call":
      return {
        type: "tool_use",
        name: block.toolCall?.name || "tool",
        input: block.toolCall?.input ?? {},
      };
    case "user_interjection": {
      const text =
        typeof block.message === "string" ? block.message : (block.message?.content ?? "");
      return { type: "text", text: `[User interjection] ${text}` };
    }
    case "error": {
      const text = typeof block.message === "string" ? block.message : "";
      return { type: "text", text: `[Error] ${text}` };
    }
    default:
      // Unknown block types fall through to the schema's unknown-type handler
      return block.type ? ({ ...block } as ContentItem) : null;
  }
}

function messageContent(content: DesignChatMessage["content"]): ContentItem[] {
  const blocks = content?.contentBlocks as DesignBlock[] | undefined;
  if (Array.isArray(blocks) && blocks.length > 0) {
    return blocks.map(blockToContentItem).filter((item): item is ContentItem => item !== null);
  }
  const text = typeof content?.content === "string" ? content.content : "";
  return text ? [{ type: "text", text }] : [];
}

export function designChatToChatData(chat: DesignChatExport): ChatData {
  const projectName = chat.project?.name;
  const nameParts = [projectName, chat.title].filter(Boolean);
  const name = `[Design] ${nameParts.length > 0 ? nameParts.join(" — ") : "Design"}`;

  const accountUuid = chat.messages
    .map((m) => m.content?.authorAccountUuid)
    .find((uuid): uuid is string => typeof uuid === "string");

  const chat_messages = chat.messages.map((msg, index) => {
    const createdAt =
      msg.created_at ??
      (typeof msg.content?.timestamp === "string" ? msg.content.timestamp : chat.created_at);

    const attachments = (msg.content?.attachments as DesignAttachment[] | undefined)
      ?.filter((a) => a && typeof a === "object")
      .map((a) => ({
        file_name: a.name || "attachment",
        ...(typeof a.content === "string" && a.content ? { extracted_content: a.content } : {}),
      }));

    return {
      uuid: msg.uuid ?? `${chat.uuid}-${index}`,
      sender: msg.role === "assistant" ? ("assistant" as const) : ("human" as const),
      content: messageContent(msg.content),
      created_at: createdAt,
      updated_at: createdAt,
      index,
      truncated: false,
      ...(attachments && attachments.length > 0 ? { attachments } : {}),
    };
  });

  return {
    uuid: chat.uuid,
    name,
    created_at: chat.created_at,
    updated_at: chat.updated_at,
    ...(accountUuid ? { account: { uuid: accountUuid } } : {}),
    chat_messages,
  } as ChatData;
}
