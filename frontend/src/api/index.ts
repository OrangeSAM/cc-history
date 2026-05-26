import { invoke } from '@tauri-apps/api/core'
import type { Project, SessionPreview, Session, UsageStats, HermesSession, HermesMessage } from '../types'

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

export async function getUsageStats(source: string = 'all'): Promise<UsageStats> {
  return invoke<UsageStats>('get_usage_stats', { source })
}

export async function getHermesSessions(): Promise<HermesSession[]> {
  return invoke<HermesSession[]>('get_hermes_sessions')
}

export async function getHermesMessages(sessionId: string): Promise<HermesMessage[]> {
  return invoke<HermesMessage[]>('get_hermes_messages', { sessionId })
}
