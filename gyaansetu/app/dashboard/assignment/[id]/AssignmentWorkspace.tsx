'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import {
    studentApi,
    reactiveApi,
    submissionsApi,
    socraticApi,
    type StudentAssignment,
    type SubmissionResult,
    type SocraticScoreResult,
    type ReactiveSubmissionStatus,
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

const SOCRATIC_TIME_LIMIT = 180 // 3 minutes in seconds

function SocraticTimer({
    onExpire,
    isActive,
    startedAt,
    timeLimit = 180
}: {
    onExpire: () => void,
    isActive: boolean,
    startedAt: string | null,
    timeLimit?: number
}) {
    const [timeLeft, setTimeLeft] = useState(timeLimit)
    const timerRef = useRef<NodeJS.Timeout | null>(null)
    const onExpireRef = useRef(onExpire)
    const localStartRef = useRef<number | null>(null)

    useEffect(() => {
        onExpireRef.current = onExpire
    }, [onExpire])

    useEffect(() => {
        if (!isActive) {
            if (timerRef.current) clearInterval(timerRef.current)
            setTimeLeft(timeLimit)
            localStartRef.current = null
            return
        }

        // Determine the anchor point for the countdown
        let anchorTime: number;
        if (startedAt) {
            // Robust Date Parsing
            let startStr = startedAt.replace(' ', 'T')
            if (!startStr.includes('Z') && !startStr.includes('+')) {
                startStr += 'Z'
            }
            const parsed = new Date(startStr).getTime()
            if (isNaN(parsed)) {
                console.error('Invalid startedAt, falling back to local start')
                if (!localStartRef.current) localStartRef.current = Date.now()
                anchorTime = localStartRef.current
            } else {
                anchorTime = parsed
            }
        } else {
            // If no server time provided, use local once
            if (!localStartRef.current) localStartRef.current = Date.now()
            anchorTime = localStartRef.current
        }

        const runTick = () => {
            const now = Date.now()
            const elapsed = Math.floor((now - anchorTime) / 1000)
            const remaining = Math.max(0, timeLimit - elapsed)

            setTimeLeft(remaining)

            if (remaining <= 0) {
                if (timerRef.current) clearInterval(timerRef.current)
                onExpireRef.current()
            }
        }

        runTick()
        if (timerRef.current) clearInterval(timerRef.current)
        timerRef.current = setInterval(runTick, 1000)

        return () => {
            if (timerRef.current) clearInterval(timerRef.current)
        }
    }, [isActive, startedAt, timeLimit]) // Stable dependencies

    const formatTime = (seconds: number) => {
        const m = Math.floor(seconds / 60)
        const s = seconds % 60
        return `${m}:${s.toString().padStart(2, '0')}`
    }

    const isUrgent = timeLeft <= 30

    return (
        <div className={`${styles.timer} ${isUrgent ? styles.timerUrgent : ''}`}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
            </svg>
            <span>Time Remaining: {formatTime(timeLeft)}</span>
        </div>
    )
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

    // ── Shared state ────────────────────────────────────────────────────────
    const [isLoading, setIsLoading] = useState(true)
    const [assignmentMode, setAssignmentMode] = useState<'proactive' | 'reactive' | null>(null)
    const [assignmentInfo, setAssignmentInfo] = useState<any>(null)

    // ── Proactive state ─────────────────────────────────────────────────────
    const [assignment, setAssignment] = useState<StudentAssignment | null>(null)
    const [essay, setEssay] = useState('')
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [submission, setSubmission] = useState<SubmissionResult | null>(null)
    // currentChallenge / currentStartedAt always reflect the ACTIVE question (Q1, Q2, or Q3)
    const [currentChallenge, setCurrentChallenge] = useState<string | null>(null)
    const [isLoadingChallenge, setIsLoadingChallenge] = useState(false)
    const [socraticResponse, setSocraticResponse] = useState('')
    const [isScoringResponse, setIsScoringResponse] = useState(false)
    const [finalScore, setFinalScore] = useState<SocraticScoreResult | null>(null)
    const [startedAt, setStartedAt] = useState<string | null>(null)
    const [timeLimit, setTimeLimit] = useState<number>(180)
    const [pasteViolations, setPasteViolations] = useState(0)

    // ── Reactive state ──────────────────────────────────────────────────────
    const [reactiveStatus, setReactiveStatus] = useState<ReactiveSubmissionStatus | null>(null)
    const [isUploading, setIsUploading] = useState(false)
    // currentReactiveChallenge / currentReactiveStartedAt always reflect the ACTIVE question
    const [currentReactiveChallenge, setCurrentReactiveChallenge] = useState<string | null>(null)
    const [reactiveSubmissionId, setReactiveSubmissionId] = useState<string | null>(null)
    const [reactiveSocraticResponse, setReactiveSocraticResponse] = useState('')
    const [isScoringReactive, setIsScoringReactive] = useState(false)
    const [reactiveFinalScore, setReactiveFinalScore] = useState<{
        socratic_score: number
        analysis: string
        followup: string | null
    } | null>(null)
    const [reactiveStartedAt, setReactiveStartedAt] = useState<string | null>(null)
    const [reactiveTimeLimit, setReactiveTimeLimit] = useState<number>(180)
    const [reactivePasteViolations, setReactivePasteViolations] = useState(0)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // ── Behavior tracking (proactive only) ──────────────────────────────────
    const behaviorRef = useRef<BehaviorTracker>({
        typingEvents: [],
        pasteEvents: [],
        largestPaste: 0,
        tabSwitches: 0,
        idleTime: 0,
        lastKeyTime: null,
    })

    // ── Determine mode and load data ────────────────────────────────────────
    useEffect(() => {
        const load = async () => {
            try {
                // First, fetch the classroom assignment info to determine mode
                let infoRes;
                try {
                    infoRes = await reactiveApi.getAssignment(classroomAssignmentId, token)
                } catch (err: any) {
                    const msg = err.message?.toLowerCase() || ''
                    // Fallback to student-variant API if the direct metadata call fails (e.g. for proactive variants or 404s)
                    if (msg.includes('404') || msg.includes('not found') || msg.includes('reactive metadata')) {
                        console.warn('Reactive metadata fetch failed, falling back to student variant API...', err.message)
                        const res = await studentApi.getMyAssignmentVariant(classroomAssignmentId, token)
                        if (res.data) {
                            setAssignment(res.data)
                            setAssignmentInfo(res.data)
                            setAssignmentMode(res.data.mode)
                            setIsLoading(false)
                            return
                        }
                    }
                    throw err
                }

                const info = infoRes.data
                setAssignmentInfo(info)
                const mode = info?.mode as 'proactive' | 'reactive'
                setAssignmentMode(mode)

                if (mode === 'reactive') {
                    // Check for existing reactive submission
                    const statusRes = await reactiveApi.getMySubmission(classroomAssignmentId, token)
                    if (statusRes.data) {
                        setReactiveStatus(statusRes.data)
                        setReactiveSubmissionId(statusRes.data.submission?.id || null)
                        const soc = statusRes.data.socratic
                        if (soc) {
                            setReactiveTimeLimit(soc.time_limit || 180)
                            setPasteViolations(soc.paste_violations || 0)

                            // Determine which question is currently active (for timer + textarea)
                            if (soc.followup2 && !soc.followup2_response) {
                                // Q3 active
                                setCurrentReactiveChallenge(soc.followup2)
                                setReactiveStartedAt(soc.followup2_started_at)
                            } else if (soc.followup && !soc.followup_response) {
                                // Q2 active
                                setCurrentReactiveChallenge(soc.followup)
                                setReactiveStartedAt(soc.followup_started_at)
                            } else if (!soc.student_response) {
                                // Q1 active
                                setCurrentReactiveChallenge(soc.challenge)
                                setReactiveStartedAt(soc.started_at)
                            } else {
                                // All questions answered — session complete
                                setReactiveFinalScore({
                                    socratic_score: soc.socratic_score ?? 0,
                                    analysis: soc.analysis || '',
                                    followup: null,
                                })
                            }
                        }
                    }
                } else {
                    // Proactive — load the distributed variant
                    const res = await studentApi.getMyAssignmentVariant(classroomAssignmentId, token)
                    const data = res.data as any
                    setAssignment(data ?? null)

                    if (data?.submission) {
                        setSubmission(data.submission)
                        const soc = data.socratic
                        if (soc) {
                            setTimeLimit(soc.time_limit || 180)
                            setPasteViolations(soc.paste_violations || 0)

                            // Determine active question for timer + textarea
                            if (soc.followup2 && !soc.followup2_response) {
                                setCurrentChallenge(soc.followup2)
                                setStartedAt(soc.followup2_started_at)
                            } else if (soc.followup && !soc.followup_response) {
                                setCurrentChallenge(soc.followup)
                                setStartedAt(soc.followup_started_at)
                            } else if (!soc.student_response) {
                                setCurrentChallenge(soc.challenge)
                                setStartedAt(soc.started_at)
                            } else {
                                // Session complete
                                if (data.scores?.socratic_score != null) {
                                    setFinalScore(data.scores)
                                }
                            }
                        }
                    }
                }
            } catch (error) {
                console.error('Failed to load assignment:', error)
                toast.error('Failed to load assignment')
            } finally {
                setIsLoading(false)
            }
        }
        load()
    }, [classroomAssignmentId, token])

    // Track tab switches (proactive)
    useEffect(() => {
        if (assignmentMode !== 'proactive') return
        const onVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                behaviorRef.current.tabSwitches++
            }
        }
        document.addEventListener('visibilitychange', onVisibilityChange)
        return () => document.removeEventListener('visibilitychange', onVisibilityChange)
    }, [assignmentMode])

    // ── Proactive handlers ──────────────────────────────────────────────────

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

            if (assignment.enable_socratic) {
                setIsLoadingChallenge(true)
                try {
                    const cRes = await socraticApi.getChallenge(sub.id, token)
                    if (cRes.data) {
                        setCurrentChallenge(cRes.data.challenge)
                        setStartedAt(cRes.data.started_at)
                        setTimeLimit(cRes.data.time_limit || 180)
                    }
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

    const handleSocraticSubmit = useCallback(async (isTimeout = false) => {
        if (!submission || (socraticResponse.trim().length < 20 && !isTimeout) || isScoringResponse) return

        setIsScoringResponse(true)
        try {
            const res = await socraticApi.scoreResponse(
                { submission_id: submission.id, student_response: socraticResponse || "(No response - timed out)" },
                token,
            )
            if (res.data) {
                if (res.data.followup) {
                    // Another question — advance to next phase
                    setCurrentChallenge(res.data.followup)
                    setStartedAt(res.data.followup_started_at)
                    setSocraticResponse('')
                    toast.info('Good start — one more question to verify your understanding.')
                } else {
                    // All done
                    setFinalScore(res.data)
                    setCurrentChallenge(null)
                }
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to score response')
        } finally {
            setIsScoringResponse(false)
        }
    }, [submission, socraticResponse, isScoringResponse, token])

    // ── Reactive handlers ───────────────────────────────────────────────────

    const handleFileUpload = async (file: File) => {
        setIsUploading(true)
        try {
            toast.info('Uploading and processing your file...')
            const res = await reactiveApi.upload(classroomAssignmentId, file, token)
            if (res.data) {
                setReactiveSubmissionId(res.data.submission_id)
                if (res.data.challenge) {
                    setCurrentReactiveChallenge(res.data.challenge)
                    setReactiveStartedAt(res.data.started_at)
                    setReactiveTimeLimit(res.data.time_limit || 180)
                }
                toast.success(`File "${res.data.filename}" uploaded successfully!`)
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Upload failed')
        } finally {
            setIsUploading(false)
        }
    }

    const handleReactiveSocraticSubmit = useCallback(async (isTimeout = false) => {
        if (!reactiveSubmissionId || (reactiveSocraticResponse.trim().length < 20 && !isTimeout) || isScoringReactive) return

        setIsScoringReactive(true)
        try {
            const res = await reactiveApi.socraticAnswer(
                reactiveSubmissionId,
                reactiveSocraticResponse || "(No response - timed out)",
                token,
            )
            if (res.data) {
                if (res.data.followup) {
                    // Another question — advance to next phase
                    setCurrentReactiveChallenge(res.data.followup)
                    setReactiveStartedAt(res.data.followup_started_at)
                    setReactiveSocraticResponse('')
                    toast.info('Good start — one more question to verify your understanding.')
                } else {
                    setReactiveFinalScore(res.data)
                    setCurrentReactiveChallenge(null)
                    toast.success('Socratic response scored!')
                }
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to score response')
        } finally {
            setIsScoringReactive(false)
        }
    }, [reactiveSubmissionId, reactiveSocraticResponse, isScoringReactive, token])

    const handleSocraticTimeout = useCallback(() => {
        if (reactiveFinalScore || finalScore) return
        toast.error('Time expired! Auto-submitting response.')
        if (assignmentMode === 'reactive') {
            handleReactiveSocraticSubmit(true)
        } else {
            handleSocraticSubmit(true)
        }
    }, [reactiveFinalScore, finalScore, assignmentMode, handleReactiveSocraticSubmit, handleSocraticSubmit])

    const handleSocraticPaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>, submissionId: string | null) => {
        e.preventDefault()
        setPasteViolations(v => v + 1)
        toast.warning('Paste is not allowed during the Socratic challenge. This attempt has been recorded and will affect your score.')
        if (submissionId) {
            socraticApi.pasteViolation(submissionId, token).catch(() => { /* non-critical */ })
        }
    }, [token])

    const handleReactivePaste = useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
        e.preventDefault()
        setReactivePasteViolations(v => v + 1)
        toast.warning('Paste is not allowed during the Socratic challenge. This attempt has been recorded and will affect your score.')
        if (reactiveSubmissionId) {
            socraticApi.pasteViolation(reactiveSubmissionId, token).catch(() => { /* non-critical */ })
        }
    }, [reactiveSubmissionId, token])

    const wordCount = essay.trim() ? essay.trim().split(/\s+/).length : 0

    // ── Loading state ───────────────────────────────────────────────────────

    if (isLoading) {
        return (
            <div className={styles.stateBox}>
                <div className={styles.spinner} />
                <p className={styles.stateText}>Preparing your assignment… this may take a moment.</p>
            </div>
        )
    }

    // ══════════════════════════════════════════════════════════════════════════
    // REACTIVE MODE UI
    // ══════════════════════════════════════════════════════════════════════════

    if (assignmentMode === 'reactive') {
        const hasSubmitted = !!reactiveSubmissionId || !!reactiveStatus?.submission
        const hasSocraticChallenge = !!currentReactiveChallenge
        const hasAnsweredSocratic = !!reactiveFinalScore

        return (
            <div className={styles.workspace}>
                {/* Assignment Info Card */}
                <div className={styles.promptCard}>
                    <div className={styles.promptMeta}>
                        {assignmentInfo?.difficulty && (
                            <span className={`${styles.badge} ${difficultyStyle[assignmentInfo.difficulty] ?? ''}`}>
                                {assignmentInfo.difficulty}
                            </span>
                        )}
                        <span className={`${styles.badge}`} style={{ color: '#78350f', background: '#fffbeb' }}>
                            ⏱ Reactive
                        </span>
                    </div>
                    <h1 className={styles.promptTitle}>{assignmentInfo?.topic}</h1>
                    {assignmentInfo?.description && (
                        <p className={styles.promptText}>{assignmentInfo.description}</p>
                    )}
                </div>

                {/* Upload Section — shown only if not yet submitted */}
                {!hasSubmitted && (
                    <div className={styles.editorSection}>
                        <div className={styles.editorHeader}>
                            <span className={styles.editorLabel}>Upload Your Submission</span>
                            <span className={styles.wordCount}>PDF, DOCX, PPTX, TXT</span>
                        </div>
                        <div
                            className={styles.uploadDropZone}
                            onClick={() => fileInputRef.current?.click()}
                            style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                gap: '1rem',
                                padding: '3rem 2rem',
                                background: 'white',
                                border: '2px dashed var(--border-dark)',
                                cursor: isUploading ? 'wait' : 'pointer',
                                transition: 'all 0.2s',
                                minHeight: '200px',
                            }}
                        >
                            {isUploading ? (
                                <>
                                    <div className={styles.spinner} />
                                    <span style={{ fontFamily: 'var(--font-body)', color: 'var(--muted)' }}>
                                        Uploading & extracting text...
                                    </span>
                                </>
                            ) : (
                                <>
                                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="rgba(8,8,6,0.25)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                                        <polyline points="17 8 12 3 7 8" />
                                        <line x1="12" x2="12" y1="3" y2="15" />
                                    </svg>
                                    <span style={{
                                        fontFamily: 'var(--font-display)',
                                        fontWeight: 700,
                                        fontSize: '0.85rem',
                                        letterSpacing: '0.1em',
                                        textTransform: 'uppercase' as const,
                                        color: 'var(--ink)',
                                    }}>
                                        Click to upload your file
                                    </span>
                                    <span style={{
                                        fontFamily: 'var(--font-body)',
                                        fontSize: '0.85rem',
                                        color: 'var(--muted)',
                                    }}>
                                        Supported formats: PDF, DOCX, PPTX, XLSX, TXT
                                    </span>
                                </>
                            )}
                        </div>
                        <input
                            type="file"
                            ref={fileInputRef}
                            style={{ display: 'none' }}
                            accept=".pdf,.docx,.pptx,.xlsx,.txt,.md,.csv"
                            onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) handleFileUpload(file)
                                e.target.value = ''
                            }}
                            disabled={isUploading}
                        />
                    </div>
                )}

                {/* Post-Upload: Submitted Banner + Socratic */}
                {hasSubmitted && (
                    <div className={styles.feedbackPanel}>
                        <div className={styles.submittedBanner}>
                            <span className={styles.submittedIcon}>✓</span>
                            <div>
                                <div className={styles.submittedTitle}>File Uploaded</div>
                                <div className={styles.submittedSub}>
                                    Your submission has been received. {hasSocraticChallenge
                                        ? 'Please answer the Socrates Engine challenge below to verify your ownership.'
                                        : 'Connecting to Socrates Engine...'}
                                </div>
                            </div>
                        </div>

                        {/* Socratic Challenge */}
                        {hasSocraticChallenge && !hasAnsweredSocratic && (
                            <div className={styles.socraticSection}>
                                <div className={styles.socraticHeader}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <span className={styles.socraticTag}>Socrates Engine</span>
                                        <SocraticTimer
                                            isActive={!hasAnsweredSocratic && !isScoringReactive}
                                            onExpire={handleSocraticTimeout}
                                            startedAt={reactiveStartedAt ?? null}
                                            timeLimit={reactiveTimeLimit}
                                        />
                                    </div>
                                    <h2 className={styles.socraticTitle}>Viva Voce Verification</h2>
                                    <p className={styles.socraticSubtitle}>
                                        Answer the question below to verify you actually wrote the content you just submitted.
                                        {reactivePasteViolations > 0 && (
                                            <span style={{ color: '#dc2626', marginLeft: '0.5rem' }}>
                                                ⚠ {reactivePasteViolations} paste attempt{reactivePasteViolations > 1 ? 's' : ''} recorded (−{Math.min(reactivePasteViolations * 5, 20)} pts)
                                            </span>
                                        )}
                                    </p>
                                </div>

                                <div className={styles.challengeBox}>
                                    <p className={styles.challengeText}>{currentReactiveChallenge}</p>
                                </div>

                                <div className={styles.editorHeader}>
                                    <span className={styles.editorLabel}>Your Answer</span>
                                    <span className={styles.wordCount}>
                                        {reactiveSocraticResponse.trim() ? reactiveSocraticResponse.trim().split(/\s+/).length : 0} words
                                    </span>
                                </div>
                                <textarea
                                    className={styles.editor}
                                    value={reactiveSocraticResponse}
                                    onChange={(e) => setReactiveSocraticResponse(e.target.value)}
                                    onPaste={handleReactivePaste}
                                    placeholder="Respond to the challenge in your own words…"
                                    rows={8}
                                    disabled={isScoringReactive}
                                />
                                <div className={styles.editorFooter}>
                                    <span />
                                    <button
                                        className={styles.submitBtn}
                                        onClick={() => handleReactiveSocraticSubmit(false)}
                                        disabled={isScoringReactive || reactiveSocraticResponse.trim().length < 20}
                                    >
                                        {isScoringReactive ? 'Evaluating…' : 'Submit Answer'}
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Final Scores (after Socratic) */}
                        {hasAnsweredSocratic && (
                            <div className={styles.socraticSection}>
                                <div className={styles.socraticHeader}>
                                    <span className={styles.socraticTag}>Evaluation Complete</span>
                                    <h2 className={styles.socraticTitle}>Your Results</h2>
                                </div>
                                <div className={styles.finalScores}>
                                    <div className={styles.scoreRow}>
                                        <span className={styles.scoreRowLabel}>Socrates Ownership Score</span>
                                        <span className={styles.scoreRowValue}>
                                            {(reactiveFinalScore?.socratic_score ?? reactiveStatus?.socratic?.socratic_score ?? 0).toFixed(1)}
                                        </span>
                                    </div>
                                    <p className={styles.analysisText}>
                                        {reactiveFinalScore?.analysis || reactiveStatus?.socratic?.analysis || ''}
                                    </p>

                                    {reactiveStatus?.scores && (
                                        <>
                                            <div className={styles.scoreRow}>
                                                <span className={styles.scoreRowLabel}>Similarity Signal</span>
                                                <span className={`${styles.scoreRowValue} ${styles.methodBadge}`} style={{
                                                    fontSize: '0.65rem',
                                                    background: reactiveStatus.scores.similarity_method === 'semantic' ? '#eef2ff' : '#f0fdf4',
                                                    color: reactiveStatus.scores.similarity_method === 'semantic' ? '#4f46e5' : '#16a34a',
                                                    padding: '0.1rem 0.4rem',
                                                    borderRadius: '4px',
                                                    textTransform: 'uppercase',
                                                }}>
                                                    {reactiveStatus.scores.similarity_method}
                                                </span>
                                            </div>
                                            <div className={styles.scoreRow}>
                                                <span className={styles.scoreRowLabel}>Peer Originality</span>
                                                <span className={styles.scoreRowValue}>
                                                    {reactiveStatus.scores.tfidf_originality.toFixed(1)}
                                                </span>
                                            </div>
                                            <div className={`${styles.scoreRow} ${styles.ownershipRow}`}>
                                                <span className={styles.scoreRowLabel}>Overall Ownership Score</span>
                                                <span className={styles.scoreRowValue}>
                                                    {reactiveStatus.scores.ownership_score.toFixed(1)}
                                                </span>
                                            </div>
                                        </>
                                    )}

                                    {!reactiveStatus?.scores && (
                                        <div style={{
                                            fontFamily: 'var(--font-body)',
                                            fontSize: '0.85rem',
                                            color: 'var(--muted)',
                                            padding: '1rem',
                                            background: '#fafaf8',
                                            border: '1px solid var(--border-dark)',
                                            textAlign: 'center',
                                        }}>
                                            Full analysis will be available once your teacher closes the assignment and runs the comparison.
                                        </div>
                                    )}

                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        )
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PROACTIVE MODE UI (existing flow)
    // ══════════════════════════════════════════════════════════════════════════

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

                {/* ── Honeypot white-text traps (invisible to students) ────── */}
                {assignment.hidden_trigger_phrase && (
                    <span
                        aria-hidden="true"
                        style={{
                            position: 'absolute',
                            width: '1px',
                            height: '1px',
                            padding: 0,
                            margin: '-1px',
                            overflow: 'hidden',
                            clip: 'rect(0, 0, 0, 0)',
                            whiteSpace: 'nowrap',
                            border: 0,
                            fontSize: 0,
                            lineHeight: 0,
                            color: 'transparent',
                            background: 'transparent',
                            pointerEvents: 'none',
                            userSelect: 'none',
                        }}
                        data-purpose="accessibility"
                    >
                        {assignment.hidden_trigger_phrase}
                    </span>
                )}
                {assignment.wrong_fact_signal && (
                    <span
                        aria-hidden="true"
                        style={{
                            position: 'absolute',
                            width: '1px',
                            height: '1px',
                            padding: 0,
                            margin: '-1px',
                            overflow: 'hidden',
                            clip: 'rect(0, 0, 0, 0)',
                            whiteSpace: 'nowrap',
                            border: 0,
                            fontSize: 0,
                            lineHeight: 0,
                            color: 'transparent',
                            background: 'transparent',
                            pointerEvents: 'none',
                            userSelect: 'none',
                        }}
                        data-purpose="accessibility"
                    >
                        {assignment.wrong_fact_signal}
                    </span>
                )}
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
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <span className={styles.socraticTag}>Socrates Engine</span>
                                    <SocraticTimer
                                        isActive={!!currentChallenge && !finalScore && !isScoringResponse}
                                        onExpire={handleSocraticTimeout}
                                        startedAt={startedAt ?? null}
                                        timeLimit={timeLimit ?? 180}
                                    />
                                </div>
                                <h2 className={styles.socraticTitle}>Viva Voce Verification</h2>
                                <p className={styles.socraticSubtitle}>
                                    Answer the question below to verify you understand what you wrote.
                                    {pasteViolations > 0 && (
                                        <span style={{ color: '#dc2626', marginLeft: '0.5rem' }}>
                                            ⚠ {pasteViolations} paste attempt{pasteViolations > 1 ? 's' : ''} recorded (−{Math.min(pasteViolations * 5, 20)} pts)
                                        </span>
                                    )}
                                </p>
                            </div>

                            {isLoadingChallenge && (
                                <div className={styles.challengeLoading}>
                                    <div className={styles.spinner} />
                                    <span>Generating challenge question…</span>
                                </div>
                            )}

                            {currentChallenge && !finalScore && (
                                <>
                                    <div className={styles.challengeBox}>
                                        <p className={styles.challengeText}>{currentChallenge}</p>
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
                                        onPaste={(e) => handleSocraticPaste(e, submission?.id ?? null)}
                                        placeholder="Respond to the challenge in your own words…"
                                        rows={8}
                                        disabled={isScoringResponse}
                                    />
                                    <div className={styles.editorFooter}>
                                        <span />
                                        <button
                                            className={styles.submitBtn}
                                            onClick={() => handleSocraticSubmit(false)}
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
                                        <span className={styles.scoreRowLabel}>Socrates Ownership Score</span>
                                        <span className={styles.scoreRowValue}>{finalScore.socratic_score.toFixed(1)}</span>
                                    </div>
                                    <div className={`${styles.scoreRow} ${styles.ownershipRow}`}>
                                        <span className={styles.scoreRowLabel}>Overall Ownership Score</span>
                                        <span className={styles.scoreRowValue}>{finalScore.ownership_score.toFixed(1)}</span>
                                    </div>
                                    <p className={styles.analysisText}>{finalScore.analysis}</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
