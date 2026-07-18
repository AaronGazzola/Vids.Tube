export type ParsedChatCommand = {
  keyword: string;
  args: string;
};

const COMMAND_RE = /^!([a-zA-Z0-9_]+)(?:\s+([\s\S]*))?$/;

export function parseChatCommand(body: string): ParsedChatCommand | null {
  const match = COMMAND_RE.exec(body.trim());
  if (!match) {
    return null;
  }
  return {
    keyword: match[1].toLowerCase(),
    args: (match[2] ?? "").trim(),
  };
}
