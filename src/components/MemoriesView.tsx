import { ChevronLeft, User } from "lucide-react";
import { useState } from "react";
import ReactMarkdown from "react-markdown";
import { Button } from "@/components/ui/button";
import type { MemoryExport, UserExport } from "../schemas/chat";

interface MemoriesViewProps {
  memories: MemoryExport[];
  usersByUuid: Map<string, UserExport>;
  projectNamesByUuid: Map<string, string>;
  onBack: () => void;
}

// Per-user view of Claude's long-term memory blobs from a split export's
// memories/ category: one entry per account, with an overall conversations
// memory plus optional per-project memories.
export const MemoriesView: React.FC<MemoriesViewProps> = ({
  memories,
  usersByUuid,
  projectNamesByUuid,
  onBack,
}) => {
  const userName = (memory: MemoryExport) =>
    usersByUuid.get(memory.account_uuid)?.full_name || memory.account_uuid.slice(0, 8);

  const sortedMemories = [...memories].sort((a, b) => userName(a).localeCompare(userName(b)));
  const [selected, setSelected] = useState<MemoryExport | null>(sortedMemories[0] ?? null);

  const markdownClass =
    "prose prose-sm max-w-none prose-code:before:content-none prose-code:after:content-none";

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <div className="w-full md:w-72 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col h-full">
        <div className="px-4 py-3 border-b border-gray-200 flex-shrink-0">
          <Button onClick={onBack} variant="outline" size="sm" className="mb-3">
            <ChevronLeft className="h-4 w-4 mr-2" />
            Back to Conversations
          </Button>
          <h2 className="font-semibold text-sm text-gray-900">Memories ({memories.length})</h2>
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
          {sortedMemories.map((memory) => (
            <button
              key={memory.account_uuid}
              type="button"
              className={`text-left w-full px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors ${
                selected?.account_uuid === memory.account_uuid
                  ? "bg-blue-50 border-l-2 border-blue-500"
                  : ""
              }`}
              onClick={() => setSelected(memory)}
            >
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-gray-400 flex-shrink-0" />
                <span className="font-medium text-sm text-gray-900 truncate">
                  {userName(memory)}
                </span>
              </div>
              <div className="text-xs text-gray-500 mt-1">
                {Object.keys(memory.project_memories ?? {}).length > 0
                  ? `${Object.keys(memory.project_memories ?? {}).length} project memories`
                  : "Conversation memory only"}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-y-auto">
        {selected ? (
          <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
            <div className="bg-white rounded-lg border border-[#e8e7df] p-6">
              <h1 className="text-2xl font-semibold text-gray-900">{userName(selected)}</h1>
              <div className="mt-1 text-sm text-gray-500">
                What Claude remembers about this user
              </div>
            </div>

            {selected.conversations_memory && (
              <div className="bg-white rounded-lg border border-[#e8e7df] p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Conversation Memory</h2>
                <ReactMarkdown className={markdownClass}>
                  {selected.conversations_memory}
                </ReactMarkdown>
              </div>
            )}

            {Object.entries(selected.project_memories ?? {}).map(([projectUuid, text]) => (
              <div key={projectUuid} className="bg-white rounded-lg border border-[#e8e7df] p-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-1">
                  {projectNamesByUuid.get(projectUuid) || "Untitled Project"}
                </h2>
                <div className="text-xs text-gray-400 mb-4 font-mono">{projectUuid}</div>
                <ReactMarkdown className={markdownClass}>{text}</ReactMarkdown>
              </div>
            ))}
          </div>
        ) : (
          <div className="h-full flex items-center justify-center text-gray-500">
            <div className="text-center">
              <p className="text-lg mb-2">Select a user</p>
              <p className="text-sm">Choose from the list on the left to view their memories</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
