'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    studentApi,
    submissionsApi,
    socraticApi,
    snapshotsApi,
    type StudentAssignment,
    type SubmissionResult,
    type SocraticScoreResult,
} from '@/lib/api'
import { useDiffRecorder } from '@/lib/useDiffRecorder'
import type { ReplayLog } from '@/lib/replayEngine'
import styles from './assignment.module.css'
import replayStyles from '@/components/ui/replay.module.css'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'

// Lazy-load the playback viewer (heavy — only needed post-submit)
const CodePlayback = dynamic(() => import('@/components/ui/CodePlayback'), { ssr: false })

// ─── Constants ─────────────────────────────────────────────────────────────────

const TAB_SWITCH_WARNING_THRESHOLD = 3
const TAB_SWITCH_BLOCK_THRESHOLD = 5

// ─── Difficulty styling ────────────────────────────────────────────────────────

const difficultyStyle: Record<string, string> = {
    easy: styles.diffEasy,
    medium: styles.diffMedium,
    hard: styles.diffHard,
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function AssignmentWorkspace({
    classroomAssignmentId,
    token,
}: {
    classroomAssignmentId: string
    token: string
}) {
    const router = useRouter()

    // ── Core state ──────────────────────────────────────────────────────────
    const [assignment, setAssignment] = useState<StudentAssignment | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [loadError, setLoadError] = useState(false)
    const [essay, setEssay] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submission, setSubmission] = useState<SubmissionResult | null>(null)
    const [replayLog, setReplayLog] = useState<ReplayLog | null>(null)

    // ── Socratic state ──────────────────────────────────────────────────────
    const [challenge, setChallenge] = useState<string | null>(null)
    const [isLoadingChallenge, setIsLoadingChallenge] = useState(false)
    const [socraticResponse, setSocraticResponse] = useState('')
    const [isScoringResponse, setIsScoringResponse] = useState(false)
    const [finalScore, setFinalScore] = useState<SocraticScoreResult | null>(null)

    // ── Anti-cheat / proctoring state ───────────────────────────────────────
    const [tabSwitchCount, setTabSwitchCount] = useState(0)
    const [showWarningOverlay, setShowWarningOverlay] = useState(false)
    const [isSubmissionBlocked, setIsSubmissionBlocked] = useState(false)
    const [showWarningBanner, setShowWarningBanner] = useState(false)
    const [bannerDismissed, setBannerDismissed] = useState(false)
    const tabSwitchCountRef = useRef(0) // authoritative for closures

    // ── Recording hook ──────────────────────────────────────────────────────
    const {
        initLog,
        recordTextChange,
        recordPaste,
        recordTabSwitch,
        finalise,
        getUnflushedSnapshots,
    } = useDiffRecorder()

    const isProactive = assignment?.mode === 'proactive'

    // ─── Load assignment ─────────────────────────────────────────────────────

    useEffect(() => {
        const load = async () => {
            setLoadError(false)
            try {
                const res = await studentApi.getMyAssignmentVariant(classroomAssignmentId, token)
                const data = res.data ?? null
                setAssignment(data)
                if (data) {
                    // Seed recorder with empty string (proactive text assignments start blank)
                    initLog('')
                }
            } catch (error) {
                console.error('Failed to load assignment:', error)
                setLoadError(true)
                toast.error('Failed to load assignment')
            } finally {
                setIsLoading(false)
            }
        }
        load()
    }, [classroomAssignmentId, token, initLog])

    // ─── Anti-cheat hooks (proactive mode only) ──────────────────────────────

    useEffect(() => {
        if (!isProactive) return

        // Visibility change — fired when user switches tabs or minimises window
        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                tabSwitchCountRef.current++
                const count = tabSwitchCountRef.current
                setTabSwitchCount(count)
                recordTabSwitch()

                if (count >= TAB_SWITCH_BLOCK_THRESHOLD) {
                    setIsSubmissionBlocked(true)
                    setShowWarningOverlay(true)
                } else if (count >= TAB_SWITCH_WARNING_THRESHOLD) {
                    setShowWarningOverlay(true)
                }
            } else {
                // Returned to tab — show banner instead of full overlay
                if (
                    tabSwitchCountRef.current >= TAB_SWITCH_WARNING_THRESHOLD &&
                    tabSwitchCountRef.current < TAB_SWITCH_BLOCK_THRESHOLD &&
                    !bannerDismissed
                ) {
                    setShowWarningBanner(true)
                }
            }
        }

        // Window blur — catches switching to a different app
        const onBlur = () => {
            if (document.visibilityState === 'visible') {
                // Only count once (visibilitychange already fires on tab switch)
                // This catches alt-tab without hiding the tab
                tabSwitchCountRef.current++
                const count = tabSwitchCountRef.current
                setTabSwitchCount(count)
                recordTabSwitch()

                if (count >= TAB_SWITCH_BLOCK_THRESHOLD) {
                    setIsSubmissionBlocked(true)
                    setShowWarningOverlay(true)
                } else if (count >= TAB_SWITCH_WARNING_THRESHOLD && !bannerDismissed) {
                    setShowWarningBanner(true)
                }
            }
        }

        document.addEventListener('visibilitychange', onVisibilityChange)
        window.addEventListener('blur', onBlur)

        return () => {
            document.removeEventListener('visibilitychange', onVisibilityChange)
            window.removeEventListener('blur', onBlur)
        }
    }, [isProactive, bannerDismissed, recordTabSwitch])

    // ─── Periodic snapshot flush (every 30s) ─────────────────────────────────

    useEffect(() => {
        if (!assignment || !isProactive || !assignment.enable_behavioral) return

        const flushInterval = setInterval(async () => {
            const newSnapshots = getUnflushedSnapshots()
            if (newSnapshots.length === 0) return
            snapshotsApi.push(assignment.id, newSnapshots, token).catch(() => {
                // Non-critical — data is also saved at submit time
            })
        }, 30_000)

        return () => clearInterval(flushInterval)
    }, [assignment, isProactive, token, getUnflushedSnapshots])

    // ─── Block clipboard & right-click (proactive mode only) ─────────────────

    useEffect(() => {
        if (!isProactive || submission) return

        const preventDefault = (e: Event) => {
            e.preventDefault()
            toast.error('Clipboard access is disabled during this monitored assignment.', {
                id: 'clipboard-blocked',
                duration: 2000,
            })
        }

        const blockRightClick = (e: Event) => {
            e.preventDefault()
        }

        document.addEventListener('copy', preventDefault)
        document.addEventListener('cut', preventDefault)
        document.addEventListener('contextmenu', blockRightClick)

        // Allow paste but record it (we intercept in handlePaste)
        return () => {
            document.removeEventListener('copy', preventDefault)
            document.removeEventListener('cut', preventDefault)
            document.removeEventListener('contextmenu', blockRightClick)
        }
    }, [isProactive, submission])

    // ─── Text editor handlers ────────────────────────────────────────────────

    const handleEssayChange = useCallback(
        (e: React.ChangeEvent<HTMLTextAreaElement>) => {
            const newValue = e.target.value
            setEssay(newValue)
            if (isProactive) {
                recordTextChange(newValue)
            }
        },
        [isProactive, recordTextChange],
    )

    const handlePaste = useCallback(
        (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
            if (!isProactive) return
            const text = e.clipboardData.getData('text')
            recordPaste(text)
            // Note: we do NOT preventDefault here — paste is allowed, just recorded
        },
        [isProactive, recordPaste],
    )

    // ─── Submit ──────────────────────────────────────────────────────────────

    const handleSubmit = async () => {
        if (!assignment || essay.trim().length < 50 || isSubmitting) return
        if (isSubmissionBlocked) {
            toast.error('Submission is blocked due to excessive tab switching.')
            return
        }

        setIsSubmitting(true)
        try {
            // Finalise the replay log before submission
            let log: ReplayLog | undefined
            if (isProactive && assignment.enable_behavioral) {
                log = finalise(essay)
                setReplayLog(log)
            }

            const res = await submissionsApi.create(
                {
                    assignment_id: assignment.id,
                    essay_text: essay,
                    replay_log: log ? JSON.stringify(log) : undefined,
                },
                token,
            )
            if (!res.data) throw new Error('Submission failed')
            const sub = res.data
            setSubmission(sub)

            // Flush any remaining snapshots and link them to the submission
            if (isProactive && assignment.enable_behavioral) {
                const remaining = getUnflushedSnapshots()
                if (remaining.length > 0) {
                    await snapshotsApi.push(assignment.id, remaining, token).catch(() => {})
                }
                snapshotsApi.link(assignment.id, sub.id, token).catch(() => {})
            }

            // Log behavioral telemetry (non-critical, fire and forget)
            if (isProactive && assignment.enable_behavioral && log) {
                submissionsApi.logBehavior(
                    {
                        submission_id: sub.id,
                        typing_events: [],
                        paste_events: log.pastes.map((p) => ({
                            t: p.t,
                            len: p.len,
                        })),
                        largest_paste: log.pastes.reduce((m, p) => Math.max(m, p.len), 0),
                        tab_switches: log.tabSwitches,
                        idle_time: log.idleTime ?? 0,
                    },
                    token,
                ).catch(() => { /* non-critical */ })
            }

            // Trigger Socratic challenge if enabled
            if (assignment.enable_socratic) {
                setIsLoadingChallenge(true)
                try {
                    const cRes = await socraticApi.getChallenge(sub.id, token)
                    if (cRes.data) setChallenge(cRes.data.challenge)
                } catch {
                    toast.error('Could not generate Socratic challenge')
                } finally {
                    setIsLoadingChallenge(false)
                }
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Submission failed')
        } finally {
            setIsSubmitting(false)
        }
    }

    // ─── Socratic submit ─────────────────────────────────────────────────────

    const handleSocraticSubmit = async () => {
        if (!submission || socraticResponse.trim().length < 20 || isScoringResponse) return

        setIsScoringResponse(true)
        try {
            const res = await socraticApi.scoreResponse(
                { submission_id: submission.id, student_response: socraticResponse },
                token,
            )
            if (res.data) setFinalScore(res.data)
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to score response')
        } finally {
            setIsScoringResponse(false)
        }
    }

    const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0

    // ─── Loading state ───────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className={styles.synthesizingBox}>
                <div className={styles.aiPulse}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                    </svg>
                </div>
                <div className={styles.loadingSteps}>
                    <div className={styles.loadingStep}>Synthesizing Assignment</div>
                    <p className={styles.loadingSub}>
                        Gererating your unique academic variant and embedding integrity-protection signatures.
                    </p>
                </div>
                <div className={styles.spinner} style={{ marginTop: '1rem', width: '20px', height: '20px' }} />
            </div>
        )
    }

    // ─── Not distributed yet / load error ────────────────────────────────────

    if (!assignment) {
        if (loadError) {
            return (
                <div className={styles.stateBox}>
                    <div className={styles.stateIcon}>⚠️</div>
                    <h2 className={styles.stateTitle}>Failed to Load Assignment</h2>
                    <p className={styles.stateText}>
                        Something went wrong while generating your assignment. This can happen if the AI service is temporarily unavailable. Please try again.
                    </p>
                    <button
                        className={styles.backBtn}
                        onClick={() => {
                            setIsLoading(true)
                            setLoadError(false)
                            studentApi.getMyAssignmentVariant(classroomAssignmentId, token)
                                .then((res) => {
                                    const data = res.data ?? null
                                    setAssignment(data)
                                    if (data) initLog('')
                                    if (!data) setLoadError(true)
                                })
                                .catch(() => setLoadError(true))
                                .finally(() => setIsLoading(false))
                        }}
                    >
                        ↺ Try Again
                    </button>
                    <button className={styles.backBtn} style={{ marginTop: '0.5rem', opacity: 0.7 }} onClick={() => router.push('/dashboard')}>
                        ← Back to Dashboard
                    </button>
                </div>
            )
        }
        return (
            <div className={styles.stateBox}>
                <div className={styles.stateIcon}>📋</div>
                <h2 className={styles.stateTitle}>Assignment Not Yet Distributed</h2>
                <p className={styles.stateText}>
                    Your teacher hasn't distributed this assignment to your batch yet. Check back later.
                </p>
                <button className={styles.backBtn} onClick={() => router.push('/dashboard')}>
                    ← Back to Dashboard
                </button>
            </div>
        )
    }

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div className={styles.workspace}>

            {/* ── Tab-switch warning banner ─────────────────────────── */}
            {showWarningBanner && !bannerDismissed && isProactive && (
                <div className={replayStyles.proctoringWarningBanner}>
                    <span>
                        ⚠ Warning: You have left this tab {tabSwitchCount} time{tabSwitchCount !== 1 ? 's' : ''}.
                        {tabSwitchCount < TAB_SWITCH_BLOCK_THRESHOLD
                            ? ` ${TAB_SWITCH_BLOCK_THRESHOLD - tabSwitchCount} more and your submission will be blocked.`
                            : ' Your submission may be blocked.'}
                    </span>
                    <button
                        className={replayStyles.proctoringWarningClose}
                        onClick={() => {
                            setShowWarningBanner(false)
                            setBannerDismissed(true)
                        }}
                    >
                        ✕
                    </button>
                </div>
            )}

            {/* ── Tab-switch overlay (≥3 switches) ─────────────────── */}
            {showWarningOverlay && isProactive && (
                <div className={replayStyles.proctoringOverlay}>
                    {isSubmissionBlocked ? (
                        <>
                            <div className={replayStyles.proctoringIcon}>🚫</div>
                            <h2 className={replayStyles.proctoringTitle}>Submission Blocked</h2>
                            <p className={replayStyles.proctoringBody}>
                                You have left this assignment tab <strong>{tabSwitchCount} times</strong>.
                                Your submission has been permanently blocked due to repeated tab switching.
                                Please contact your teacher.
                            </p>
                            <button
                                className={replayStyles.proctoringBtn}
                                onClick={() => router.push('/dashboard')}
                            >
                                Return to Dashboard
                            </button>
                        </>
                    ) : (
                        <>
                            <div className={replayStyles.proctoringIcon}>⚠️</div>
                            <h2 className={replayStyles.proctoringTitle}>Integrity Warning</h2>
                            <p className={replayStyles.proctoringBody}>
                                You have left this assignment tab <strong>{tabSwitchCount} times</strong>.
                                This assignment is being monitored for academic integrity.
                                {TAB_SWITCH_BLOCK_THRESHOLD - tabSwitchCount} more tab switch{TAB_SWITCH_BLOCK_THRESHOLD - tabSwitchCount !== 1 ? 'es' : ''} will permanently block your submission.
                            </p>
                            <button
                                className={replayStyles.proctoringBtn}
                                onClick={() => {
                                    setShowWarningOverlay(false)
                                    setShowWarningBanner(false)
                                    setBannerDismissed(true)
                                }}
                            >
                                I Understand — Return to Assignment
                            </button>
                        </>
                    )}
                </div>
            )}

            {/* ── Assignment prompt card ────────────────────────────── */}
            <div className={styles.promptCard}>
                <div className={styles.promptMeta}>
                    {assignment.difficulty && (
                        <span className={`${styles.badge} ${difficultyStyle[assignment.difficulty] ?? ''}`}>
                            {assignment.difficulty}
                        </span>
                    )}
                    <span className={styles.badge}>{assignment.mode}</span>
                    {isProactive && (
                        <span
                            className={styles.badge}
                            style={{ background: '#eef8f7', color: '#1a8c82' }}
                        >
                            🔒 Proctored
                        </span>
                    )}
                    {isProactive && tabSwitchCount > 0 && (
                        <span className={replayStyles.tabSwitchCounter}>
                            ⚠ {tabSwitchCount} tab switch{tabSwitchCount !== 1 ? 'es' : ''}
                        </span>
                    )}
                </div>
                {assignment.topic && (
                    <h1 className={styles.promptTitle}>{assignment.topic}</h1>
                )}
                <p className={styles.promptText}>{assignment.assignment_text}</p>
            </div>

            {/* ── Essay editor — hidden after submission ─────────────── */}
            {!submission && (
                <div className={styles.editorSection}>
                    <div className={styles.editorHeader}>
                        <span className={styles.editorLabel}>Your Response</span>
                        <span className={styles.wordCount}>{wordCount} words</span>
                    </div>
                    <textarea
                        className={styles.editor}
                        value={essay}
                        onChange={handleEssayChange}
                        onPaste={handlePaste}
                        placeholder={
                            isProactive
                                ? 'Write your response here. This session is monitored — pasting and tab-switching are logged.'
                                : 'Write your response here. Minimum 50 characters.'
                        }
                        rows={16}
                        disabled={isSubmitting || isSubmissionBlocked}
                        spellCheck={true}
                        autoComplete="off"
                        autoCorrect="off"
                    />
                    <div className={styles.editorFooter}>
                        <p className={styles.editorHint}>
                            {isProactive
                                ? '🔒 This session is fully proctored. Keystroke timing, paste events, and tab-switching are recorded for integrity verification.'
                                : 'Your response is monitored for academic integrity. Write in your own words.'}
                        </p>
                        <button
                            className={styles.submitBtn}
                            onClick={handleSubmit}
                            disabled={
                                isSubmitting ||
                                essay.trim().length < 50 ||
                                isSubmissionBlocked
                            }
                        >
                            {isSubmitting
                                ? 'Submitting…'
                                : isSubmissionBlocked
                                    ? 'Submission Blocked'
                                    : 'Submit Response'}
                        </button>
                    </div>
                </div>
            )}

            {/* ── Post-submission panel ─────────────────────────────── */}
            {submission && (
                <div className={styles.feedbackPanel}>
                    <div className={styles.submittedBanner}>
                        <span className={styles.submittedIcon}>✓</span>
                        <div>
                            <div className={styles.submittedTitle}>Response Submitted</div>
                            <div className={styles.submittedSub}>
                                Your response has been recorded and is being evaluated.
                            </div>
                        </div>
                        {submission.honeypot_score !== null && submission.honeypot_score !== undefined && (
                            <div className={styles.scoreChip}>
                                <span className={styles.scoreChipLabel}>Authenticity</span>
                                <span className={styles.scoreChipValue}>
                                    {submission.honeypot_score.toFixed(1)}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* WritingDNA Replay (student view — simple playback) */}
                    {isProactive && replayLog && (
                        <div>
                            <div
                                style={{
                                    fontFamily: 'var(--font-display)',
                                    fontSize: '0.72rem',
                                    fontWeight: 700,
                                    letterSpacing: '0.2em',
                                    textTransform: 'uppercase',
                                    color: 'var(--muted)',
                                    marginBottom: '0.75rem',
                                }}
                            >
                                Your WritingDNA Replay
                            </div>
                            <CodePlayback
                                log={replayLog}
                                isTextMode={true}
                                title="Your Session Replay"
                            />
                        </div>
                    )}

                    {/* Socratic challenge section */}
                    {assignment.enable_socratic && (
                        <div className={styles.socraticSection}>
                            <div className={styles.socraticHeader}>
                                <span className={styles.socraticTag}>Socratic Challenge</span>
                                <h2 className={styles.socraticTitle}>Demonstrate Your Understanding</h2>
                                <p className={styles.socraticSubtitle}>
                                    Answer the question below to verify you understand what you wrote.
                                </p>
                            </div>

                            {isLoadingChallenge && (
                                <div className={styles.challengeLoading}>
                                    <div className={styles.spinner} />
                                    <span>Generating challenge question…</span>
                                </div>
                            )}

                            {challenge && !finalScore && (
                                <>
                                    <div className={styles.challengeBox}>
                                        <p className={styles.challengeText}>{challenge}</p>
                                    </div>
                                    <div className={styles.editorHeader}>
                                        <span className={styles.editorLabel}>Your Answer</span>
                                        <span className={styles.wordCount}>
                                            {socraticResponse.trim()
                                                ? socraticResponse.trim().split(/\s+/).length
                                                : 0}{' '}
                                            words
                                        </span>
                                    </div>
                                    <textarea
                                        className={styles.editor}
                                        value={socraticResponse}
                                        onChange={(e) => setSocraticResponse(e.target.value)}
                                        placeholder="Respond to the challenge in your own words…"
                                        rows={8}
                                        disabled={isScoringResponse}
                                    />
                                    <div className={styles.editorFooter}>
                                        <span />
                                        <button
                                            className={styles.submitBtn}
                                            onClick={handleSocraticSubmit}
                                            disabled={
                                                isScoringResponse ||
                                                socraticResponse.trim().length < 20
                                            }
                                        >
                                            {isScoringResponse ? 'Evaluating…' : 'Submit Answer'}
                                        </button>
                                    </div>
                                </>
                            )}

                            {finalScore && (
                                <div className={styles.finalScores}>
                                    <div className={styles.scoreRow}>
                                        <span className={styles.scoreRowLabel}>Socratic Score</span>
                                        <span className={styles.scoreRowValue}>
                                            {finalScore.socratic_score.toFixed(1)}
                                        </span>
                                    </div>
                                    <div className={`${styles.scoreRow} ${styles.ownershipRow}`}>
                                        <span className={styles.scoreRowLabel}>Overall Ownership Score</span>
                                        <span className={styles.scoreRowValue}>
                                            {finalScore.ownership_score.toFixed(1)}
                                        </span>
                                    </div>
                                    <p className={styles.analysisText}>{finalScore.analysis}</p>
                                    {finalScore.followup && (
                                        <div className={styles.followupBox}>
                                            <span className={styles.followupLabel}>Follow-up Question</span>
                                            <p className={styles.followupText}>{finalScore.followup}</p>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
