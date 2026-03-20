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

export interface Message {
  id: string
  type: 'user' | 'assistant' | 'snapshot'
  content: string
  timestamp: string
}

export interface UserMessageOutline {
  index: number
  preview: string
  timestamp: string
}
