import { invoke } from '@tauri-apps/api/core'
import type { Project, SessionPreview, Session, UsageStats } from '../types'

export async function getProjects(): Promise<Project[]> {
  return invoke<Project[]>('get_projects')
}

export async function getSessionPreviews(projectId: string): Promise<SessionPreview[]> {
  return invoke<SessionPreview[]>('get_session_previews', { projectId })
}

export async function getSessions(projectId: string): Promise<Session[]> {
  return invoke<Session[]>('get_sessions', { projectId })
}

export async function getMessages(sessionPath: string): Promise<string> {
  return invoke<string>('get_messages', { sessionPath })
}

export async function getUsageStats(): Promise<UsageStats> {
  return invoke<UsageStats>('get_usage_stats')
}
