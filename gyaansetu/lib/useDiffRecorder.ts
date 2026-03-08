'use client'

import { useRef, useCallback } from 'react'
import type { ReplaySnapshot, ReplayEvent, ReplayPaste, ReplayLog } from './replayEngine'

// ─── Constants ────────────────────────────────────────────────────────────────

const MAX_EVENTS = 10_000
const MAX_SNAPSHOT_BYTES = 460_000 // ~460 KB total snapshot budget
const SNAPSHOT_INTERVAL_MS = 3_000 // snapshot every 3 seconds
const SUSPICIOUS_PASTE_THRESHOLD = 100 // chars — flag paste if ≥ 100 chars after 5s
const SUSPICIOUS_PASTE_DELAY = 5_000 // ms of recording before paste is flagged

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * useDiffRecorder — React hook for recording WritingDNA.
 *
 * Records a `ReplayLog` containing:
 *   - snapshots: full code snapshots every 3 seconds
 *   - events: keystroke-level ins/del events (capped at 10,000)
 *   - pastes: detected paste operations with the pasted text
 *   - tabSwitches: count
 *   - totalDuration: ms
 *
 * Works with both <textarea> and Monaco editors.
 */
export function useDiffRecorder() {
    const sessionStartRef = useRef<number>(Date.now())
    const snapshotsRef = useRef<ReplaySnapshot[]>([])
    const eventsRef = useRef<ReplayEvent[]>([])
    const pastesRef = useRef<ReplayPaste[]>([])
    const tabSwitchesRef = useRef<number>(0)
    const lastSnapshotTimeRef = useRef<number>(0)
    const lastCodeRef = useRef<string>('')
    const totalSnapshotBytesRef = useRef<number>(0)
    const initialisedRef = useRef<boolean>(false)

    /**
     * Seed the log with the initial content (template code or empty string).
     * Call once when the editor loads.
     */
    const initLog = useCallback((initialCode: string) => {
        if (initialisedRef.current) return
        initialisedRef.current = true
        sessionStartRef.current = Date.now()
        lastCodeRef.current = initialCode

        const snapshot: ReplaySnapshot = { t: 0, code: initialCode }
        snapshotsRef.current = [snapshot]
        eventsRef.current = []
        pastesRef.current = []
        tabSwitchesRef.current = 0
        lastSnapshotTimeRef.current = 0
        totalSnapshotBytesRef.current = initialCode.length
    }, [])

    /**
     * Get elapsed time since session start.
     */
    const now = useCallback(() => {
        return Date.now() - sessionStartRef.current
    }, [])

    /**
     * Push a snapshot if enough time has elapsed and the code changed.
     */
    const maybeSnapshot = useCallback((currentCode: string) => {
        const t = now()
        if (
            t - lastSnapshotTimeRef.current >= SNAPSHOT_INTERVAL_MS &&
            currentCode !== lastCodeRef.current &&
            totalSnapshotBytesRef.current + currentCode.length < MAX_SNAPSHOT_BYTES
        ) {
            snapshotsRef.current.push({ t, code: currentCode })
            lastSnapshotTimeRef.current = t
            totalSnapshotBytesRef.current += currentCode.length
            lastCodeRef.current = currentCode
        }
    }, [now])

    /**
     * Record a text change event from a <textarea>.
     * Call this in the onChange handler, passing the new full value.
     */
    const recordTextChange = useCallback((newValue: string) => {
        if (eventsRef.current.length >= MAX_EVENTS) return

        const t = now()
        const oldValue = lastCodeRef.current

        // Heuristic: detect if it's an insertion or deletion
        if (newValue.length > oldValue.length) {
            // Insertion — find what was inserted
            const lenDiff = newValue.length - oldValue.length
            // Quick approximation: push the raw change
            eventsRef.current.push({ t, ins: newValue.slice(-lenDiff) })
        } else if (newValue.length < oldValue.length) {
            // Deletion
            const lenDiff = oldValue.length - newValue.length
            eventsRef.current.push({ t, del: lenDiff })
        }

        lastCodeRef.current = newValue
        maybeSnapshot(newValue)
    }, [now, maybeSnapshot])

    /**
     * Record a change event from Monaco editor's onDidChangeModelContent.
     * Handles Monaco's IModelContentChangedEvent properly.
     */
    const recordMonacoChange = useCallback((
        changes: Array<{ text: string; rangeLength: number }>,
        fullCode: string,
    ) => {
        if (eventsRef.current.length >= MAX_EVENTS) return

        const t = now()

        for (const change of changes) {
            if (change.rangeLength > 0) {
                eventsRef.current.push({ t, del: change.rangeLength })
            }
            if (change.text.length > 0) {
                eventsRef.current.push({ t, ins: change.text })

                // Check for suspicious paste (100+ chars after 5s of recording)
                if (
                    change.text.length >= SUSPICIOUS_PASTE_THRESHOLD &&
                    t > SUSPICIOUS_PASTE_DELAY
                ) {
                    pastesRef.current.push({
                        t,
                        text: change.text,
                        len: change.text.length,
                    })
                }
            }
        }

        lastCodeRef.current = fullCode
        maybeSnapshot(fullCode)
    }, [now, maybeSnapshot])

    /**
     * Record a detected paste from a ClipboardEvent.
     * Call in the onPaste handler.
     */
    const recordPaste = useCallback((pastedText: string) => {
        const t = now()
        if (
            pastedText.length >= SUSPICIOUS_PASTE_THRESHOLD &&
            t > SUSPICIOUS_PASTE_DELAY
        ) {
            pastesRef.current.push({
                t,
                text: pastedText,
                len: pastedText.length,
            })
        }
    }, [now])

    /**
     * Increment the tab-switch counter.
     */
    const recordTabSwitch = useCallback(() => {
        tabSwitchesRef.current++
    }, [])

    /**
     * Take a final snapshot and return the complete ReplayLog.
     * Call right before submission.
     */
    const finalise = useCallback((currentCode: string): ReplayLog => {
        const t = now()

        // Force a final snapshot
        if (currentCode !== snapshotsRef.current[snapshotsRef.current.length - 1]?.code) {
            snapshotsRef.current.push({ t, code: currentCode })
        }

        return {
            snapshots: snapshotsRef.current,
            events: eventsRef.current,
            pastes: pastesRef.current,
            tabSwitches: tabSwitchesRef.current,
            totalDuration: t,
        }
    }, [now])

    return {
        initLog,
        recordTextChange,
        recordMonacoChange,
        recordPaste,
        recordTabSwitch,
        finalise,
        tabSwitchesRef,
    }
}
