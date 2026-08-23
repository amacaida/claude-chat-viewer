import { describe, expect, test } from "bun:test";
import { ChatDataSchema, type DesignChatExport } from "../schemas/chat";
import { designChatToChatData } from "./designChatAdapter";

const designChat: DesignChatExport = {
  uuid: "00000000-0000-0000-0000-0000000000d1",
  title: "Chat",
  project: { uuid: "00000000-0000-0000-0000-0000000000p1", name: "Test Project" },
  created_at: "2026-08-01T10:00:00Z",
  updated_at: "2026-08-01T11:00:00Z",
  messages: [
    {
      uuid: "00000000-0000-0000-0000-0000000000m1",
      role: "user",
      created_at: "2026-08-01T10:00:00Z",
      content: {
        kind: "chat",
        content: "Design a logo for me",
        authorAccountUuid: "00000000-0000-0000-0000-0000000000a1",
        authorName: "Test User",
        attachments: [
          { id: "att-1", name: "Starter Component", type: "skill", content: "component source" },
          { id: "att-2", name: "sketch.png", type: "image", path: "images/sketch.png" },
        ],
      },
    },
    {
      uuid: "00000000-0000-0000-0000-0000000000m2",
      role: "assistant",
      created_at: "2026-08-01T10:01:00Z",
      content: {
        content: "Here is a plan.",
        contentBlocks: [
          { type: "thinking", text: "Consider shapes." },
          { type: "text", text: "Here is a plan." },
          {
            type: "tool_call",
            toolCall: { id: "toolu_1", name: "dc_write", input: { path: "Logo.dc.html" } },
          },
          { type: "user_interjection", message: { role: "user", content: "Apply drawing" } },
          { type: "error", message: "agent: upstream returned 429" },
          { type: "thinking", text: "" },
        ],
      },
    },
    {
      uuid: "00000000-0000-0000-0000-0000000000m3",
      role: "user",
      created_at: "2026-08-01T10:02:00Z",
      content: {
        kind: "questions-response",
        content: "Questions answered:\n- subject: a ring",
        authorAccountUuid: "00000000-0000-0000-0000-0000000000a1",
      },
    },
    {
      uuid: "00000000-0000-0000-0000-0000000000m4",
      role: "assistant",
      created_at: "2026-08-01T10:03:00Z",
      content: { kind: "chat-summary", content: "Summary of the design session." },
    },
  ],
};

describe("designChatToChatData", () => {
  const result = designChatToChatData(designChat);

  test("validates against ChatDataSchema", () => {
    const parsed = ChatDataSchema.safeParse(result);
    if (!parsed.success) {
      console.error("Validation errors:", parsed.error.errors);
    }
    expect(parsed.success).toBe(true);
  });

  test("builds name from project and title", () => {
    expect(result.name).toBe("[Design] Test Project — Chat");
  });

  test("sets account uuid from the first user message author", () => {
    expect((result as { account?: { uuid?: string } }).account?.uuid).toBe(
      "00000000-0000-0000-0000-0000000000a1",
    );
  });

  test("maps roles to senders and assigns ascending indexes", () => {
    expect(result.chat_messages.map((m) => m.sender)).toEqual([
      "human",
      "assistant",
      "human",
      "assistant",
    ]);
    expect(result.chat_messages.map((m) => m.index)).toEqual([0, 1, 2, 3]);
  });

  test("maps assistant content blocks", () => {
    const items = result.chat_messages[1].content;
    expect(items[0]).toEqual({ type: "thinking", thinking: "Consider shapes." });
    expect(items[1]).toEqual({ type: "text", text: "Here is a plan." });
    expect(items[2]).toMatchObject({
      type: "tool_use",
      name: "dc_write",
      input: { path: "Logo.dc.html" },
    });
    expect(items[3]).toMatchObject({ type: "text" });
    expect((items[3] as { text: string }).text).toContain("Apply drawing");
    expect(items[4]).toMatchObject({ type: "text" });
    expect((items[4] as { text: string }).text).toContain("429");
    // Empty thinking block is dropped
    expect(items).toHaveLength(5);
  });

  test("uses content.content when there are no content blocks", () => {
    expect(result.chat_messages[0].content).toEqual([
      { type: "text", text: "Design a logo for me" },
    ]);
    expect(result.chat_messages[3].content).toEqual([
      { type: "text", text: "Summary of the design session." },
    ]);
  });

  test("maps design attachments to viewer attachments", () => {
    expect(result.chat_messages[0].attachments).toEqual([
      { file_name: "Starter Component", extracted_content: "component source" },
      { file_name: "sketch.png" },
    ]);
  });

  test("falls back to Design when project or title is missing", () => {
    const bare = designChatToChatData({
      uuid: "u",
      created_at: "2026-08-01T10:00:00Z",
      updated_at: "2026-08-01T10:00:00Z",
      messages: [],
    });
    expect(bare.name).toBe("[Design] Design");
  });
});
