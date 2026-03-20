'use client'

import React, { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { invoke } from '@tauri-apps/api/core'

interface Message {
  id: string
  type: 'user' | 'assistant' | 'snapshot'
  content: string
  timestamp: string
}

interface UserMessageOutline {
  index: number
  preview: string
  timestamp: string
}

const COLLAPSE_LINES = 8

function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="relative group mt-3">
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded opacity-0 group-hover:opacity-100 transition-opacity hover:bg-gray-600"
      >
        {copied ? '已复制' : '复制'}
      </button>
      <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm font-mono">
        <code>{code}</code>
      </pre>
    </div>
  )
}

function MessageItem({ msg, idx, messageRefs }: { msg: Message; idx: number; messageRefs: React.RefObject<(HTMLDivElement | null)[]> }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)

  // 检测代码块
  const codeBlockRegex = /```[\s\S]*?```/g
  const codeBlocks = msg.content.match(codeBlockRegex)
  const hasCode = codeBlocks && codeBlocks.length > 0

  // 处理普通内容和代码块
  let displayContent = msg.content
  if (hasCode) {
    // 如果有代码块，分离显示
    displayContent = msg.content.replace(codeBlockRegex, '').trim()
  }

  const lines = displayContent.split('\n')
  const isLong = lines.length > COLLAPSE_LINES
  const displayText = isLong && !expanded
    ? lines.slice(0, COLLAPSE_LINES).join('\n') + '\n...'
    : displayContent

  const handleCopy = async () => {
    await navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const date = msg.timestamp ? new Date(msg.timestamp) : null

  return (
    <div
      ref={(el) => { messageRefs.current[idx] = el }}
      className="relative"
    >
      {/* 时间轴线 */}
      {idx > 0 && (
        <div className="absolute left-5 top-0 bottom-[-1rem] w-px bg-gray-200"></div>
      )}

      {/* 时间轴点 */}
      <div className={`absolute left-4 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 ${
        msg.type === 'user' ? 'bg-blue-500' : msg.type === 'assistant' ? 'bg-green-500' : 'bg-gray-400'
      }`}></div>

      <div
        className={`ml-8 rounded-xl p-4 ${
          msg.type === 'user'
            ? 'bg-blue-50 border border-blue-100'
            : msg.type === 'assistant'
            ? 'bg-white border border-gray-200 shadow-sm'
            : 'bg-gray-100 border border-gray-200'
        }`}
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${
              msg.type === 'user'
                ? 'text-blue-600'
                : msg.type === 'assistant'
                ? 'text-green-600'
                : 'text-gray-500'
            }`}>
              {msg.type === 'user' ? '👤 你' : msg.type === 'assistant' ? '🤖 Claude' : '📁 快照'}
            </span>
            {date && (
              <span className="text-xs text-gray-400">
                {date.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopy}
              className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded transition-colors"
              title="复制"
            >
              {copied ? (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              )}
            </button>
            {(isLong || hasCode) && (
              <button
                onClick={() => setExpanded(!expanded)}
                className="text-xs text-blue-500 hover:text-blue-700"
              >
                {expanded ? '收起' : '展开'}
              </button>
            )}
          </div>
        </div>

        {/* 代码块 */}
        {hasCode && (
          <div className="space-y-3">
            {codeBlocks?.map((block, i) => (
              <CodeBlock key={i} code={block.replace(/```\w*\n?/g, '').trim()} />
            ))}
          </div>
        )}

        {/* 文本内容 */}
        {(displayText || !hasCode) && (
          <div className="text-gray-800 whitespace-pre-wrap break-words">
            {displayText || '(无内容)'}
          </div>
        )}
      </div>
    </div>
  )
}

