'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    studentApi,
    submissionsApi,
    socraticApi,
    type StudentAssignment,
    type SubmissionResult,
    type SocraticScoreResult,
} from '@/lib/api'
import styles from './assignment.module.css'
import { toast } from 'sonner'

interface BehaviorTracker {
    typingEvents: Array<{ t: number; type: string }>
    pasteEvents: Array<{ t: number; len: number }>
    largestPaste: number
    tabSwitches: number
    idleTime: number
    lastKeyTime: number | null
}

const difficultyStyle: Record<string, string> = {
    easy: styles.diffEasy,
    medium: styles.diffMedium,
    hard: styles.diffHard,
}

export default function AssignmentWorkspace({
    classroomAssignmentId,
    token,
}: {
    classroomAssignmentId: string
    token: string
}) {
    const router = useRouter()
    const [assignment, setAssignment] = useState<StudentAssignment | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [essay, setEssay] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submission, setSubmission] = useState<SubmissionResult | null>(null)
    const [challenge, setChallenge] = useState<string | null>(null)
    const [isLoadingChallenge, setIsLoadingChallenge] = useState(false)
    const [socraticResponse, setSocraticResponse] = useState('')
    const [isScoringResponse, setIsScoringResponse] = useState(false)
    const [finalScore, setFinalScore] = useState<SocraticScoreResult | null>(null)

    const behaviorRef = useRef<BehaviorTracker>({
        typingEvents: [],
        pasteEvents: [],
        largestPaste: 0,
        tabSwitches: 0,
        idleTime: 0,
        lastKeyTime: null,
    })

    // Load the student's distributed variant
    useEffect(() => {
        const load = async () => {
            try {
                const res = await studentApi.getMyAssignmentVariant(classroomAssignmentId, token)
                setAssignment(res.data ?? null)
            } catch (error) {
                console.error('Failed to load assignment:', error)
                toast.error('Failed to load assignment')
            } finally {
                setIsLoading(false)
            }
        }
        load()
    }, [classroomAssignmentId, token])

    // Track tab switches
    useEffect(() => {
        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                behaviorRef.current.tabSwitches++
            }
        }
        document.addEventListener('visibilitychange', onVisibilityChange)
        return () => document.removeEventListener('visibilitychange', onVisibilityChange)
    }, [])

    const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        const now = Date.now()
        const tracker = behaviorRef.current
        if (tracker.lastKeyTime !== null) {
            const gap = now - tracker.lastKeyTime
            if (gap > 3000) tracker.idleTime += gap
        }
        tracker.lastKeyTime = now
        tracker.typingEvents.push({ t: now, type: e.key.length === 1 ? 'char' : 'ctrl' })
    }, [])

    const handlePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const text = e.clipboardData.getData('text')
        const len = text.length
        const tracker = behaviorRef.current
        tracker.pasteEvents.push({ t: Date.now(), len })
        if (len > tracker.largestPaste) tracker.largestPaste = len
    }, [])

    const handleSubmit = async () => {
        if (!assignment || essay.trim().length < 50 || isSubmitting) return

        setIsSubmitting(true)
        try {
            const res = await submissionsApi.create(
                { assignment_id: assignment.id, essay_text: essay },
                token,
            )
            if (!res.data) throw new Error('Submission failed')
            const sub = res.data
            setSubmission(sub)

            // Log behavioral telemetry (non-critical, fire and forget)
            if (assignment.enable_behavioral) {
                const tracker = behaviorRef.current
                submissionsApi.logBehavior(
                    {
                        submission_id: sub.id,
                        typing_events: tracker.typingEvents,
                        paste_events: tracker.pasteEvents,
                        largest_paste: tracker.largestPaste,
                        tab_switches: tracker.tabSwitches,
                        idle_time: Math.round(tracker.idleTime / 1000),
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

    // ── Loading state ──────────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className={styles.stateBox}>
                <div className={styles.spinner} />
                <p className={styles.stateText}>Loading assignment…</p>
            </div>
        )
    }

    // ── Not distributed yet ────────────────────────────────────────────────────

    if (!assignment) {
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

    // ── Main workspace ─────────────────────────────────────────────────────────

    return (
        <div className={styles.workspace}>
            {/* Assignment prompt card */}
            <div className={styles.promptCard}>
                <div className={styles.promptMeta}>
                    {assignment.difficulty && (
                        <span className={`${styles.badge} ${difficultyStyle[assignment.difficulty] ?? ''}`}>
                            {assignment.difficulty}
                        </span>
                    )}
                    <span className={styles.badge}>{assignment.mode}</span>
                </div>
                {assignment.topic && (
                    <h1 className={styles.promptTitle}>{assignment.topic}</h1>
                )}
                <p className={styles.promptText}>{assignment.assignment_text}</p>
            </div>

            {/* Essay editor — hidden after submission */}
            {!submission && (
                <div className={styles.editorSection}>
                    <div className={styles.editorHeader}>
                        <span className={styles.editorLabel}>Your Response</span>
                        <span className={styles.wordCount}>{wordCount} words</span>
                    </div>
                    <textarea
                        className={styles.editor}
                        value={essay}
                        onChange={(e) => setEssay(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onPaste={handlePaste}
                        placeholder="Write your response here. Minimum 50 characters."
                        rows={16}
                        disabled={isSubmitting}
                    />
                    <div className={styles.editorFooter}>
                        <p className={styles.editorHint}>
                            Your response is monitored for academic integrity. Write in your own words.
                        </p>
                        <button
                            className={styles.submitBtn}
                            onClick={handleSubmit}
                            disabled={isSubmitting || essay.trim().length < 50}
                        >
                            {isSubmitting ? 'Submitting…' : 'Submit Response'}
                        </button>
                    </div>
                </div>
            )}

            {/* Post-submission panel */}
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
                        {submission.honeypot_score !== null && (
                            <div className={styles.scoreChip}>
                                <span className={styles.scoreChipLabel}>Authenticity</span>
                                <span className={styles.scoreChipValue}>
                                    {submission.honeypot_score.toFixed(1)}
                                </span>
                            </div>
                        )}
                    </div>

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
                                            {socraticResponse.trim() ? socraticResponse.trim().split(/\s+/).length : 0} words
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
                                            disabled={isScoringResponse || socraticResponse.trim().length < 20}
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
                                        <span className={styles.scoreRowValue}>{finalScore.socratic_score.toFixed(1)}</span>
                                    </div>
                                    <div className={`${styles.scoreRow} ${styles.ownershipRow}`}>
                                        <span className={styles.scoreRowLabel}>Overall Ownership Score</span>
                                        <span className={styles.scoreRowValue}>{finalScore.ownership_score.toFixed(1)}</span>
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
