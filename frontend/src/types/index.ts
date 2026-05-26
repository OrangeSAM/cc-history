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

export interface DailyUsage {
  date: string
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
}

export interface ProjectUsage {
  project_id: string
  project_name: string
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  session_count: number
}

export interface ModelUsage {
  model: string
  input_tokens: number
  output_tokens: number
}

export interface HermesSession {
  id: string
  model: string
  title: string
  input_tokens: number
  output_tokens: number
  cache_read_tokens: number
  cache_write_tokens: number
  estimated_cost_usd: number
  billing_provider: string
  message_count: number
  tool_call_count: number
  started_at: string
}

export interface HermesMessage {
  id: number
  role: string
  content: string
  reasoning: string | null
  timestamp: string | null
}

export interface UsageStats {
  daily_usage: DailyUsage[]
  project_usage: ProjectUsage[]
  model_usage: ModelUsage[]
  total_input_tokens: number
  total_output_tokens: number
  total_cache_read_tokens: number
  total_cache_write_tokens: number
  period_days: number
}
