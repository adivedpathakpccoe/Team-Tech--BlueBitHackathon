'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { studentApi, classroomsApi, type EnrolledBatch, type Assignment } from '@/lib/api'
import styles from './dashboard.module.css'
import { toast } from 'sonner'

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

export default function StudentSection({ token }: { token: string }) {
    const router = useRouter()
    const [batches, setBatches] = useState<BatchWithAssignments[]>([])
    const [isLoading, setIsLoading] = useState(true)
    const [joinCode, setJoinCode] = useState('')
    const [isJoinModalOpen, setIsJoinModalOpen] = useState(false)
    const [isJoining, setIsJoining] = useState(false)
    const [expandedBatchId, setExpandedBatchId] = useState<string | null>(null)

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
                                                        className={styles.assignmentRow}
                                                        style={{ cursor: 'pointer' }}
                                                        onClick={() => router.push(`/dashboard/assignment/${a.id}`)}
                                                    >
                                                        <div className={styles.assignmentTopic}>
                                                            {a.topic}
                                                        </div>
                                                        <div className={styles.assignmentBadges}>
                                                            <span
                                                                className={`${styles.diffBadge} ${difficultyStyle[a.difficulty] ?? ''}`}
                                                            >
                                                                {a.difficulty}
                                                            </span>
                                                            <span className={styles.modeBadge}>
                                                                {a.mode}
                                                            </span>
                                                            <span className={styles.modeBadge} style={{ color: '#1a8c82', background: '#e8f4f3' }}>
                                                                Open →
                                                            </span>
                                                        </div>
                                                        {a.description && (
                                                            <p className={styles.assignmentDesc}>
                                                                {a.description}
                                                            </p>
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
        </section>
    )
}