function parseMessages(content: string): Message[] {
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
          // 过滤掉 tool_result，只保留文本内容
          const textParts = content
            .filter((c: any) => c.type !== 'tool_result')
            .map((c: any) => c.text || c.content || '')
            .join('')
          text = textParts
        }

        // 只添加有实际文本内容的用户消息
        if (text.trim()) {
          messages.push({
            id: data.uuid || data.messageId || '',
            type: 'user',
            content: text,
            timestamp: data.timestamp || ''
          })
        }
      } else if (type === 'assistant') {
        const content = data.message?.content
        let text = ''
        if (typeof content === 'string') {
          text = content
        } else if (Array.isArray(content)) {
          text = content.map((c: any) => {
            if (c.type === 'text') return c.text || ''
            if (c.type === 'thinking') return `💭 ${c.thinking || ''}`
            return c.content || c.text || ''
          }).join('\n\n')
        }
        messages.push({
          id: data.uuid || data.message?.id || '',
          type: 'assistant',
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

function getUserMessageOutlines(messages: Message[]): UserMessageOutline[] {
  return messages
    .filter(msg => msg.type === 'user')
    .map((msg) => {
      const preview = msg.content.length > 50
        ? msg.content.slice(0, 50) + '...'
        : msg.content || '(无内容)'
      return {
        index: messages.indexOf(msg),
        preview,
        timestamp: msg.timestamp
      }
    })
}

function Skeleton() {
  return (
    <div className="space-y-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="ml-8">
          <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-3 w-16 bg-gray-200 rounded"></div>
              <div className="h-3 w-24 bg-gray-100 rounded"></div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-gray-100 rounded"></div>
              <div className="h-4 w-3/4 bg-gray-100 rounded"></div>
              <div className="h-4 w-1/2 bg-gray-100 rounded"></div>
            </div>
          </div>
        </div>
      ))}
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
  const [refreshing, setRefreshing] = useState(false)
  const [showOutline, setShowOutline] = useState(true)
  const messageRefs = React.useRef<(HTMLDivElement | null)[]>([])

  const userOutlines = getUserMessageOutlines(messages)

  const scrollToMessage = (index: number) => {
    const element = messageRefs.current[index]
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const loadMessages = async () => {
    try {
      const sessions = await invoke<any[]>('get_sessions', { projectId: slug })
      const session = sessions.find((s: any) => s.id === sessionId)
      if (!session) {
        throw new Error('Session not found')
      }

      const content = await invoke<string>('get_messages', { sessionPath: session.path })
      setMessages(parseMessages(content))
      setError('')
    } catch (err) {
      console.error('Error:', err)
      setError('加载失败')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    if (!slug || !sessionId) return
    loadMessages()
  }, [slug, sessionId])

  const handleRefresh = () => {
    setRefreshing(true)
    loadMessages()
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <div className="h-5 w-5 bg-gray-200 rounded animate-pulse"></div>
              <div className="h-5 w-32 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-8">
          <Skeleton />
        </main>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
          <div className="max-w-4xl mx-auto px-6 py-4">
            <div className="flex items-center gap-4">
              <Link href={`/projects/${slug}`} className="p-2 rounded-lg hover:bg-gray-100 transition-colors">
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <h1 className="text-lg font-semibold text-gray-900">
                {sessionId.slice(0, 8)}...
              </h1>
            </div>
          </div>
        </header>
        <main className="max-w-4xl mx-auto px-6 py-8">
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
            {error}
          </div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href={`/projects/${slug}`}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-lg font-semibold text-gray-900">
                  {sessionId.slice(0, 8)}...
                </h1>
                <p className="text-xs text-gray-500">{messages.length} 条消息</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowOutline(!showOutline)}
                className={`p-2 rounded-lg transition-colors ${
                  showOutline ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'
                }`}
                title={showOutline ? '隐藏大纲' : '显示大纲'}
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors disabled:opacity-50"
                title="刷新"
              >
                <svg
                  className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`}
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* 大纲面板 */}
        {showOutline && userOutlines.length > 0 && (
          <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-200 hidden md:block">
            <div className="sticky top-[65px] p-4 max-h-[calc(100vh-65px)] overflow-y-auto">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                消息大纲 <span className="text-gray-400 font-normal">({userOutlines.length})</span>
              </h2>
              <div className="space-y-2">
                {userOutlines.map((outline, idx) => {
                  const date = outline.timestamp ? new Date(outline.timestamp) : null
                  return (
                    <button
                      key={idx}
                      onClick={() => scrollToMessage(outline.index)}
                      className="w-full text-left p-2 rounded-lg hover:bg-blue-50 transition-colors group"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-blue-600">#{idx + 1}</span>
                        {date && (
                          <span className="text-xs text-gray-400">
                            {date.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2 group-hover:text-gray-800">
                        {outline.preview}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>
          </aside>
        )}

        {/* 消息列表 */}
        <main className={`flex-1 px-6 py-8 ${showOutline ? 'md:pl-0' : ''}`}>
          <div className={`${showOutline ? 'max-w-3xl' : 'max-w-4xl'} mx-auto space-y-6`}>
            {messages.map((msg, idx) => (
              <MessageItem key={`${idx}-${msg.type}`} msg={msg} idx={idx} messageRefs={messageRefs} />
            ))}
          </div>

          {messages.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              暂无消息
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
