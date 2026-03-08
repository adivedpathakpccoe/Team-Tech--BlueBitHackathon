'use client'

import { useState, useEffect } from 'react'
import { assignmentsApi, type Assignment, type AssignmentCreate } from '@/lib/api'
import styles from './classroom.module.css'
import { toast } from 'sonner'

export default function AssignmentSection({ classroomId, token }: { classroomId: string, token: string }) {
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)

    // Form states
    const [topic, setTopic] = useState('')
    const [description, setDescription] = useState('')
    const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
    const [mode, setMode] = useState<'proactive' | 'reactive'>('proactive')

    // Detailed Controls
    const [enableBehavioral, setEnableBehavioral] = useState(true)
    const [enableSocratic, setEnableSocratic] = useState(true)
    const [honeypotHiddenInstruction, setHoneypotHiddenInstruction] = useState(true)
    const [honeypotZeroWidth, setHoneypotZeroWidth] = useState(true)
    const [honeypotFakeFact, setHoneypotFakeFact] = useState(true)
    const [honeypotSentimentContradiction, setHoneypotSentimentContradiction] = useState(false)

    useEffect(() => {
        fetchAssignments()
    }, [classroomId, token])

    const fetchAssignments = async () => {
        try {
            const res = await assignmentsApi.list(classroomId, token)
            if (res.ok && Array.isArray(res.data)) {
                setAssignments(res.data)
            }
        } catch (error) {
            console.error('Failed to fetch assignments:', error)
            // Silence the toast if it's just a 404/not found during initial setup
            // toast.error('Failed to load assignments')
        } finally {
            setIsLoading(false)
        }
    }

    const handleGenerateAI = async () => {
        if (!topic.trim()) {
            toast.error('Please enter a topic first so AI knows what to generate.')
            return
        }

        setIsGenerating(true)
        try {
            toast.info('Generating assignment data with AI...')
            const res = await assignmentsApi.generateData({ topic, difficulty }, token)
            if (res.ok && res.data) {
                if (res.data.topic) setTopic(res.data.topic)
                if (res.data.description) setDescription(res.data.description)
                if (res.data.difficulty) setDifficulty(res.data.difficulty as 'easy' | 'medium' | 'hard')
                toast.success('AI generation complete! You can now review and refine.')
            }
        } catch (error) {
            console.error('AI generation failed:', error)
            toast.error('AI generation failed. Please try manual entry.')
        } finally {
            setIsGenerating(false)
        }
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!topic.trim() || isSubmitting) return

        setIsSubmitting(true)
        const payload: AssignmentCreate = {
            topic,
            description,
            difficulty,
            mode,
            enable_behavioral: enableBehavioral,
            enable_socratic: enableSocratic,
            honeypot_hidden_instruction: honeypotHiddenInstruction,
            honeypot_zero_width: honeypotZeroWidth,
            honeypot_fake_fact: honeypotFakeFact,
            honeypot_sentiment_contradiction: honeypotSentimentContradiction
        }

        try {
            const res = await assignmentsApi.create(classroomId, payload, token)
            if (res.ok) {
                resetForm()
                setIsModalOpen(false)
                toast.success('Assignment created successfully')
                fetchAssignments()
            }
        } catch (error) {
            console.error('Failed to create assignment:', error)
            toast.error(error instanceof Error ? error.message : 'Error creating assignment')
        } finally {
            setIsSubmitting(false)
        }
    }

    const resetForm = () => {
        setTopic('')
        setDescription('')
        setDifficulty('medium')
        setMode('proactive')
        setEnableBehavioral(true)
        setEnableSocratic(true)
        setHoneypotHiddenInstruction(true)
        setHoneypotZeroWidth(true)
        setHoneypotFakeFact(true)
        setHoneypotSentimentContradiction(false)
    }

    const getActiveHoneypotCount = (a: Assignment) => {
        let count = 0
        if (a.honeypot_hidden_instruction) count++
        if (a.honeypot_zero_width) count++
        if (a.honeypot_fake_fact) count++
        if (a.honeypot_sentiment_contradiction) count++
        return count
    }

    return (
        <section className={styles.section} style={{ marginTop: '4rem' }}>
            <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Assignments</h2>
                <button
                    className={styles.createBtn}
                    onClick={() => setIsModalOpen(true)}
                >
                    + Create Assignment
                </button>
            </div>

            <div className={styles.assignmentGrid}>
                {isLoading ? (
                    <div className={styles.noBatches}>Loading assignments...</div>
                ) : assignments.length > 0 ? (
                    assignments.map((assignment) => (
                        <div key={assignment.id} className={styles.assignmentCard}>
                            <div className={styles.assignmentHeader}>
                                <h3 className={styles.assignmentTitle}>{assignment.topic}</h3>
                                <div style={{ display: 'flex', gap: '0.5rem' }}>
                                    <span className={`${styles.difficultyBadge} ${styles[assignment.difficulty]}`}>
                                        {assignment.difficulty}
                                    </span>
                                </div>
                            </div>

                            <p className={styles.assignmentDesc}>
                                {assignment.description || 'No description provided.'}
                            </p>

                            <div className={styles.assignmentMeta}>
                                <div className={styles.assignmentMode}>
                                    <span>Mode: {assignment.mode}</span>
                                    {getActiveHoneypotCount(assignment) > 0 && (
                                        <span className={styles.honeypotTag}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                            {getActiveHoneypotCount(assignment)} Traps Active
                                        </span>
                                    )}
                                </div>
                                <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
                                    {assignment.enable_behavioral && <span style={{ fontSize: '0.65rem', background: '#e0e7ff', padding: '0.2rem 0.5rem', color: '#4338ca', fontWeight: 600 }}>BEHAVIORAL</span>}
                                    {assignment.enable_socratic && <span style={{ fontSize: '0.65rem', background: '#fef3c7', padding: '0.2rem 0.5rem', color: '#92400e', fontWeight: 600 }}>SOCRATIC</span>}
                                </div>
                                <button className={styles.viewBtn}>View Detailed Analytics</button>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className={styles.noBatches}>
                        No assignments created yet. Prepare your first assignment to start monitoring integrity.
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
                    <div
                        className={styles.modal}
                        style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className={styles.modalTitle}>Configure Assignment</h3>

                        <button
                            type="button"
                            className={styles.aiGenBtn}
                            onClick={handleGenerateAI}
                            disabled={isGenerating || !topic}
                            title={!topic ? "Enter a topic first" : "Generate with AI"}
                        >
                            {isGenerating ? (
                                <>Generating Content...</>
                            ) : (
                                <>
                                    <svg className={styles.aiIcon} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                                    Generate Full Data with Gen-AI
                                </>
                            )}
                        </button>

                        <form onSubmit={handleCreate}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Assignment Topic</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="e.g. Advanced Thermodynamics or React Server Components"
                                    value={topic}
                                    onChange={(e) => setTopic(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>

                            <div className={styles.formGroup}>
                                <label className={styles.label}>Instructions / Content</label>
                                <textarea
                                    className={styles.textarea}
                                    placeholder="Provide detailed instructions or the core content of the assignment..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>

                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
                                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                                    <label className={styles.label}>Complexity Level</label>
                                    <select
                                        className={styles.select}
                                        value={difficulty}
                                        onChange={(e) => setDifficulty(e.target.value as any)}
                                    >
                                        <option value="easy">Easy</option>
                                        <option value="medium">Medium</option>
                                        <option value="hard">Hard</option>
                                    </select>
                                </div>
                                <div className={styles.formGroup} style={{ marginBottom: 0 }}>
                                    <label className={styles.label}>Monitoring Mode</label>
                                    <select
                                        className={styles.select}
                                        value={mode}
                                        onChange={(e) => setMode(e.target.value as any)}
                                    >
                                        <option value="proactive">Proactive (Real-time)</option>
                                        <option value="reactive">Reactive (Post-submit)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Granular Detection Controls */}
                            <div style={{ marginBottom: '2rem' }}>
                                <label className={styles.label} style={{ color: 'var(--teal)', borderBottom: '1px solid #eee', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Detection Modules</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <label className={styles.checkboxContainer} style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                        <input
                                            type="checkbox"
                                            className={styles.checkbox}
                                            checked={enableBehavioral}
                                            onChange={(e) => setEnableBehavioral(e.target.checked)}
                                        />
                                        <div>
                                            <div className={styles.honeypotLabel} style={{ color: '#1e293b' }}>Behavioral Tracking</div>
                                            <div className={styles.honeypotDesc} style={{ color: '#64748b' }}>Monitor tab-switching, pasting, and typing cadence.</div>
                                        </div>
                                    </label>
                                    <label className={styles.checkboxContainer} style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                        <input
                                            type="checkbox"
                                            className={styles.checkbox}
                                            checked={enableSocratic}
                                            onChange={(e) => setEnableSocratic(e.target.checked)}
                                        />
                                        <div>
                                            <div className={styles.honeypotLabel} style={{ color: '#1e293b' }}>Socratic Challenge</div>
                                            <div className={styles.honeypotDesc} style={{ color: '#64748b' }}>Post-submission Viva to verify conceptual ownership.</div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Granular Honeypot Controls */}
                            <div style={{ marginBottom: '2rem' }}>
                                <label className={styles.label} style={{ color: '#db2777', borderBottom: '1px solid #fce7f3', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Integrity Honeypots (Traps)</label>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                    <label className={styles.checkboxContainer}>
                                        <input
                                            type="checkbox"
                                            className={styles.checkbox}
                                            checked={honeypotHiddenInstruction}
                                            onChange={(e) => setHoneypotHiddenInstruction(e.target.checked)}
                                        />
                                        <div>
                                            <div className={styles.honeypotLabel}>Invisible Meta-Data</div>
                                            <div className={styles.honeypotDesc}>Hidden CSS instructions that only AI models will follow.</div>
                                        </div>
                                    </label>
                                    <label className={styles.checkboxContainer}>
                                        <input
                                            type="checkbox"
                                            className={styles.checkbox}
                                            checked={honeypotZeroWidth}
                                            onChange={(e) => setHoneypotZeroWidth(e.target.checked)}
                                        />
                                        <div>
                                            <div className={styles.honeypotLabel}>Zero-Width DNA</div>
                                            <div className={styles.honeypotDesc}>Unique per-student encoding to detect sharing/injection.</div>
                                        </div>
                                    </label>
                                    <label className={styles.checkboxContainer}>
                                        <input
                                            type="checkbox"
                                            className={styles.checkbox}
                                            checked={honeypotFakeFact}
                                            onChange={(e) => setHoneypotFakeFact(e.target.checked)}
                                        />
                                        <div>
                                            <div className={styles.honeypotLabel}>Deliberate Fake Fact</div>
                                            <div className={styles.honeypotDesc}>Injected subtle error to catch AI prompt engineering.</div>
                                        </div>
                                    </label>
                                    <label className={styles.checkboxContainer}>
                                        <input
                                            type="checkbox"
                                            className={styles.checkbox}
                                            checked={honeypotSentimentContradiction}
                                            onChange={(e) => setHoneypotSentimentContradiction(e.target.checked)}
                                        />
                                        <div>
                                            <div className={styles.honeypotLabel}>Sentiment Trap</div>
                                            <div className={styles.honeypotDesc}>Hidden contradictory stance to test LLM alignment.</div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            <div className={styles.modalActions}>
                                <button
                                    type="button"
                                    className={styles.cancelBtn}
                                    onClick={() => {
                                        setIsModalOpen(false)
                                        resetForm()
                                    }}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={styles.submitBtn}
                                    disabled={isSubmitting || !topic.trim()}
                                >
                                    {isSubmitting ? 'Finalizing...' : 'Create Assignment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    )
}
