'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import {
    getCodeAtTime,
    formatTime,
    computeReplayStats,
    type ReplayLog,
} from '@/lib/replayEngine'
import styles from './replay.module.css'

// ─── Speed Options ────────────────────────────────────────────────────────────

const SPEED_OPTIONS = [0.5, 1, 2, 4, 8]
const TICK_MS = 80 // update every 80ms

// ─── Props ────────────────────────────────────────────────────────────────────

interface CodePlaybackProps {
    /** The parsed ReplayLog from the submission */
    log: ReplayLog
    /** Whether this is a text assignment (affects editor font) */
    isTextMode?: boolean
    /** Optional title shown in toolbar */
    title?: string
}

// ─── Student Playback component ───────────────────────────────────────────────

/**
 * CodePlayback — Simple WritingDNA replay viewer for students.
 *
 * Snaps to the nearest snapshot on every tick (no smooth interpolation).
 * Tick loop uses a ref (timeRef) to avoid React closure staleness.
 */
export default function CodePlayback({
    log,
    isTextMode = false,
    title = 'WritingDNA Replay',
}: CodePlaybackProps) {
    const [currentTime, setCurrentTime] = useState(0)
    const [isPlaying, setIsPlaying] = useState(false)
    const [speed, setSpeed] = useState(1)
    const [hoveredPasteIdx, setHoveredPasteIdx] = useState<number | null>(null)

    const timeRef = useRef(0)
    const animFrameRef = useRef<number | null>(null)
    const lastRafTimeRef = useRef<number | null>(null)
    const duration = log.totalDuration || 1

    const stats = computeReplayStats(log)

    // ── Tick loop ──────────────────────────────────────────────────────────

    const tick = useCallback(
        (rafNow: number) => {
            if (lastRafTimeRef.current === null) {
                lastRafTimeRef.current = rafNow
            }
            const elapsed = (rafNow - lastRafTimeRef.current) * speed
            lastRafTimeRef.current = rafNow

            timeRef.current = Math.min(timeRef.current + elapsed, duration)
            setCurrentTime(timeRef.current)

            if (timeRef.current < duration) {
                animFrameRef.current = requestAnimationFrame(tick)
            } else {
                setIsPlaying(false)
            }
        },
        [speed, duration],
    )

    // ── Play / Pause ───────────────────────────────────────────────────────

    const handlePlayPause = useCallback(() => {
        setIsPlaying((prev) => {
            if (prev) {
                // Pause
                if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
                lastRafTimeRef.current = null
                return false
            } else {
                // Play — reset to start if at end
                if (timeRef.current >= duration) {
                    timeRef.current = 0
                    setCurrentTime(0)
                }
                lastRafTimeRef.current = null
                animFrameRef.current = requestAnimationFrame(tick)
                return true
            }
        })
    }, [tick, duration])

    // Re-create tick loop when speed changes while playing
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

    // ── Scrubber seek ──────────────────────────────────────────────────────

    const handleScrubberChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const t = Number(e.target.value)
            timeRef.current = t
            setCurrentTime(t)
        },
        [],
    )

    // ── Derived display ────────────────────────────────────────────────────

    const displayCode = getCodeAtTime(log.snapshots, currentTime)
    const fillPercent = duration > 0 ? (currentTime / duration) * 100 : 0

    if (!log.snapshots || log.snapshots.length === 0) {
        return (
            <div className={`${styles.replayShell} ${styles.studentShell}`}>
                <div className={styles.emptyState}>
                    <div className={styles.emptyIcon}>📼</div>
                    <div>No replay data available</div>
                </div>
            </div>
        )
    }

    return (
        <div className={`${styles.replayShell} ${styles.studentShell}`}>
            {/* ── Toolbar ─────────────────────────────────────────── */}
            <div className={styles.toolbar}>
                <span className={styles.toolbarTitle}>{title}</span>

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
                        {log.pastes.length} paste{log.pastes.length !== 1 ? 's' : ''}
                    </span>
                )}
                {log.tabSwitches > 0 && (
                    <span className={`${styles.statBadge} ${styles.statBadgeYellow}`}>
                        {log.tabSwitches} tab switch{log.tabSwitches !== 1 ? 'es' : ''}
                    </span>
                )}
            </div>

            {/* ── Editor display ───────────────────────────────────── */}
            <div className={styles.editorArea}>
                <pre
                    className={`${styles.editorContent} ${isTextMode ? styles.editorContentText : ''}`}
                >
                    {displayCode}
                </pre>
            </div>

            {/* ── Timeline ─────────────────────────────────────────── */}
            <div className={styles.timeline}>
                <div className={styles.timeRow}>
                    <span className={styles.timeLabel}>
                        {formatTime(currentTime)} / {formatTime(duration)}
                    </span>

                    {/* Scrubber */}
                    <div className={styles.scrubberWrap}>
                        <div className={styles.scrubberTrack} />
                        <div
                            className={styles.scrubberFill}
                            style={{ width: `${fillPercent}%` }}
                        />

                        {/* Paste markers */}
                        {log.pastes.map((p, i) => {
                            const leftPct = duration > 0 ? (p.t / duration) * 100 : 0
                            return (
                                <div
                                    key={i}
                                    className={styles.pasteMarker}
                                    style={{ left: `calc(${leftPct}% - 4px)` }}
                                    onMouseEnter={() => setHoveredPasteIdx(i)}
                                    onMouseLeave={() => setHoveredPasteIdx(null)}
                                    onClick={() => {
                                        timeRef.current = p.t
                                        setCurrentTime(p.t)
                                    }}
                                    title="Paste detected"
                                >
                                    {hoveredPasteIdx === i && (
                                        <div className={styles.pasteTooltip}>
                                            🖊 Paste at {formatTime(p.t)}
                                            {'\n'}
                                            {p.text.slice(0, 120)}{p.text.length > 120 ? '…' : ''}
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
                            step={100}
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
                            // Pause icon
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <rect x="6" y="4" width="4" height="16" />
                                <rect x="14" y="4" width="4" height="16" />
                            </svg>
                        ) : (
                            // Play icon
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

                    {/* Jump to first paste */}
                    {log.pastes.length > 0 && (
                        <button
                            className={styles.jumpBtn}
                            onClick={() => {
                                timeRef.current = log.pastes[0].t
                                setCurrentTime(log.pastes[0].t)
                            }}
                        >
                            ⚡ Jump to Paste
                        </button>
                    )}
                </div>
            </div>
        </div>
    )
}
