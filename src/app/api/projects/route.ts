import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

const PROJECTS_DIR = path.join(process.env.HOME || '/Users/liuyibi', '.claude/projects')

interface Project {
  id: string
  name: string
  path: string
  sessionCount: number
  lastModified: string
}

function getProjects(): Project[] {
  if (!fs.existsSync(PROJECTS_DIR)) {
    return []
  }

  const entries = fs.readdirSync(PROJECTS_DIR, { withFileTypes: true })

  return entries
    .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
    .map(entry => {
      const projectPath = path.join(PROJECTS_DIR, entry.name)
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
