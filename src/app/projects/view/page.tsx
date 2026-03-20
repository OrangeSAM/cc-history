'use client'

import React, { useEffect, useState, Suspense } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { invoke } from '@tauri-apps/api/core'

interface SessionPreview {
  id: string
  preview: string
  message_count: number
  last_modified: string
}

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

// 项目会话列表组件
function SessionList({ slug }: { slug: string }) {
  const [sessions, setSessions] = useState<SessionPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    invoke<SessionPreview[]>('get_session_previews', { projectId: slug })
      .then(data => {
        setSessions(data || [])
        setError('')
      })
      .catch(err => {
        console.error('Error:', err)
        setError('加载失败')
      })
      .finally(() => setLoading(false))
  }, [slug])

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-2 h-2 rounded-full bg-gray-200"></div>
              <div className="h-3 w-20 bg-gray-200 rounded"></div>
            </div>
            <div className="space-y-2">
              <div className="h-4 w-full bg-gray-100 rounded"></div>
              <div className="h-4 w-3/4 bg-gray-100 rounded"></div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">{error}</div>
  }

  return (
    <div className="space-y-4">
      {sessions.map(session => {
        const date = session.last_modified ? new Date(parseInt(session.last_modified) * 1000) : null
        const isValidDate = date && !isNaN(date.getTime())
        return (
          <Link
            key={session.id}
            href={`/projects/view?project=${slug}&id=${session.id}`}
            className="group block bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/50 transition-all duration-200"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                  <span className="text-xs text-gray-400 font-mono">{session.id.slice(0, 8)}...</span>
                  <span className="text-xs text-gray-400">· {session.message_count} 条消息</span>
                </div>
                {session.preview ? (
                  <p className="text-sm text-gray-600 line-clamp-2 group-hover:text-gray-900">{session.preview}</p>
                ) : (
                  <p className="text-sm text-gray-400 italic">暂无预览</p>
                )}
              </div>
              {isValidDate && date && (
                <div className="text-right flex-shrink-0">
                  <p className="text-xs text-gray-500">{date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}</p>
                  <p className="text-xs text-gray-400">{date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}</p>
                </div>
              )}
            </div>
          </Link>
        )
      })}
      {sessions.length === 0 && <div className="text-center py-12 text-gray-500">暂无会话</div>}
    </div>
  )
}

// 会话详情组件
function CodeBlock({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="relative group mt-3">
      <button onClick={handleCopy} className="absolute top-2 right-2 px-2 py-1 text-xs bg-gray-700 text-gray-300 rounded opacity-0 group-hover:opacity-100 hover:bg-gray-600">
        {copied ? '已复制' : '复制'}
      </button>
      <pre className="bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-sm font-mono"><code>{code}</code></pre>
    </div>
  )
}

