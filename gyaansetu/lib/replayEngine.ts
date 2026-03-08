/**
 * ReplayEngine — Core algorithm for WritingDNA playback.
 *
 * Shared by both CodePlayback (student, simple snap) and
 * CodeReplayViewer (teacher, smooth interpolation).
 */

// ─── Data Structures ──────────────────────────────────────────────────────────

export interface ReplaySnapshot {
    /** Milliseconds since session start */
    t: number
    /** Full code/text content at this point */
    code: string
}

export interface ReplayEvent {
    /** Milliseconds since session start */
    t: number
    /** Inserted text (if any) */
    ins?: string
    /** Number of characters deleted (if any) */
    del?: number
}

export interface ReplayPaste {
    /** Milliseconds since session start */
    t: number
    /** The pasted text */
    text: string
    /** Character length */
    len: number
}

export interface ReplayLog {
    snapshots: ReplaySnapshot[]
    events: ReplayEvent[]
    pastes: ReplayPaste[]
    tabSwitches: number
    totalDuration: number
}

// ─── Binary Search ────────────────────────────────────────────────────────────

/**
 * Find the index of the last snapshot whose timestamp <= targetTime.
 * Uses binary search for O(log n) performance, fast enough for 50ms ticks.
 */
export function findSnapshotIndex(snapshots: ReplaySnapshot[], targetTime: number): number {
    let lo = 0
    let hi = snapshots.length - 1
    let result = 0

    while (lo <= hi) {
        const mid = (lo + hi) >>> 1
        if (snapshots[mid].t <= targetTime) {
            result = mid
            lo = mid + 1
        } else {
            hi = mid - 1
        }
    }

    return result
}

/**
 * Get the code content at a given timestamp by snapping to the nearest snapshot.
 * Used by the student (simple) playback.
 */
export function getCodeAtTime(snapshots: ReplaySnapshot[], targetTime: number): string {
    if (snapshots.length === 0) return ''
    const idx = findSnapshotIndex(snapshots, targetTime)
    return snapshots[idx].code
}

// ─── Smooth Interpolation (Teacher View Only) ─────────────────────────────────

/**
 * Animate the transition between two adjacent snapshots.
 *
 * Algorithm:
 * 1. Find the common prefix and common suffix of strings a & b.
 * 2. The "middle" (the part that actually changed) is what animates:
 *    - progress 0 → 0.5  →  erase chars from a's middle (shrink from right)
 *    - progress 0.5 → 1  →  insert chars from b's middle (grow from left)
 *
 * This creates a delete-then-insert animation that looks like real typing.
 */
export function interpolateCode(a: string, b: string, progress: number): string {
    if (progress <= 0) return a
    if (progress >= 1) return b
    if (a === b) return a

    // Find common prefix
    let prefixLen = 0
    const minLen = Math.min(a.length, b.length)
    while (prefixLen < minLen && a[prefixLen] === b[prefixLen]) {
        prefixLen++
    }

    // Find common suffix (non-overlapping with prefix)
    let suffixLen = 0
    while (
        suffixLen < minLen - prefixLen &&
        a[a.length - 1 - suffixLen] === b[b.length - 1 - suffixLen]
    ) {
        suffixLen++
    }

    const prefix = a.slice(0, prefixLen)
    const suffix = a.slice(a.length - suffixLen || a.length)
    const aMiddle = a.slice(prefixLen, a.length - suffixLen || a.length)
    const bMiddle = b.slice(prefixLen, b.length - suffixLen || b.length)

    let middle: string
    if (progress < 0.5) {
        // Phase 1: erase characters from a's middle (shrink from right)
        const eraseProgress = progress * 2 // 0→1 over the first half
        const charsToKeep = Math.round(aMiddle.length * (1 - eraseProgress))
        middle = aMiddle.slice(0, charsToKeep)
    } else {
        // Phase 2: insert characters from b's middle (grow from left)
        const insertProgress = (progress - 0.5) * 2 // 0→1 over the second half
        const charsToShow = Math.round(bMiddle.length * insertProgress)
        middle = bMiddle.slice(0, charsToShow)
    }

    return prefix + middle + suffix
}

/**
 * Get interpolated code at a given timestamp.
 * Finds the two bounding snapshots and interpolates between them.
 */
export function getInterpolatedCodeAtTime(
    snapshots: ReplaySnapshot[],
    targetTime: number,
): string {
    if (snapshots.length === 0) return ''
    if (snapshots.length === 1) return snapshots[0].code

    const idx = findSnapshotIndex(snapshots, targetTime)

    // If we're at or past the last snapshot, return its code
    if (idx >= snapshots.length - 1) {
        return snapshots[snapshots.length - 1].code
    }

    const curr = snapshots[idx]
    const next = snapshots[idx + 1]

    // Calculate progress between the two snapshots
    const span = next.t - curr.t
    if (span <= 0) return curr.code

    const progress = Math.min(1, Math.max(0, (targetTime - curr.t) / span))
    return interpolateCode(curr.code, next.code, progress)
}

// ─── Stats ────────────────────────────────────────────────────────────────────

export interface ReplayStats {
    totalCharsInserted: number
    totalCharsDeleted: number
    totalPastes: number
    largestPasteLen: number
    suspiciousPasteCount: number
    tabSwitches: number
}

/**
 * Compute summary statistics from a replay log.
 */
export function computeReplayStats(log: ReplayLog): ReplayStats {
    let totalCharsInserted = 0
    let totalCharsDeleted = 0

    for (const ev of log.events) {
        if (ev.ins) totalCharsInserted += ev.ins.length
        if (ev.del) totalCharsDeleted += ev.del
    }

    let largestPasteLen = 0
    let suspiciousPasteCount = 0
    for (const p of log.pastes) {
        if (p.len > largestPasteLen) largestPasteLen = p.len
        if (p.len >= 100) suspiciousPasteCount++
    }

    return {
        totalCharsInserted,
        totalCharsDeleted,
        totalPastes: log.pastes.length,
        largestPasteLen,
        suspiciousPasteCount,
        tabSwitches: log.tabSwitches,
    }
}

/**
 * Format milliseconds into m:ss display.
 */
export function formatTime(ms: number): string {
    const totalSeconds = Math.floor(ms / 1000)
    const minutes = Math.floor(totalSeconds / 60)
    const seconds = totalSeconds % 60
    return `${minutes}:${seconds.toString().padStart(2, '0')}`
}
