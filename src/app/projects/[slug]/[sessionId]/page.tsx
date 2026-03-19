'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'

interface Message {
  id: string
  type: 'user' | 'assistant' | 'snapshot'
  content: string
  timestamp: string
}

const COLLAPSE_LINES = 10

function MessageItem({ msg, idx }: { msg: Message; idx: number }) {
  const [expanded, setExpanded] = useState(false)

  const lines = msg.content.split('\n')
  const isLong = lines.length > COLLAPSE_LINES
  const displayContent = isLong && !expanded
    ? lines.slice(0, COLLAPSE_LINES).join('\n') + '\n...'
    : msg.content

  return (
    <div
      className={`rounded-lg p-4 ${
        msg.type === 'user'
          ? 'bg-blue-50 border border-blue-100'
          : msg.type === 'assistant'
          ? 'bg-white border border-gray-100 shadow-sm'
          : 'bg-gray-100 border border-gray-200 text-gray-500 text-sm'
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <span className={`text-xs font-medium ${
          msg.type === 'user'
            ? 'text-blue-600'
            : msg.type === 'assistant'
            ? 'text-green-600'
            : 'text-gray-500'
        }`}>
          {msg.type === 'user' ? '👤 你' : msg.type === 'assistant' ? '🤖 Claude' : '📁 快照'}
        </span>
        <div className="flex items-center gap-2">
          {msg.timestamp && (
            <span className="text-xs text-gray-400">
              {new Date(msg.timestamp).toLocaleString('zh-CN')}
            </span>
          )}
          {isLong && (
            <button
              onClick={() => setExpanded(!expanded)}
              className="text-xs text-blue-500 hover:text-blue-700 underline"
            >
              {expanded ? '收起' : '展开'}
            </button>
          )}
        </div>
      </div>
      <div className="text-gray-800 whitespace-pre-wrap break-words">
        {displayContent || '(无内容)'}
      </div>
    </div>
  )
}

export default function SessionPage() {
  const params = useParams()
  const slug = params.slug as string
  const sessionId = params.sessionId as string
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug || !sessionId) return
    fetch(`/api/projects/${slug}/sessions/${sessionId}`)
      .then(res => res.json())
      .then(data => {
        setMessages(data.messages || [])
        setLoading(false)
      })
      .catch(err => {
        setError('Failed to load messages')
        setLoading(false)
      })
  }, [slug, sessionId])

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-gray-500">Loading...</div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-red-500">{error}</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Link href={`/projects/${slug}`} className="text-gray-500 hover:text-gray-700">
              ← 返回
            </Link>
            <h1 className="text-lg font-semibold text-gray-900 truncate">
              {sessionId.slice(0, 8)}...
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="space-y-4">
          {messages.map((msg, idx) => (
            <MessageItem key={msg.id || idx} msg={msg} idx={idx} />
          ))}
        </div>

        {messages.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            暂无消息
          </div>
        )}
      </main>
    </div>
  )
}