function MessageItem({ msg, idx, messageRefs }: { msg: Message; idx: number; messageRefs: React.RefObject<(HTMLDivElement | null)[]> }) {
  const [expanded, setExpanded] = useState(false)
  const [copied, setCopied] = useState(false)
  const codeBlockRegex = /```[\s\S]*?```/g
  const codeBlocks = msg.content.match(codeBlockRegex)
  const hasCode = codeBlocks && codeBlocks.length > 0
  let displayContent = msg.content
  if (hasCode) displayContent = msg.content.replace(codeBlockRegex, '').trim()
  const lines = displayContent.split('\n')
  const isLong = lines.length > COLLAPSE_LINES
  const displayText = isLong && !expanded ? lines.slice(0, COLLAPSE_LINES).join('\n') + '\n...' : displayContent
  const handleCopy = async () => {
    await navigator.clipboard.writeText(msg.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  const date = msg.timestamp ? new Date(msg.timestamp) : null
  return (
    <div ref={(el) => { messageRefs.current[idx] = el }} className="relative">
      {idx > 0 && <div className="absolute left-5 top-0 bottom-[-1rem] w-px bg-gray-200"></div>}
      <div className={`absolute left-4 w-3 h-3 rounded-full border-2 border-white shadow-sm z-10 ${msg.type === 'user' ? 'bg-blue-500' : msg.type === 'assistant' ? 'bg-green-500' : 'bg-gray-400'}`}></div>
      <div className={`ml-8 rounded-xl p-4 ${msg.type === 'user' ? 'bg-blue-50 border border-blue-100' : msg.type === 'assistant' ? 'bg-white border border-gray-200 shadow-sm' : 'bg-gray-100 border border-gray-200'}`}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className={`text-xs font-semibold ${msg.type === 'user' ? 'text-blue-600' : msg.type === 'assistant' ? 'text-green-600' : 'text-gray-500'}`}>
              {msg.type === 'user' ? '👤 你' : msg.type === 'assistant' ? '🤖 Claude' : '📁 快照'}
            </span>
            {date && <span className="text-xs text-gray-400">{date.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
          </div>
          <div className="flex items-center gap-2">
            <button onClick={handleCopy} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" /></svg>
            </button>
            {(isLong || hasCode) && <button onClick={() => setExpanded(!expanded)} className="text-xs text-blue-500">{expanded ? '收起' : '展开'}</button>}
          </div>
        </div>
        {hasCode && <div className="space-y-3">{codeBlocks?.map((block, i) => <CodeBlock key={i} code={block.replace(/```\w*\n?/g, '').trim()} />)}</div>}
        {(displayText || !hasCode) && <div className="text-gray-800 whitespace-pre-wrap">{displayText || '(无内容)'}</div>}
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
        messages.push({ id: data.messageId || data.snapshot?.messageId || '', type: 'snapshot', content: `File snapshot: ${Object.keys(data.snapshot?.trackedFileBackups || {}).join(', ') || 'No files'}`, timestamp: data.timestamp || data.snapshot?.timestamp || '' })
      } else if (type === 'user') {
        const content = data.message?.content
        let text = ''
        if (typeof content === 'string') text = content
        else if (Array.isArray(content)) {
          text = content.filter((c: any) => c.type !== 'tool_result').map((c: any) => c.text || c.content || '').join('')
        }
        if (text.trim()) messages.push({ id: data.uuid || data.messageId || '', type: 'user', content: text, timestamp: data.timestamp || '' })
      } else if (type === 'assistant') {
        const content = data.message?.content
        let text = ''
        if (typeof content === 'string') text = content
        else if (Array.isArray(content)) text = content.map((c: any) => c.type === 'text' ? c.text || '' : c.type === 'thinking' ? `💭 ${c.thinking || ''}` : c.content || c.text || '').join('\n\n')
        messages.push({ id: data.uuid || data.message?.id || '', type: 'assistant', content: text, timestamp: data.timestamp || '' })
      }
    } catch (e) {}
  }
  return messages
}

function getUserMessageOutlines(messages: Message[]): UserMessageOutline[] {
  return messages.filter(msg => msg.type === 'user').map((msg, _, arr) => ({
    index: messages.indexOf(msg),
    preview: msg.content.length > 50 ? msg.content.slice(0, 50) + '...' : msg.content || '(无内容)',
    timestamp: msg.timestamp
  }))
}

function MessageList({ slug, sessionId }: { slug: string; sessionId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const [showOutline, setShowOutline] = useState(true)
  const messageRefs = React.useRef<(HTMLDivElement | null)[]>([])
  const userOutlines = getUserMessageOutlines(messages)

  const scrollToMessage = (index: number) => messageRefs.current[index]?.scrollIntoView({ behavior: 'smooth', block: 'start' })

  const loadMessages = async () => {
    try {
      const sessions = await invoke<any[]>('get_sessions', { projectId: slug })
      const session = sessions.find((s: any) => s.id === sessionId)
      if (!session) throw new Error('Session not found')
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

  useEffect(() => { if (slug && sessionId) loadMessages() }, [slug, sessionId])

  const handleRefresh = () => { setRefreshing(true); loadMessages() }

  if (loading) return (
    <div className="space-y-6">
      {Array.from({ length: 5 }).map((_, i) => (
        <div key={i} className="ml-8"><div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse"><div className="flex items-center gap-2 mb-3"><div className="h-3 w-16 bg-gray-200 rounded"></div><div className="h-3 w-24 bg-gray-100 rounded"></div></div><div className="space-y-2"><div className="h-4 w-full bg-gray-100 rounded"></div><div className="h-4 w-3/4 bg-gray-100 rounded"></div></div></div></div>
      ))}
    </div>
  )

  if (error) return (
    <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-600">
      <Link href={`/projects/view?project=${slug}`} className="flex items-center gap-2 text-blue-500 hover:underline mb-4">
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        返回会话列表
      </Link>
      {error}
    </div>
  )

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <Link href={`/projects/view?project=${slug}`} className="p-2 rounded-lg hover:bg-gray-100">
          <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
        </Link>
        <h1 className="text-lg font-semibold text-gray-900">{sessionId.slice(0, 8)}...</h1>
        <p className="text-xs text-gray-500">{messages.length} 条消息</p>
        <button onClick={() => setShowOutline(!showOutline)} className={`ml-auto p-2 rounded-lg ${showOutline ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-100 text-gray-600'}`}>
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" /></svg>
        </button>
        <button onClick={handleRefresh} disabled={refreshing} className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-50">
          <svg className={`w-5 h-5 text-gray-600 ${refreshing ? 'animate-spin' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
        </button>
      </div>
      <div className="flex">
        {showOutline && userOutlines.length > 0 && (
          <aside className="w-64 flex-shrink-0 bg-white border-r border-gray-200 hidden md:block">
            <div className="sticky top-0 p-4 max-h-[calc(100vh-100px)] overflow-y-auto">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">消息大纲 <span className="text-gray-400 font-normal">({userOutlines.length})</span></h2>
              <div className="space-y-2">
                {userOutlines.map((outline, idx) => {
                  const date = outline.timestamp ? new Date(outline.timestamp) : null
                  return (
                    <button key={idx} onClick={() => scrollToMessage(outline.index)} className="w-full text-left p-2 rounded-lg hover:bg-blue-50 group">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-medium text-blue-600">#{idx + 1}</span>
                        {date && <span className="text-xs text-gray-400">{date.toLocaleString('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>}
                      </div>
                      <p className="text-xs text-gray-600 line-clamp-2">{outline.preview}</p>
                    </button>
                  )
                })}
              </div>
            </div>
          </aside>
        )}
        <main className={`flex-1 space-y-6 ${showOutline ? 'md:pl-4' : ''}`}>
          {messages.map((msg, idx) => <MessageItem key={`${idx}-${msg.type}`} msg={msg} idx={idx} messageRefs={messageRefs} />)}
          {messages.length === 0 && <div className="text-center py-12 text-gray-500">暂无消息</div>}
        </main>
      </div>
    </div>
  )
}

// 主页面组件
function ViewPageContent() {
  const searchParams = useSearchParams()
  const slug = searchParams.get('project')
  const sessionId = searchParams.get('id')

  // 头部
  const Header = () => (
    <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
      <div className="max-w-4xl mx-auto px-6 py-4">
        <div className="flex items-center gap-4">
          <Link href="/" className="p-2 rounded-lg hover:bg-gray-100">
            <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" /></svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">
            {slug ? slug.replace(/-/g, ' / ').replace(/Users.*Desktop./i, '') : 'Claude Code 历史'}
          </h1>
        </div>
      </div>
    </header>
  )

  if (!slug) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
        <Header />
        <main className="max-w-4xl mx-auto px-6 py-8">
          <div className="text-center py-12 text-gray-500">请选择一个项目</div>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <Header />
      <main className="max-w-4xl mx-auto px-6 py-8">
        {sessionId ? <MessageList slug={slug} sessionId={sessionId} /> : <SessionList slug={slug} />}
      </main>
    </div>
  )
}

export default function ViewPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 flex items-center justify-center"><div className="text-gray-500">加载中...</div></div>}>
      <ViewPageContent />
    </Suspense>
  )
}
