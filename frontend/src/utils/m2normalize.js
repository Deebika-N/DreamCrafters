/**
 * Normalize Module 2 API responses so UI can use stable field names.
 * Backend uses Prisma (camelCase); API spec examples often use snake_case.
 */

export function normalizeContentItem(c) {
  if (!c) return c
  const up = c.userProgress
  let userProgress = null
  if (up) {
    userProgress = {
      status: up.status,
      progress_percent: up.progress_percent ?? up.progressPercent ?? 0,
      last_accessed_at: up.last_accessed_at ?? up.lastAccessedAt,
    }
  }
  return {
    ...c,
    duration_minutes: c.duration_minutes ?? c.durationMinutes,
    thumbnail_url: c.thumbnail_url ?? c.thumbnailUrl,
    is_offline_available: c.is_offline_available ?? c.isOfflineAvailable,
    created_at: c.created_at ?? c.createdAt,
    userProgress,
  }
}

export function normalizeCareerPath(cp) {
  if (!cp) return cp
  const content = Array.isArray(cp.content)
    ? cp.content.map((item) => ({
        ...item,
        duration_minutes: item.duration_minutes ?? item.durationMinutes,
      }))
    : cp.content
  return {
    ...cp,
    required_skills: cp.required_skills ?? cp.requiredSkills ?? [],
    avg_salary_range: cp.avg_salary_range ?? cp.avgSalaryRange,
    content,
  }
}

export function normalizeWebinar(w) {
  if (!w) return w
  return {
    ...w,
    scheduled_at: w.scheduled_at ?? w.scheduledAt,
    duration_minutes: w.duration_minutes ?? w.durationMinutes,
    max_participants: w.max_participants ?? w.maxParticipants,
    registered_count: w.registered_count ?? w.registration_count ?? 0,
    join_link: w.join_link ?? w.joinLink,
    is_full: w.is_full ?? w.isFull,
  }
}
