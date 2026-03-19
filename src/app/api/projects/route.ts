import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'
import os from 'os'

interface Project {
  id: string
  name: string
  path: string
  sessionCount: number
  lastModified: string
}

function getProjects(): Project[] {
  const homeDir = os.homedir()
  const projectsDir = path.join(homeDir, '.claude/projects')

  if (!fs.existsSync(projectsDir)) {
    return []
  }

  const entries = fs.readdirSync(projectsDir, { withFileTypes: true })

  return entries
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => {
      const projectPath = path.join(projectsDir, entry.name)
      const files = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'))

      let lastModified = ''
      if (files.length > 0) {
        const stats = fs.statSync(path.join(projectPath, files[0]))
        lastModified = stats.mtime.toISOString()
      }

      return {
        id: entry.name,
        name: entry.name.replace(/^-Users-liuyibi-Desktop-/, '').replace(/-/g, ' / '),
        path: projectPath,
        sessionCount: files.length,
        lastModified
      }
    })
    .filter(p => p.sessionCount > 0)
    .sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())
}

export async function GET() {
  try {
    const projects = getProjects()
    return NextResponse.json({ projects })
  } catch (error) {
    console.error('Error getting projects:', error)
    return NextResponse.json({ error: 'Failed to get projects' }, { status: 500 })
  }
}
