'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import {
    getInterpolatedCodeAtTime,
    formatTime,
    computeReplayStats,
    type ReplayLog,
} from '@/lib/replayEngine'
import styles from './replay.module.css'

// ─── Speed Options (more options for teacher) ─────────────────────────────────

const SPEED_OPTIONS = [0.25, 0.5, 1, 2, 4, 8]

// ─── Props ────────────────────────────────────────────────────────────────────

interface CodeReplayViewerProps {
    /** The parsed ReplayLog from the submission */
    log: ReplayLog
    /** Final submitted text (shown in left panel of split view) */
    finalText?: string
    /** Whether this is a text assignment (affects editor font) */
    isTextMode?: boolean
    /** Student name for the title */
    studentName?: string
}

// ─── Teacher Replay Viewer ────────────────────────────────────────────────────

/**
 * CodeReplayViewer — Rich WritingDNA replay for teachers.
 *
 * Features:
 *  • Smooth interpolation via interpolateCode() (delete-then-insert animation)
 *  • Imperative DOM update via editorRef to avoid scroll jumping
 *  • Orange paste markers on timeline with hover previews
 *  • Tab-switch counter badge
 *  • Suspicious activity banner (red if paste, orange if tab-switch only)
 *  • Jump-to-anomaly buttons
 *  • 0.25×–8× speed options
 */
