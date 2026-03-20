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

function ProjectCard({ project }: { project: Project }) {
  const date = project.last_modified
    ? new Date(parseInt(project.last_modified) * 1000)
    : null

  return (
    <Link
      href={`/projects/view?project=${project.id}`}
      className="group bg-white rounded-xl border border-gray-200 p-5 hover:border-blue-300 hover:shadow-lg hover:shadow-blue-100/50 transition-all duration-200"
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-semibold text-sm shadow-md">
            {project.name.charAt(0).toUpperCase()}
          </div>
          <div>
            <h2 className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors line-clamp-1">
              {project.name}
            </h2>
            <p className="text-sm text-gray-500">{project.session_count} 个会话</p>
          </div>
        </div>
      </div>
      {date && (
        <p className="mt-3 text-xs text-gray-400">
          最近活动：{date.toLocaleDateString('zh-CN', { month: 'short', day: 'numeric' })} {date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}
    </Link>
  )
}

function SkeletonCard() {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-lg bg-gray-200"></div>
        <div>
          <div className="h-4 w-32 bg-gray-200 rounded mb-2"></div>
          <div className="h-3 w-20 bg-gray-100 rounded"></div>
        </div>
      </div>
      <div className="mt-3 h-3 w-24 bg-gray-100 rounded"></div>
    </div>
  )
}

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [refreshing, setRefreshing] = useState(false)

  const loadProjects = async () => {
    try {
      const data = await invoke<Project[]>('get_projects')
      // 按最后修改时间排序
      const sorted = (data || []).sort((a, b) =>
        parseInt(b.last_modified || '0') - parseInt(a.last_modified || '0')
      )
      setProjects(sorted)
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
    loadProjects()
  }, [])

  const handleRefresh = () => {
    setRefreshing(true)
    loadProjects()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">
      <header className="bg-white/80 backdrop-blur-sm border-b border-gray-200 sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Claude Code 历史
              </h1>
              <p className="text-gray-500 text-sm mt-1">浏览你与 Claude 的所有对话</p>
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

      <main className="max-w-5xl mx-auto px-6 py-8">
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            {error}
          </div>
        )}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonCard key={i} />
            ))}
          </div>
        ) : projects.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {projects.map(project => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-gray-100 flex items-center justify-center">
              <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-1">暂无对话记录</h3>
            <p className="text-gray-500 text-sm">开始与 Claude Code 对话后会显示在这里</p>
          </div>
        )}
      </main>
    </div>
  )
}
