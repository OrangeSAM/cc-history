import { NextResponse } from 'next/server'
import fs from 'fs'
import path from 'path'

interface Session {
  id: string
  name: string
  path: string
  lastModified: string
  size: number
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const PROJECTS_DIR = path.join(process.env.HOME || '/Users/liuyibi', '.claude/projects')
    const projectPath = path.join(PROJECTS_DIR, slug)

    if (!fs.existsSync(projectPath)) {
      return NextResponse.json({ error: 'Project not found' }, { status: 404 })
    }

    const files = fs.readdirSync(projectPath).filter(f => f.endsWith('.jsonl'))

    const sessions: Session[] = files.map(file => {
      const filePath = path.join(projectPath, file)
      const stats = fs.statSync(filePath)
      return {
        id: file.replace('.jsonl', ''),
        name: file.replace('.jsonl', ''),
        path: filePath,
        lastModified: stats.mtime.toISOString(),
        size: stats.size
      }
    }).sort((a, b) => new Date(b.lastModified).getTime() - new Date(a.lastModified).getTime())

    return NextResponse.json({ sessions })
  } catch (error) {
    console.error('Error getting sessions:', error)
    return NextResponse.json({ error: 'Failed to get sessions' }, { status: 500 })
  }
}
