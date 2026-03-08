'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import { submissionsApi, replayApi, assignmentsApi, type Assignment } from '@/lib/api'
import styles from './analytics.module.css'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
import Link from 'next/link'

// Lazy-load the playback viewer (heavy)
const CodeReplayViewer = dynamic(() => import('@/components/ui/CodeReplayViewer'), { ssr: false })

// ─── Analytics Page ────────────────────────────────────────────────────────────

export default function AssignmentAnalyticsPage({
    params
}: {
    params: Promise<{ id: string, assignmentId: string }>
}) {
    const { id: classroomId, assignmentId } = use(params)
    const [assignment, setAssignment] = useState<Assignment | null>(null)
    const [submissions, setSubmissions] = useState<any[]>([])
    const [selectedSubmission, setSelectedSubmission] = useState<any | null>(null)
    const [replayLog, setReplayLog] = useState<any | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isReplayLoading, setIsReplayLoading] = useState(false)
    const [token, setToken] = useState<string | null>(null)
    const router = useRouter()

    useEffect(() => {
        // Get token from cookie (client-side)
        const t = document.cookie
            .split('; ')
            .find(row => row.startsWith('gs_access_token='))
            ?.split('=')[1]

        if (!t) {
            router.push('/auth/login')
            return
        }
        setToken(t)
        loadData(t)
    }, [assignmentId])

    const loadData = async (t: string) => {
        setIsLoading(true)
        try {
            // Fetch assignment details
            const aRes = await assignmentsApi.list(classroomId, t)
            if (aRes.data) {
                const found = (aRes.data as Assignment[]).find(a => a.id === assignmentId)
                if (found) setAssignment(found)
            }

            // Fetch submissions
            const sRes = await submissionsApi.listByAssignment(assignmentId, t)
            if (sRes.data) {
                setSubmissions(sRes.data)
            }
        } catch (error) {
            console.error('Failed to load analytics:', error)
            toast.error('Failed to load submissions')
        } finally {
            setIsLoading(false)
        }
    }

    const handleViewReplay = async (sub: any) => {
        if (!token) return
        setSelectedSubmission(sub)
        setReplayLog(null)
        setIsReplayLoading(true)

        try {
            const res = await replayApi.getLog(sub.id, token)
            if (res.data) {
                setReplayLog(res.data)
            } else {
                toast.error('No replay data found for this submission')
            }
        } catch (error) {
            console.error('Failed to load replay:', error)
            toast.error('Error loading replay data')
        } finally {
            setIsReplayLoading(false)
        }
    }

    if (isLoading) {
        return (
            <div className={styles.loadingBox}>
                <div className={styles.spinner} />
                <p>Loading submission analytics...</p>
            </div>
        )
    }

    return (
        <div className={styles.page}>
            <header className={styles.header}>
                <div className={styles.headerTop}>
                    <Link href={`/dashboard/classroom/${classroomId}`} className={styles.backLink}>
                        ← Back to Classroom
                    </Link>
                </div>
                <div className={styles.headerContent}>
                    <h1 className={styles.title}>
                        {assignment?.topic || 'Assignment Analytics'}
                    </h1>
                    <p className={styles.subtitle}>
                        Review student submissions, authenticity scores, and WritingDNA replays.
                    </p>
                </div>
            </header>

            <div className={styles.mainGrid}>
                {/* ── Submissions List ───────────────────────────────────── */}
                <div className={styles.listCard}>
                    <h2 className={styles.cardTitle}>
                        Submissions ({submissions.length})
                    </h2>
                    <div className={styles.tableWrap}>
                        <table className={styles.table}>
                            <thead>
                                <tr>
                                    <th>Student</th>
                                    <th>Submitted</th>
                                    <th>Integrity</th>
                                    <th>Socratic</th>
                                    <th>Ownership</th>
                                    <th />
                                </tr>
                            </thead>
                            <tbody>
                                {submissions.map(sub => (
                                    <tr
                                        key={sub.id}
                                        className={selectedSubmission?.id === sub.id ? styles.selectedRow : ''}
                                        onClick={() => handleViewReplay(sub)}
                                    >
                                        <td>
                                            <div className={styles.studentInfo}>
                                                <div className={styles.avatar}>
                                                    {(sub.profiles?.full_name || 'S')[0]}
                                                </div>
                                                <span>{sub.profiles?.full_name || 'Unknown Student'}</span>
                                            </div>
                                        </td>
                                        <td>{new Date(sub.submitted_at).toLocaleDateString()}</td>
                                        <td>
                                            <div className={`${styles.scoreTag} ${(sub.scores?.honeypot_score ?? 10) > 7 ? styles.scoreGreen : styles.scoreRed
                                                }`}>
                                                {sub.scores?.honeypot_score?.toFixed(1) ?? 'N/A'}
                                            </div>
                                        </td>
                                        <td>{sub.scores?.socratic_score?.toFixed(1) ?? '—'}</td>
                                        <td>
                                            <div className={styles.ownershipLabel}>
                                                {sub.scores?.ownership_score?.toFixed(0) ?? '—'}{sub.scores?.ownership_score !== undefined ? '%' : ''}
                                            </div>
                                        </td>
                                        <td>
                                            <button className={styles.viewRowBtn}>View Replay</button>
                                        </td>
                                    </tr>
                                ))}
                                {submissions.length === 0 && (
                                    <tr>
                                        <td colSpan={6} className={styles.emptyTable}>
                                            No submissions received yet.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* ── Replay Viewer ────────────────────────────────────────── */}
                <div className={styles.replayCard}>
                    {selectedSubmission ? (
                        <>
                            <div className={styles.replayHeader}>
                                <div>
                                    <h3 className={styles.replayTitle}>
                                        {selectedSubmission.profiles?.full_name}'s Session
                                    </h3>
                                    <div className={styles.replayMeta}>
                                        ID: {selectedSubmission.id.slice(0, 8)} • {new Date(selectedSubmission.submitted_at).toLocaleString()}
                                    </div>
                                </div>
                                <div className={styles.replayStats}>
                                    <div className={styles.statItem}>
                                        <span className={styles.statLabel}>Words</span>
                                        <span className={styles.statVal}>{selectedSubmission.essay_text.split(/\s+/).length}</span>
                                    </div>
                                </div>
                            </div>

                            <div className={styles.replayContainer}>
                                {isReplayLoading ? (
                                    <div className={styles.replayLoading}>
                                        <div className={styles.spinner} />
                                        <p>Loading WritingDNA Replay...</p>
                                    </div>
                                ) : replayLog ? (
                                    <CodeReplayViewer
                                        log={replayLog}
                                        studentName={selectedSubmission.profiles?.full_name}
                                        isTextMode={true}
                                    />
                                ) : (
                                    <div className={styles.noReplay}>
                                        <div className={styles.noReplayIcon}>📼</div>
                                        <p>No Replay Data</p>
                                        <span>Proactive recording might have been disabled for this assignment.</span>
                                    </div>
                                )}
                            </div>

                            <div className={styles.essayBox}>
                                <h4 className={styles.essayBoxTitle}>Final Submission</h4>
                                <div className={styles.essayText}>
                                    {selectedSubmission.essay_text}
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className={styles.selectPrompt}>
                            <div className={styles.selectIcon}>🖱️</div>
                            <h3>Select a submission</h3>
                            <p>Choose a student from the list to view their integrity analytics and replay their writing process.</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    )
}