export default function CodeReplayViewer({
    log,
    finalText,
    isTextMode = false,
    studentName,
}: CodeReplayViewerProps) {
    const [currentTime, setCurrentTime] = useState(0)
    const [isPlaying, setIsPlaying] = useState(false)
    const [speed, setSpeed] = useState(1)
    const [hoveredPasteIdx, setHoveredPasteIdx] = useState<number | null>(null)

    // Authoritative time — never in React state to avoid closure staleness
    const timeRef = useRef(0)
    const animFrameRef = useRef<number | null>(null)
    const lastRafTimeRef = useRef<number | null>(null)

    // Imperative editor ref — we call editorRef.current.textContent = code
    // directly to avoid Monaco scroll jumps on rapid re-renders
    const editorRef = useRef<HTMLPreElement>(null)

    const duration = log.totalDuration || 1
    const stats = computeReplayStats(log)

    const isSuspicious = stats.suspiciousPasteCount > 0 || log.tabSwitches >= 3

    // ── Tick loop with smooth interpolation ───────────────────────────────

    const tick = useCallback(
        (rafNow: number) => {
            if (lastRafTimeRef.current === null) {
                lastRafTimeRef.current = rafNow
            }
            const elapsed = (rafNow - lastRafTimeRef.current) * speed
            lastRafTimeRef.current = rafNow

            timeRef.current = Math.min(timeRef.current + elapsed, duration)

            // Imperative update to avoid scroll jitter
            if (editorRef.current) {
                const interpolated = getInterpolatedCodeAtTime(log.snapshots, timeRef.current)
                editorRef.current.textContent = interpolated
            }

            // Sync React state for scrubber (at lower frequency is fine)
            setCurrentTime(timeRef.current)

            if (timeRef.current < duration) {
                animFrameRef.current = requestAnimationFrame(tick)
            } else {
                setIsPlaying(false)
            }
        },
        [speed, duration, log.snapshots],
    )

    // ── Play / Pause ───────────────────────────────────────────────────────

    const handlePlayPause = useCallback(() => {
        setIsPlaying((prev) => {
            if (prev) {
                if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
                lastRafTimeRef.current = null
                return false
            } else {
                if (timeRef.current >= duration) {
                    timeRef.current = 0
                    setCurrentTime(0)
                    if (editorRef.current) editorRef.current.textContent = ''
                }
                lastRafTimeRef.current = null
                animFrameRef.current = requestAnimationFrame(tick)
                return true
            }
        })
    }, [tick, duration])

    // Re-create tick loop on speed change while playing
    useEffect(() => {
        if (isPlaying) {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
            lastRafTimeRef.current = null
            animFrameRef.current = requestAnimationFrame(tick)
        }
    }, [speed, isPlaying, tick])

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
        }
    }, [])

    // Seed editor on initial render
    useEffect(() => {
        if (editorRef.current && log.snapshots.length > 0) {
            editorRef.current.textContent = log.snapshots[0].code
        }
    }, [log.snapshots])

    // ── Scrubber seek ──────────────────────────────────────────────────────

    const handleScrubberChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const t = Number(e.target.value)
            timeRef.current = t
            setCurrentTime(t)
            if (editorRef.current) {
                editorRef.current.textContent = getInterpolatedCodeAtTime(log.snapshots, t)
            }
        },
        [log.snapshots],
    )

    // ── Jump to paste anomaly ──────────────────────────────────────────────

    const jumpTo = useCallback(
        (t: number) => {
            timeRef.current = t
            setCurrentTime(t)
            if (editorRef.current) {
                editorRef.current.textContent = getInterpolatedCodeAtTime(log.snapshots, t)
            }
        },
        [log.snapshots],
    )

    const fillPercent = duration > 0 ? (currentTime / duration) * 100 : 0

    if (!log.snapshots || log.snapshots.length === 0) {
        return (
            <div className={styles.replayShell}>
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📼</div>
                    <div>No replay data recorded for this submission</div>
                </div>
            </div>
        )
    }

    return (
        <div className={styles.replayShell}>
            {/* ── Toolbar ──────────────────────────────────────────── */}
            <div className={styles.toolbar}>
                <span className={styles.toolbarTitle}>
                    {studentName ? `${studentName} — WritingDNA` : 'WritingDNA Replay'}
                </span>

                {/* Stats badges */}
                <span className={`${styles.statBadge} ${styles.statBadgeNeutral}`}>
                    {log.snapshots.length} snapshots
                </span>
                <span className={`${styles.statBadge} ${styles.statBadgeGreen}`}>
                    +{stats.totalCharsInserted} ins
                </span>
                <span className={`${styles.statBadge} ${styles.statBadgeNeutral}`}>
                    -{stats.totalCharsDeleted} del
                </span>
                {log.pastes.length > 0 && (
                    <span className={`${styles.statBadge} ${styles.statBadgeOrange}`}>
                        {log.pastes.length} paste{log.pastes.length !== 1 ? 's' : ''} detected
                    </span>
                )}
                {log.tabSwitches > 0 && (
                    <span className={`${styles.statBadge} ${styles.statBadgeYellow}`}>
                        ⚠ {log.tabSwitches} tab switch{log.tabSwitches !== 1 ? 'es' : ''}
                    </span>
                )}
            </div>

            {/* ── Editor (imperative, no re-render) ────────────────── */}
            <div className={styles.editorArea}>
                <pre
                    ref={editorRef}
                    className={`${styles.editorContent} ${isTextMode ? styles.editorContentText : ''}`}
                />
            </div>

            {/* ── Timeline ─────────────────────────────────────────── */}
            <div className={styles.timeline}>
                <div className={styles.timeRow}>
                    <span className={styles.timeLabel}>
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </span>

                    {/* Scrubber with paste markers */}
                    <div className={styles.scrubberWrap}>
                        <div className={styles.scrubberTrack} />
                        <div
                            className={styles.scrubberFill}
                            style={{ width: `${fillPercent}%` }}
                        />

                        {/* Orange paste markers */}
                        {log.pastes.map((p, i) => {
                            const leftPct = duration > 0 ? (p.t / duration) * 100 : 0
                            return (
                                <div
                                    key={i}
                                    className={styles.pasteMarker}
                                    style={{ left: `calc(${leftPct}% - 4px)` }}
                                    onMouseEnter={() => setHoveredPasteIdx(i)}
                                    onMouseLeave={() => setHoveredPasteIdx(null)}
                                    onClick={() => jumpTo(p.t)}
                                    title={`Paste: ${p.len} chars`}
                                >
                                    {hoveredPasteIdx === i && (
                                        <div className={styles.pasteTooltip}>
                                            🖊 Paste at {formatTime(p.t)} — {p.len} chars{'\n'}
                                            {p.text.slice(0, 180)}{p.text.length > 180 ? '…' : ''}
                                        </div>
                                    )}
                                </div>
                            )
                        })}

                        <input
                            type="range"
                            className={styles.scrubberInput}
                            min={0}
                            max={duration}
                            step={50}
                            value={currentTime}
                            onChange={handleScrubberChange}
                            onMouseDown={() => {
                                if (isPlaying) {
                                    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
                                    lastRafTimeRef.current = null
                                    setIsPlaying(false)
                                }
                            }}
                        />
                    </div>
                </div>

                {/* Controls */}
                <div className={styles.controls}>
                    <button
                        className={styles.playBtn}
                        onClick={handlePlayPause}
                        title={isPlaying ? 'Pause' : 'Play'}
                    >
                        {isPlaying ? (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="4" width="4" height="16" />
                                <rect x="14" y="4" width="4" height="16" />
                            </svg>
                        ) : (
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <polygon points="5,3 19,12 5,21" />
                            </svg>
                        )}
                    </button>

                    <div className={styles.speedGroup}>
                        {SPEED_OPTIONS.map((s) => (
                            <button
                                key={s}
                                className={`${styles.speedBtn} ${speed === s ? styles.speedBtnActive : ''}`}
                                onClick={() => setSpeed(s)}
                            >
                                {s}×
                            </button>
                        ))}
                    </div>

                    {/* Jump-to-anomaly buttons */}
                    {log.pastes.map((p, i) => (
                        <button
                            key={i}
                            className={styles.jumpBtn}
                            onClick={() => jumpTo(p.t)}
                            title={`Jump to paste at ${formatTime(p.t)}`}
                        >
                            🟠 Paste {i + 1} @ {formatTime(p.t)}
                        </button>
                    ))}
                </div>
            </div>

            {/* ── Suspicious activity banner ────────────────────────── */}
            {isSuspicious && (
                <div
                    className={`${styles.suspiciousBanner} ${stats.suspiciousPasteCount > 0 ? '' : styles.suspiciousBannerOrange
                        }`}
                >
                    <span className={styles.suspiciousIcon}>
                        {stats.suspiciousPasteCount > 0 ? '🔴' : '🟡'}
                    </span>

                    <div>
                        <span
                            className={`${styles.suspiciousText} ${stats.suspiciousPasteCount > 0
                                    ? ''
                                    : styles.suspiciousTextOrange
                                }`}
                        >
                            {stats.suspiciousPasteCount > 0
                                ? `Suspicious activity detected — ${stats.suspiciousPasteCount} large paste${stats.suspiciousPasteCount !== 1 ? 's' : ''} found`
                                : `Elevated risk — ${log.tabSwitches} tab switch${log.tabSwitches !== 1 ? 'es' : ''} during session`}
                        </span>
                    </div>

                    <div className={styles.suspiciousFlags}>
                        {stats.suspiciousPasteCount > 0 && (
                            <span className={`${styles.suspiciousFlag} ${styles.flagRed}`}>
                                Large Paste ×{stats.suspiciousPasteCount}
                            </span>
                        )}
                        {log.tabSwitches >= 3 && (
                            <span className={`${styles.suspiciousFlag} ${styles.flagYellow}`}>
                                Tab Switches ×{log.tabSwitches}
                            </span>
                        )}
                        {log.tabSwitches >= 5 && (
                            <span className={`${styles.suspiciousFlag} ${styles.flagOrange}`}>
                                Submission Blocked
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    )
}
