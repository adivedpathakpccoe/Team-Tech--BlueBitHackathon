'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { studentApi, classroomsApi, reactiveApi, type EnrolledBatch, type Assignment } from '@/lib/api'
import styles from './dashboard.module.css'
import { toast } from 'sonner'
import { useRef } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BatchWithAssignments extends EnrolledBatch {
    assignments: Assignment[]
    loadingAssignments: boolean
}

// ─── Difficulty badge colours ─────────────────────────────────────────────────

const difficultyStyle: Record<string, string> = {
    easy: styles.diffEasy,
    medium: styles.diffMedium,
    hard: styles.diffHard,
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function StudentSection({ token, initialBatches }: { token: string; initialBatches?: EnrolledBatch[] }) {
    const router = useRouter()
    const [batches, setBatches] = useState<BatchWithAssignments[]>(() => {
        if (!initialBatches) return []
        return initialBatches.map(b => ({
            ...b,
            assignments: [],
            loadingAssignments: false,
        }))
    })
    const [isLoading, setIsLoading] = useState(!initialBatches)
    const [joinCode, setJoinCode] = useState('')
    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)
    const [isJoining, setIsJoining] = useState(false)
    const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null)
    const [extractingId, setExtractingId] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const activeAssignmentRef = useRef<string | null>(null)

    // ── Fetch enrolled batches ──────────────────────────────────────────────

    const fetchMyBatches = useCallback(async () => {
        setIsLoading(true)
        try {
            const res = await studentApi.getMyBatches(token)
            if (res.ok && Array.isArray(res.data)) {
                const withAssignments: BatchWithAssignments[] = res.data.map((b) => ({
                    ...b,
                    assignments: [],
                    loadingAssignments: false,
                }))
                setBatches(withAssignments)
            }
        } catch (error) {
            console.error('Failed to fetch enrolled batches:', error)
            toast.error('Failed to load your enrolled classes')
        } finally {
            setIsLoading(false)
        }
    }, [token])

    useEffect(() => {
        // Always re-fetch from the API on mount so we have fresh data regardless
        // of whether the server-side prop was populated.  The initialBatches prop
        // is only used as the initial state to avoid the loading flicker.
        fetchMyBatches()
    }, [fetchMyBatches])

    // ── Fetch assignments for a batch when expanded ─────────────────────────

    const loadAssignments = async (classroomId: string, batchId: string) => {
        setBatches((prev) =>
            prev.map((b) =>
                b.batch_id === batchId ? { ...b, loadingAssignments: true } : b
            )
        )
        try {
            const res = await studentApi.getAssignmentsForClassroom(classroomId, token)
            const data = Array.isArray(res.data) ? res.data : []
            setBatches((prev) =>
                prev.map((b) =>
                    b.batch_id === batchId
                        ? { ...b, assignments: data, loadingAssignments: false }
                        : b
                )
            )
        } catch {
            setBatches((prev) =>
                prev.map((b) =>
                    b.batch_id === batchId ? { ...b, loadingAssignments: false } : b
                )
            )
            toast.error('Failed to load assignments for this class')
        }
    }

    const handleToggleExpand = (batch: BatchWithAssignments) => {
        if (expandedBatchId === batch.batch_id) {
            setExpandedBatchId(null)
        } else {
            setExpandedBatchId(batch.batch_id)
            if (batch.assignments.length === 0 && !batch.loadingAssignments) {
                loadAssignments(batch.classroom_id, batch.batch_id)
            }
        }
    }

    // ── Join a batch ────────────────────────────────────────────────────────

    const handleJoin = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!joinCode.trim() || isJoining) return

        setIsJoining(true)
        try {
            const res = await classroomsApi.joinBatch(joinCode.trim(), token)
            if (res.ok) {
                toast.success('Successfully joined the batch!')
                setJoinCode('')
                setIsJoinModalOpen(false)
                fetchMyBatches()
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Failed to join batch')
        } finally {
            setIsJoining(false)
        }
    }

    // ── Handle file upload and extraction ────────────────────────────────────

    const handleFileUpload = async (assignmentId: string, file: File) => {
        setExtractingId(assignmentId)
        try {
            toast.info('Uploading and processing your submission...')
            const res = await reactiveApi.upload(assignmentId, file, token)

            if (res.ok) {
                toast.success('File uploaded successfully! Redirecting to verify...')
                // After successful upload, redirect to the assignment workspace to handle Socratic challenge
                router.push(`/dashboard/assignment/${assignmentId}`)
            }
        } catch (error: any) {
            console.error('Upload error:', error)
            // If already submitted, just redirect them
            if (error.message?.includes('already submitted')) {
                toast.info('You have already submitted. Opening workspace...')
                router.push(`/dashboard/assignment/${assignmentId}`)
            } else {
                toast.error(error instanceof Error ? error.message : 'Upload failed')
            }
        } finally {
            setExtractingId(null)
        }
    }

    const triggerFileInput = (assignmentId: string) => {
        activeAssignmentRef.current = assignmentId
        fileInputRef.current?.click()
    }

    // ── Render ─────────────────────────────────────────────────────────────

    return (
        <section className={styles.classroomSection}>
            {/* Header */}
            <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>My Enrolled Classes</h2>
                <button
                    className={styles.createBtn}
                    onClick={() => setIsJoinModalOpen(true)}
                >
                    + Join Batch
                </button>
            </div>

            {/* Batch list */}
            <div className={styles.studentBatchList}>
                {isLoading ? (
                    <div className={styles.noClassrooms}>Loading your classes…</div>
                ) : batches.length === 0 ? (
                    <div className={styles.noClassrooms}>
                        You haven't joined any batch yet.{' '}
                        <button
                            className={styles.inlineJoinBtn}
                            onClick={() => setIsJoinModalOpen(true)}
                        >
                            Join one now →
                        </button>
                    </div>
                ) : (
                    batches.map((batch) => {
                        const isExpanded = expandedBatchId === batch.batch_id
                        return (
                            <div key={batch.batch_id} className={styles.studentBatchCard}>
                                {/* Batch header row */}
                                <div
                                    className={styles.studentBatchHeader}
                                    onClick={() => handleToggleExpand(batch)}
                                >
                                    <div className={styles.studentBatchMeta}>
                                        <span className={`${styles.cardTag} ${styles.cardTagPrimary}`}>
                                            Batch
                                        </span>
                                        <div>
                                            <div className={styles.studentBatchName}>
                                                {batch.batch_name}
                                            </div>
                                            <div className={styles.studentClassroomLabel}>
                                                <span className={styles.studentClassroomIcon}>🏫</span>
                                                {batch.classroom_name}
                                            </div>
                                        </div>
                                    </div>
                                    <div className={styles.studentBatchRight}>
                                        <div className={styles.studentJoinedBadge}>
                                            ✓ Enrolled
                                        </div>
                                        <span className={styles.expandChevron}>
                                            {isExpanded ? '▲' : '▼'}
                                        </span>
                                    </div>
                                </div>

                                {/* Assignments accordion */}
                                {isExpanded && (
                                    <div className={styles.assignmentsAccordion}>
                                        <div className={styles.assignmentsHeader}>
                                            Assignments
                                        </div>
                                        {batch.loadingAssignments ? (
                                            <div className={styles.assignmentLoading}>
                                                Loading assignments…
                                            </div>
                                        ) : batch.assignments.length === 0 ? (
                                            <div className={styles.assignmentEmpty}>
                                                No assignments posted for this class yet.
                                            </div>
                                        ) : (
                                            <div className={styles.assignmentGrid}>
                                                {batch.assignments.map((a) => (
                                                    <div
                                                        key={a.id}
                                                        className={`${styles.assignmentRow} ${a.mode === 'reactive' ? styles.assignmentRowReactive : ''}`}
                                                        style={{
                                                            cursor: a.mode === 'proactive' ? 'pointer' : 'default',
                                                        }}
                                                        onClick={() => {
                                                            if (a.mode === 'proactive') {
                                                                router.push(`/dashboard/assignment/${a.id}`)
                                                            }
                                                        }}
                                                    >
                                                        <div className={styles.assignmentMain}>
                                                            <div className={styles.assignmentTopic}>
                                                                {a.topic}
                                                            </div>
                                                            <div className={styles.assignmentBadges}>
                                                                {a.mode === 'proactive' && (
                                                                    <>
                                                                        <span
                                                                            className={`${styles.diffBadge} ${difficultyStyle[a.difficulty] ?? ''}`}
                                                                        >
                                                                            {a.difficulty}
                                                                        </span>
                                                                        <span className={styles.modeBadge} style={{ color: '#1a8c82', background: '#e8f4f3' }}>
                                                                            {a.submitted ? 'Review Details →' : 'Open →'}
                                                                        </span>
                                                                    </>
                                                                )}
                                                                <span className={`${styles.modeBadge} ${a.mode === 'reactive' ? styles.modeBadgeReactive : ''}`}>
                                                                    {a.mode}
                                                                </span>
                                                                {a.submitted && (
                                                                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', color: '#10b981', fontWeight: 600 }}>
                                                                        <svg viewBox="0 0 20 20" fill="currentColor" style={{ width: '14px', height: '14px' }}>
                                                                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                                                        </svg>
                                                                        Submitted
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>

                                                        {a.description && (
                                                            <p className={styles.assignmentDesc}>
                                                                {a.description}
                                                            </p>
                                                        )}

                                                        {a.mode === 'reactive' && (
                                                            <div className={styles.assignmentActions} onClick={(e) => e.stopPropagation()}>
                                                                <button
                                                                    className={styles.uploadBtn}
                                                                    onClick={() => triggerFileInput(a.id)}
                                                                    disabled={extractingId === a.id}
                                                                >
                                                                    {extractingId === a.id ? (
                                                                        <>
                                                                            <span className={styles.spinnerIcon} /> Extracting...
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" x2="12" y1="3" y2="15" /></svg>
                                                                            Upload Submission
                                                                        </>
                                                                    )}
                                                                </button>
                                                                <span className={styles.uploadHint}>Supporting PDF, DOCX, PPTX, etc.</span>
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        )
                    })
                )}
            </div>

            {/* Join Batch Modal */}
            {isJoinModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsJoinModalOpen(false)}>
                    <div
                        className={styles.modal}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className={styles.modalTitle}>Join a Batch</h3>
                        <p className={styles.deleteModalBody}>
                            Enter the join code provided by your teacher to enroll in a batch.
                        </p>
                        <form onSubmit={handleJoin}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Join Code</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="e.g. ABC123"
                                    value={joinCode}
                                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                                    required
                                    autoFocus
                                    maxLength={12}
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <button
                                    type="button"
                                    className={styles.cancelBtn}
                                    onClick={() => setIsJoinModalOpen(false)}
                                    disabled={isJoining}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={styles.submitBtn}
                                    disabled={isJoining || !joinCode.trim()}
                                >
                                    {isJoining ? 'Joining…' : 'Join Batch'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Hidden File Input */}
            <input
                type="file"
                ref={fileInputRef}
                style={{ display: 'none' }}
                onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file && activeAssignmentRef.current) {
                        handleFileUpload(activeAssignmentRef.current, file)
                    }
                    e.target.value = '' // Reset
                }}
            />
        </section>
    )
}
