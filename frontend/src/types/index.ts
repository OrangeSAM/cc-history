export interface Project {
  id: string
  name: string
  path: string
  session_count: number
  last_modified: string
}

export interface SessionPreview {
  id: string
  preview: string
  message_count: number
  last_modified: string
}

export interface Session {
  id: string
  name: string
  path: string
  last_modified: string
  size: number
}

export interface ToolUseBlock {
  type: 'tool_use'
  id: string
  name: string
  input: Record<string, unknown>
}

export interface ToolResultBlock {
  type: 'tool_result'
  tool_use_id: string
  content: string | Array<{ type: string; text?: string }>
  is_error?: boolean
}

export interface TextBlock {
  type: 'text'
  text: string
}

export interface ThinkingBlock {
  type: 'thinking'
  thinking: string
}

export type ContentBlock = TextBlock | ThinkingBlock | ToolUseBlock | ToolResultBlock | { type: string; [key: string]: unknown }

export interface Message {
  id: string
  type: 'user' | 'assistant' | 'snapshot'
  content: string
  blocks: ContentBlock[]
  timestamp: string
}

export interface UserMessageOutline {
  index: number
  preview: string
  timestamp: string
}

export interface SessionStats {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number
  cacheWriteTokens: number
  toolCalls: number
  durationMs: number
}
