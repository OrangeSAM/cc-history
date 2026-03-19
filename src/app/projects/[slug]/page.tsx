'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { invoke } from '@tauri-apps/api/core'

interface Session {
  id: string
  name: string
  last_modified: string
  size: number
}

export default function ProjectPage() {
  const params = useParams()
  const slug = params.slug as string
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!slug) return
    invoke<Session[]>('get_sessions', { projectId: slug })
      .then(data => {
        setSessions(data || [])
        setLoading(false)
      })
      .catch(err => {
        console.error('Error:', err)
        setError('Failed to load sessions')
        setLoading(false)
      })
  }, [slug])

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

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <div className="flex items-center gap-4">
            <Link href="/" className="text-gray-500 hover:text-gray-700">
              ← 返回
            </Link>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {slug.replace(/^-Users-liuyibi-Desktop-/, '').replace(/-/g, ' / ')}
              </h1>
              <p className="text-gray-500 mt-1">{sessions.length} 个会话</p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="space-y-3">
          {sessions.map(session => (
            <Link
              key={session.id}
              href={`/projects/${slug}/${session.id}`}
              className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-4 border border-gray-100"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900 truncate max-w-md">
                    {session.id}
                  </h3>
                  <p className="text-sm text-gray-500 mt-1">
                    {session.last_modified ? new Date(parseInt(session.last_modified) * 1000).toLocaleString('zh-CN') : ''}
                  </p>
                </div>
                <span className="text-sm text-gray-400">
                  {formatSize(session.size)}
                </span>
              </div>
            </Link>
          ))}
        </div>

        {sessions.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            暂无会话
          </div>
        )}
      </main>
    </div>
  )
}
