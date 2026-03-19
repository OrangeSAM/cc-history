'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { invoke } from '@tauri-apps/api/core'

interface Project {
  id: string
  name: string
  path: string
  session_count: number
  last_modified: string
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    invoke<Project[]>('get_projects')
      .then(data => {
        setProjects(data || [])
        setLoading(false)
      })
      .catch(err => {
        console.error('Error:', err)
        setError('Failed to load projects')
        setLoading(false)
      })
  }, [])

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
      <header className="bg-white shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-gray-900">Claude Code 对话历史</h1>
          <p className="text-gray-500 mt-1">浏览你与 Claude 的所有对话</p>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8">
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {projects.map(project => (
            <Link
              key={project.id}
              href={`/projects/${project.id}`}
              className="block bg-white rounded-lg shadow-sm hover:shadow-md transition-shadow p-6 border border-gray-100"
            >
              <h2 className="text-lg font-semibold text-gray-900 truncate">
                {project.name}
              </h2>
              <div className="mt-3 flex items-center justify-between text-sm text-gray-500">
                <span>{project.session_count} 个会话</span>
                <span>{project.last_modified ? new Date(parseInt(project.last_modified) * 1000).toLocaleDateString('zh-CN') : ''}</span>
              </div>
            </Link>
          ))}
        </div>

        {projects.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            暂无对话记录
          </div>
        )}
      </main>
    </div>
  )
}
