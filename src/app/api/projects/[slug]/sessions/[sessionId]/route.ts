import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface Message {
  id: string
  type: 'user' | 'assistant' | 'system' | 'snapshot'
  role?: string
  content: string
  timestamp: string
}

function parseMessages(filePath: string): Message[] {
  const content = fs.readFileSync(filePath, 'utf-8')
  const lines = content.split('\n').filter(line => line.trim())

  const messages: Message[] = []

  for (const line of lines) {
    try {
      const data = JSON.parse(line)
      const type = data.type

      if (type === 'file-history-snapshot') {
        messages.push({
          id: data.messageId || data.snapshot?.messageId || '',
          type: 'snapshot',
          content: `File snapshot: ${Object.keys(data.snapshot?.trackedFileBackups || {}).join(', ') || 'No files'}`,
          timestamp: data.timestamp || data.snapshot?.timestamp || ''
        })
      } else if (type === 'user') {
        const content = data.message?.content
        let text = ''
        if (typeof content === 'string') {
          text = content
        } else if (Array.isArray(content)) {
          text = content.map((c: any) => c.text || c.content || '').join('')
        }
        messages.push({
          id: data.uuid || data.messageId || '',
          type: 'user',
          content: text,
          timestamp: data.timestamp || ''
        })
      } else if (type === 'assistant') {
        const content = data.message?.content
        let text = ''
        if (typeof content === 'string') {
          text = content
        } else if (Array.isArray(content)) {
          text = content.map((c: any) => {
            if (c.type === 'text') return c.text || ''
            if (c.type === 'thinking') return c.thinking || ''
            return c.content || c.text || ''
          }).join('\n\n')
        }
        messages.push({
          id: data.uuid || data.message?.id || '',
          type: 'assistant',
          role: data.message?.role,
          content: text,
          timestamp: data.timestamp || ''
        })
      }
    } catch (e) {
      // Skip invalid JSON lines
    }
  }

  return messages
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string; sessionId: string }> }
) {
  try {
    const { slug, sessionId } = await params
    const PROJECTS_DIR = path.join(process.env.HOME || '/Users/liuyibi', '.claude/projects')
    const filePath = path.join(PROJECTS_DIR, slug, `${sessionId}.jsonl`)

    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 })
    }

    const messages = parseMessages(filePath)

    return NextResponse.json({ messages })
  } catch (error) {
    console.error('Error getting messages:', error)
    return NextResponse.json({ error: 'Failed to get messages' }, { status: 500 })
  }
}
