import { describe, expect, test } from "bun:test";
import type { ChatData } from "../schemas/chat";
import { isDeletedConversation } from "./deletedConversation";

function conv(messages: unknown[]): ChatData {
  return {
    uuid: "u",
    name: "",
    created_at: "2026-08-22T21:38:00Z",
    updated_at: "2026-08-22T21:42:00Z",
    chat_messages: messages,
  } as ChatData;
}

const emptyHuman = {
  uuid: "m1",
  sender: "human",
  content: [],
  text: "",
  created_at: "2026-08-22T21:38:00Z",
  updated_at: "2026-08-22T21:38:00Z",
};

describe("isDeletedConversation", () => {
  test("true when every message has no renderable content", () => {
    expect(
      isDeletedConversation(
        conv([emptyHuman, { ...emptyHuman, uuid: "m2", sender: "assistant" }]),
      ),
    ).toBe(true);
  });

  test("true when only attachment metadata survives", () => {
    expect(
      isDeletedConversation(
        conv([{ ...emptyHuman, attachments: [{ file_name: "notes.txt" }] }]),
      ),
    ).toBe(true);
  });

  test("false when any message has text content", () => {
    expect(
      isDeletedConversation(
        conv([emptyHuman, { ...emptyHuman, uuid: "m2", content: [{ type: "text", text: "hi" }] }]),
      ),
    ).toBe(false);
  });

  test("false when a message has a tool_use item", () => {
    expect(
      isDeletedConversation(
        conv([
          {
            ...emptyHuman,
            content: [{ type: "tool_use", name: "artifacts", input: {}, is_error: false }],
          },
        ]),
      ),
    ).toBe(false);
  });

  test("false when the top-level text field has content", () => {
    expect(isDeletedConversation(conv([{ ...emptyHuman, text: "hello" }]))).toBe(false);
  });

  test("false for a conversation with no messages at all", () => {
    expect(isDeletedConversation(conv([]))).toBe(false);
  });
});
