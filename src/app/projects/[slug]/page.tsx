'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { invoke } from '@tauri-apps/api/core'

interface SessionPreview {
  id: string
  preview: string
  message_count: number
  last_modified: string
}

function SessionCard({ session, slug }: { session: SessionPreview; slug: string }) {
  const date = session.last_modified
    ? new Date(parseInt(session.last_modified) * 1000)
    : null

  return (
    <Link
      href={`/projects/${slug}/${session.id}`}
      className="group block bg-white rounded-xl border border-gray-200 p-4 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/50 transition-all duration-200"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-blue-500"></div>
            <span className="text-xs text-gray-400 font-mono">
              {session.id.slice(0, 8)}...
            </span>
            <span className="text-xs text-gray-400">
              · {session.message_count} 条消息
            </span>
          </div>
          {session.preview ? (
            <p className="text-sm text-gray-600 line-clamp-2 group-hover:text-gray-900">
              {session.preview}
            </p>
          ) : (
            <p className="text-sm text-gray-400 italic">暂无预览</p>
          )}
        </div>
        {date && (
          <div className="text-right flex-shrink-0">
            <p className="text-xs text-gray-500">
              {date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })}
            </p>
            <p className="text-xs text-gray-400">
              {date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
        )}
      </div>
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 animate-pulse">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-2 h-2 rounded-full bg-gray-200"></div>
        <div className="h-3 w-20 bg-gray-200 rounded"></div>
      </div>
      <div className="h-4 w-full bg-gray-100 rounded mb-2"></div>
      <div className="h-4 w-3/4 bg-gray-100 rounded"></div>
    </div>
  )
}

export default function ProjectPage() {
  const params = useParams()
  const slug = params.slug as string
  const [sessions, setSessions] = useState<SessionPreview[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const loadSessions = async () => {
    try {
      const data = await invoke<SessionPreview[]>('get_session_previews', { projectId: slug })
      setSessions(data || [])
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
    if (!slug) return
    loadSessions()
  }, [slug])

  const handleRefresh = () => {
    setRefreshing(true)
    loadSessions()
  }

  const projectName = slug
    .replace(/^-Users-liuyibi-Desktop-/, '')
    .replace(/-/g, ' / ')

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                href="/"
                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-xl font-bold text-gray-900 truncate max-w-md">
                  {projectName}
                </h1>
                <p className="text-sm text-gray-500">
                  {loading ? '加载中...' : `${sessions.length} 个会话`}
                </p>
              </div>
            </div>
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
      </header>

      <main className="max-w-4xl mx-auto px-6 py-6">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.map(session => (
              <SessionCard key={session.id} session={session} slug={slug} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">暂无会话</h3>
          </div>
        )}
      </main>
    </div>
  )
}
