'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { assignmentsApi, reactiveApi, type Assignment, type AssignmentCreate, type ReactiveResultEntry, type ReactiveAnalysisResult } from '@/lib/api'
import styles from './classroom.module.css'
import { toast } from 'sonner'

export default function AssignmentSection({ classroomId, token }: { classroomId: string, token: string }) {
    const router = useRouter()
    const [assignments, setAssignments] = useState<Assignment[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null)
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const [isGenerating, setIsGenerating] = useState(false)
    const [generatedPreview, setGeneratedPreview] = useState<{ topic: string; description: string; difficulty: string } | null>(null)
    const [batches, setBatches] = useState<any[]>([])
    const [selectedBatchIds, setSelectedBatchIds] = useState<string[]>([])

    // Form states
    const [topic, setTopic] = useState('')
    const [description, setDescription] = useState('')
    const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>('medium')
    const [mode, setMode] = useState<'proactive' | 'reactive'>('proactive')

    // Detailed Controls (proactive only)
    const [enableBehavioral, setEnableBehavioral] = useState(true)
    const [enableSocratic, setEnableSocratic] = useState(true)
    const [honeypotHiddenInstruction, setHoneypotHiddenInstruction] = useState(true)
    const [honeypotZeroWidth, setHoneypotZeroWidth] = useState(true)
    const [honeypotFakeFact, setHoneypotFakeFact] = useState(true)
    const [honeypotSentimentContradiction, setHoneypotSentimentContradiction] = useState(false)

    // Reactive analysis state
    const [isAnalyzing, setIsAnalyzing] = useState<string | null>(null)
    const [analysisResults, setAnalysisResults] = useState<ReactiveAnalysisResult | null>(null)
    const [resultsModalAssignmentId, setResultsModalAssignmentId] = useState<string | null>(null)
    const [reactiveResults, setReactiveResults] = useState<ReactiveResultEntry[] | null>(null)
    const [isLoadingResults, setIsLoadingResults] = useState(false)

    useEffect(() => {
        fetchAssignments()
        fetchBatches()
    }, [classroomId, token])

    const fetchBatches = async () => {
        try {
            const { classroomsApi } = await import('@/lib/api')
            const res = await classroomsApi.listBatches(classroomId, token)
            if (res.ok && Array.isArray(res.data)) {
                setBatches(res.data)
            }
        } catch (error) {
            console.error('Failed to fetch batches:', error)
        }
    }

    const fetchAssignments = async () => {
        try {
            const res = await assignmentsApi.list(classroomId, token)
            if (res.ok && Array.isArray(res.data)) {
                setAssignments(res.data)
            }
        } catch (error) {
            console.error('Failed to fetch assignments:', error)
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
                const newTopic = res.data.topic ?? topic
                const newDesc = res.data.description ?? ''
                const newDiff = (res.data.difficulty as 'easy' | 'medium' | 'hard') ?? difficulty
                setTopic(newTopic)
                setDescription(newDesc)
                setDifficulty(newDiff)
                setGeneratedPreview({ topic: newTopic, description: newDesc, difficulty: newDiff })
                toast.success('AI generation complete!')
            }
        } catch (error) {
            console.error('AI generation failed:', error)
            toast.error('AI generation failed. Please try manual entry.')
        } finally {
            setIsGenerating(false)
        }
    }

    const openEditModal = (assignment: Assignment) => {
        setEditingAssignment(assignment)
        setTopic(assignment.topic)
        setDescription(assignment.description ?? '')
        setDifficulty(assignment.difficulty)
        setMode(assignment.mode)
        setEnableBehavioral(assignment.enable_behavioral)
        setEnableSocratic(assignment.enable_socratic)
        setHoneypotHiddenInstruction(assignment.honeypot_hidden_instruction)
        setHoneypotZeroWidth(assignment.honeypot_zero_width)
        setHoneypotFakeFact(assignment.honeypot_fake_fact)
        setHoneypotSentimentContradiction(assignment.honeypot_sentiment_contradiction)
        setSelectedBatchIds(assignment.batch_ids ?? [])
        setIsGenerating(false)
        setIsModalOpen(true)
    }

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!topic.trim() || isSubmitting) return

        setIsSubmitting(true)
        const payload: AssignmentCreate = {
            topic,
            description,
            difficulty,
            mode,
            enable_behavioral: mode === 'proactive' ? enableBehavioral : false,
            enable_socratic: enableSocratic,
            honeypot_hidden_instruction: mode === 'proactive' ? honeypotHiddenInstruction : false,
            honeypot_zero_width: mode === 'proactive' ? honeypotZeroWidth : false,
            honeypot_fake_fact: mode === 'proactive' ? honeypotFakeFact : false,
            honeypot_sentiment_contradiction: mode === 'proactive' ? honeypotSentimentContradiction : false,
            batch_ids: selectedBatchIds
        }

        try {
            if (editingAssignment) {
                const res = await assignmentsApi.update(classroomId, editingAssignment.id, payload, token)
                if (res.ok) {
                    toast.success('Assignment updated successfully')
                } else {
                    throw new Error('Failed to update assignment')
                }
            } else {
                const res = await assignmentsApi.create(classroomId, payload, token)
                if (res.ok && res.data) {
                    toast.success('Assignment created successfully')
                } else {
                    throw new Error('Failed to create assignment')
                }
            }

            resetForm()
            setIsModalOpen(false)
            fetchAssignments()
        } catch (error) {
            console.error('Failed to save assignment:', error)
            toast.error(error instanceof Error ? error.message : 'Error saving assignment')
        } finally {
            setIsSubmitting(false)
        }
    }

    const resetForm = () => {
        setEditingAssignment(null)
        setGeneratedPreview(null)
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
        setSelectedBatchIds([])
        setIsGenerating(false)
    }

    const getActiveHoneypotCount = (a: Assignment) => {
        if (a.mode === 'reactive') return 0
        let count = 0
        if (a.honeypot_hidden_instruction) count++
        if (a.honeypot_zero_width) count++
        if (a.honeypot_fake_fact) count++
        if (a.honeypot_sentiment_contradiction) count++
        return count
    }

    const toggleBatch = (batchId: string) => {
        setSelectedBatchIds(prev =>
            prev.includes(batchId)
                ? prev.filter(id => id !== batchId)
                : [...prev, batchId]
        )
    }

    // ── Reactive: Close & Analyze ──────────────────────────────────────────
    const handleAnalyze = async (assignmentId: string) => {
        setIsAnalyzing(assignmentId)
        try {
            toast.info('Running inter-student TF-IDF analysis...')
            const res = await reactiveApi.analyze(assignmentId, token)
            if (res.ok && res.data) {
                setAnalysisResults(res.data)
                setResultsModalAssignmentId(assignmentId)
                toast.success(`Analysis complete! ${res.data.total_submissions} submissions compared.`)
            }
        } catch (error) {
            toast.error(error instanceof Error ? error.message : 'Analysis failed')
        } finally {
            setIsAnalyzing(null)
        }
    }

    // ── Reactive: View Results ─────────────────────────────────────────────
    const handleViewResults = async (assignmentId: string) => {
        setIsLoadingResults(true)
        setResultsModalAssignmentId(assignmentId)
        try {
            const res = await reactiveApi.getResults(assignmentId, token)
            if (res.ok && Array.isArray(res.data)) {
                setReactiveResults(res.data)
            }
        } catch (error) {
            toast.error('Failed to load results')
        } finally {
            setIsLoadingResults(false)
        }
    }

    return (
        <section className={styles.section} style={{ marginTop: '4rem' }}>
            <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Assignments</h2>
                <button
                    className={styles.createBtn}
                    onClick={() => { resetForm(); setIsModalOpen(true) }}
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
                                <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                                    <span className={`${styles.difficultyBadge} ${styles[assignment.difficulty]}`}>
                                        {assignment.difficulty}
                                    </span>
                                    <button
                                        className={styles.editBtn}
                                        onClick={() => openEditModal(assignment)}
                                        title="Edit assignment"
                                    >
                                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>

                            {assignment.batch_ids && assignment.batch_ids.length > 0 && (
                                <div style={{ fontSize: '0.7rem', color: 'var(--muted)', marginBottom: '0.75rem', display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                                    <span style={{ fontWeight: 600 }}>Visible to:</span>
                                    {assignment.batch_ids.map(bid => {
                                        const b = batches.find(x => x.id === bid)
                                        return <span key={bid} style={{ background: '#f0f0eb', padding: '0.1rem 0.4rem', border: '1px solid #e0e0da' }}>{b?.name || 'Unknown'}</span>
                                    })}
                                </div>
                            )}

                            <p className={styles.assignmentDesc}>
                                {assignment.description || 'No description provided.'}
                            </p>

                            <div className={styles.assignmentMeta}>
                                <div className={styles.assignmentBadgeRow}>
                                    <span className={`${styles.modeBadge} ${assignment.mode === 'proactive' ? styles.modeProactive : styles.modeReactive}`}>
                                        {assignment.mode === 'proactive' ? '⚡ Proactive' : '⏱ Reactive'}
                                    </span>
                                    {getActiveHoneypotCount(assignment) > 0 && (
                                        <span className={styles.honeypotTag}>
                                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" /></svg>
                                            {getActiveHoneypotCount(assignment)} Traps
                                        </span>
                                    )}
                                </div>
                                {(assignment.enable_behavioral || assignment.enable_socratic) && (
                                    <div className={styles.detectionBadgeRow}>
                                        {assignment.enable_behavioral && <span className={styles.behavioralBadge}>Behavioral</span>}
                                        {assignment.enable_socratic && <span className={styles.socraticBadge}>Socrates Engine</span>}
                                    </div>
                                )}
                                {/* Reactive: Close & Analyze + View Results; Proactive: View Detailed Analytics */}
                                {assignment.mode === 'reactive' ? (
                                    <div style={{ display: 'flex', gap: '0.5rem' }}>
                                        <button
                                            className={styles.viewBtn}
                                            onClick={() => handleAnalyze(assignment.id)}
                                            disabled={isAnalyzing === assignment.id}
                                            style={{
                                                background: isAnalyzing === assignment.id ? '#f0f0eb' : '#fef3c7',
                                                color: '#78350f',
                                                borderColor: '#fcd34d',
                                            }}
                                        >
                                            {isAnalyzing === assignment.id ? 'Analyzing...' : '🔬 Close & Analyze'}
                                        </button>
                                        <button
                                            className={styles.viewBtn}
                                            onClick={() => handleViewResults(assignment.id)}
                                        >
                                            📊 View Results
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        className={styles.viewBtn}
                                        onClick={() => router.push(`/dashboard/classroom/${classroomId}/assignment/${assignment.id}/analytics`)}
                                    >
                                        View Detailed Analytics
                                    </button>
                                )}
                            </div>
                        </div>
                    ))
                ) : (
                    <div className={styles.noBatches}>
                        No assignments created yet. Prepare your first assignment to start monitoring integrity.
                    </div>
                )}
            </div>

            {/* ── Create/Edit Assignment Modal ─────────────────────────────────── */}
            {isModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
                    <div
                        className={styles.modal}
                        style={{ maxWidth: '700px', maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className={styles.modalTitle}>{editingAssignment ? 'Edit Assignment' : 'Configure Assignment'}</h3>

                        <button
                            type="button"
                            className={styles.aiGenBtn}
                            onClick={handleGenerateAI}
                            disabled={isGenerating || !topic}
                            title={!topic ? "Enter a topic first" : "Generate with AI"}
                        >
                            <svg
                                className={isGenerating ? styles.aiIconSpinning : styles.aiIcon}
                                viewBox="0 0 24 24"
                                fill="none"
                                stroke="currentColor"
                                strokeWidth="2"
                            >
                                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                            </svg>
                            {isGenerating ? 'Generating Content...' : 'Generate Full Data with Gen-AI'}
                        </button>

                        {generatedPreview && (
                            <div className={styles.generatedPreview}>
                                <div className={styles.previewHeader}>
                                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4" /><path d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z" /></svg>
                                    AI Generated — Review &amp; Edit Below
                                </div>

                                <div className={styles.previewTopicRow}>
                                    <span className={styles.previewLabel}>Topic</span>
                                    <span className={styles.previewTopic}>{generatedPreview.topic}</span>
                                    <span className={`${styles.difficultyBadge} ${styles[generatedPreview.difficulty as 'easy' | 'medium' | 'hard']}`}>
                                        {generatedPreview.difficulty}
                                    </span>
                                </div>

                                <div className={styles.previewDesc}>
                                    <span className={styles.previewLabel}>Description</span>
                                    <p>{generatedPreview.description}</p>
                                </div>
                            </div>
                        )}

                        <form onSubmit={handleSubmit}>
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
                                        <option value="reactive">Reactive (Upload & Analyze)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Mode-specific info banner */}
                            {mode === 'reactive' && (
                                <div style={{
                                    background: '#fffbeb',
                                    border: '1px solid #fcd34d',
                                    padding: '1rem 1.25rem',
                                    marginBottom: '1.5rem',
                                    display: 'flex',
                                    gap: '0.75rem',
                                    alignItems: 'flex-start',
                                }}>
                                    <span style={{ fontSize: '1.2rem' }}>⏱</span>
                                    <div>
                                        <div style={{
                                            fontFamily: 'var(--font-display)',
                                            fontSize: '0.75rem',
                                            fontWeight: 700,
                                            textTransform: 'uppercase' as const,
                                            letterSpacing: '0.08em',
                                            color: '#78350f',
                                            marginBottom: '0.3rem',
                                        }}>
                                            Reactive Mode
                                        </div>
                                        <div style={{
                                            fontFamily: 'var(--font-body)',
                                            fontSize: '0.8rem',
                                            color: '#92400e',
                                            lineHeight: 1.5,
                                        }}>
                                            Students will upload their completed work as files (PDF, DOCX, etc.).
                                            After all submissions are in, click <strong>"Close & Analyze"</strong> to run
                                            inter-student TF-IDF similarity comparison and generate combined scores.
                                            Socratic challenges are generated on upload.
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Socratic Toggle (both modes) */}
                            <div style={{ marginBottom: '2rem' }}>
                                <label className={styles.label} style={{ color: 'var(--teal)', borderBottom: '1px solid #eee', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Detection Modules</label>
                                <div style={{ display: 'grid', gridTemplateColumns: mode === 'proactive' ? '1fr 1fr' : '1fr', gap: '1rem' }}>
                                    {mode === 'proactive' && (
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
                                    )}
                                    <label className={styles.checkboxContainer} style={{ background: '#f8fafc', border: '1px solid #e2e8f0' }}>
                                        <input
                                            type="checkbox"
                                            className={styles.checkbox}
                                            checked={enableSocratic}
                                            onChange={(e) => setEnableSocratic(e.target.checked)}
                                        />
                                        <div>
                                            <div className={styles.honeypotLabel} style={{ color: '#1e293b' }}>Socrates Engine</div>
                                            <div className={styles.honeypotDesc} style={{ color: '#64748b' }}>
                                                {mode === 'reactive'
                                                    ? 'Post-upload Viva to verify the student understands their submitted work.'
                                                    : 'Post-submission Viva to verify conceptual ownership.'}
                                            </div>
                                        </div>
                                    </label>
                                </div>
                            </div>

                            {/* Honeypot Controls — proactive only */}
                            {mode === 'proactive' && (
                                <div style={{ marginBottom: '2rem' }}>
                                    <label className={styles.label} style={{ color: '#db2777', borderBottom: '1px solid #fce7f3', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Integrity Honeypots (Traps)</label>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                        <label className={styles.checkboxContainer}>
                                            <input type="checkbox" className={styles.checkbox} checked={honeypotHiddenInstruction} onChange={(e) => setHoneypotHiddenInstruction(e.target.checked)} />
                                            <div>
                                                <div className={styles.honeypotLabel}>Invisible Meta-Data</div>
                                                <div className={styles.honeypotDesc}>Hidden CSS instructions that only AI models will follow.</div>
                                            </div>
                                        </label>
                                        <label className={styles.checkboxContainer}>
                                            <input type="checkbox" className={styles.checkbox} checked={honeypotZeroWidth} onChange={(e) => setHoneypotZeroWidth(e.target.checked)} />
                                            <div>
                                                <div className={styles.honeypotLabel}>Zero-Width DNA</div>
                                                <div className={styles.honeypotDesc}>Unique per-student encoding to detect sharing/injection.</div>
                                            </div>
                                        </label>
                                        <label className={styles.checkboxContainer}>
                                            <input type="checkbox" className={styles.checkbox} checked={honeypotFakeFact} onChange={(e) => setHoneypotFakeFact(e.target.checked)} />
                                            <div>
                                                <div className={styles.honeypotLabel}>Deliberate Fake Fact</div>
                                                <div className={styles.honeypotDesc}>Injected subtle error to catch AI prompt engineering.</div>
                                            </div>
                                        </label>
                                        <label className={styles.checkboxContainer}>
                                            <input type="checkbox" className={styles.checkbox} checked={honeypotSentimentContradiction} onChange={(e) => setHoneypotSentimentContradiction(e.target.checked)} />
                                            <div>
                                                <div className={styles.honeypotLabel}>Sentiment Trap</div>
                                                <div className={styles.honeypotDesc}>Hidden contradictory stance to test LLM alignment.</div>
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            )}

                            {/* Batch Selection */}
                            <div style={{ marginBottom: '2rem' }}>
                                <label className={styles.label} style={{ color: '#6366f1', borderBottom: '1px solid #e0e7ff', paddingBottom: '0.5rem', marginBottom: '1rem' }}>Assign to Batches</label>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: '0.75rem', maxHeight: '150px', overflowY: 'auto', padding: '0.5rem' }}>
                                    {batches.length > 0 ? (
                                        batches.map(b => (
                                            <label key={b.id} className={styles.checkboxContainer} style={{ background: selectedBatchIds.includes(b.id) ? '#f5f3ff' : 'white', border: `1px solid ${selectedBatchIds.includes(b.id) ? '#6366f1' : 'var(--border-dark)'}`, padding: '0.5rem 0.75rem' }}>
                                                <input
                                                    type="checkbox"
                                                    className={styles.checkbox}
                                                    checked={selectedBatchIds.includes(b.id)}
                                                    onChange={() => toggleBatch(b.id)}
                                                    style={{ width: '16px', height: '16px' }}
                                                />
                                                <div style={{ flex: 1 }}>
                                                    <div className={styles.honeypotLabel} style={{ color: selectedBatchIds.includes(b.id) ? '#4338ca' : 'var(--ink)', fontSize: '0.75rem' }}>{b.name}</div>
                                                    <div className={styles.honeypotDesc} style={{ fontSize: '0.65rem' }}>{b.member_count || 0} Students</div>
                                                </div>
                                            </label>
                                        ))
                                    ) : (
                                        <p style={{ fontSize: '0.75rem', color: 'var(--muted)', fontStyle: 'italic' }}>No batches found. Create one first.</p>
                                    )}
                                </div>
                                <p style={{ fontSize: '0.7rem', color: 'var(--muted)', marginTop: '0.75rem' }}>
                                    If no batches are selected, the assignment will be visible to <strong>everyone</strong> in the classroom.
                                </p>
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
                                    {isSubmitting ? 'Saving...' : editingAssignment ? 'Save Changes' : 'Create Assignment'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Analysis Results Modal ──────────────────────────────────────── */}
            {resultsModalAssignmentId && (analysisResults || reactiveResults) && (
                <div className={styles.modalOverlay} onClick={() => { setResultsModalAssignmentId(null); setAnalysisResults(null); setReactiveResults(null) }}>
                    <div
                        className={styles.modal}
                        style={{ maxWidth: '850px', maxHeight: '90vh', overflowY: 'auto' }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className={styles.modalTitle}>
                            📊 Reactive Analysis Results
                        </h3>

                        {/* From analyze endpoint */}
                        {analysisResults && (
                            <>
                                <div style={{
                                    display: 'grid',
                                    gridTemplateColumns: '1fr 1fr',
                                    gap: '1rem',
                                    marginBottom: '2rem',
                                }}>
                                    <div style={{
                                        background: '#f0fdf4',
                                        border: '1px solid #86efac',
                                        padding: '1.25rem',
                                        textAlign: 'center',
                                    }}>
                                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, color: '#059669' }}>
                                            {analysisResults.total_submissions}
                                        </div>
                                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: '#064e3b' }}>
                                            Total Submissions
                                        </div>
                                    </div>
                                    <div style={{
                                        background: analysisResults.flagged_pairs.length > 0 ? '#fef2f2' : '#f0fdf4',
                                        border: `1px solid ${analysisResults.flagged_pairs.length > 0 ? '#fca5a5' : '#86efac'}`,
                                        padding: '1.25rem',
                                        textAlign: 'center',
                                    }}>
                                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '2rem', fontWeight: 700, color: analysisResults.flagged_pairs.length > 0 ? '#dc2626' : '#059669' }}>
                                            {analysisResults.flagged_pairs.length}
                                        </div>
                                        <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.1em', color: analysisResults.flagged_pairs.length > 0 ? '#991b1b' : '#064e3b' }}>
                                            Flagged Pairs (≥60% similarity)
                                        </div>
                                    </div>
                                </div>

                                {/* Flagged Pairs */}
                                {analysisResults.flagged_pairs.length > 0 && (
                                    <div style={{ marginBottom: '2rem' }}>
                                        <label className={styles.label} style={{ color: '#dc2626', borderBottom: '1px solid #fecaca', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                                            ⚠️ Flagged Similar Pairs
                                        </label>
                                        {analysisResults.flagged_pairs.map((pair, idx) => (
                                            <div key={idx} style={{
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                padding: '0.75rem 1rem',
                                                background: '#fef2f2',
                                                border: '1px solid #fecaca',
                                                marginBottom: '0.5rem',
                                                fontFamily: 'var(--font-body)',
                                                fontSize: '0.85rem',
                                            }}>
                                                <span>
                                                    Student <code style={{ background: '#fee2e2', padding: '0.1rem 0.3rem' }}>{pair.student_a.slice(0, 8)}…</code>
                                                    {' ↔ '}
                                                    Student <code style={{ background: '#fee2e2', padding: '0.1rem 0.3rem' }}>{pair.student_b.slice(0, 8)}…</code>
                                                </span>
                                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                                                    <span style={{
                                                        fontFamily: 'var(--font-display)',
                                                        fontWeight: 700,
                                                        color: '#dc2626',
                                                        fontSize: '1.1rem',
                                                    }}>
                                                        {(pair.similarity * 100).toFixed(1)}%
                                                    </span>
                                                    <span style={{
                                                        fontSize: '0.6rem',
                                                        fontWeight: 700,
                                                        textTransform: 'uppercase' as const,
                                                        letterSpacing: '0.05em',
                                                        padding: '0.1rem 0.4rem',
                                                        background: pair.method_signal === 'semantic' ? '#e0e7ff' : '#f0fdf4',
                                                        color: pair.method_signal === 'semantic' ? '#4338ca' : '#166534',
                                                        borderRadius: '4px',
                                                    }}>
                                                        {pair.method_signal}
                                                    </span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {/* Per-student results */}
                                <label className={styles.label} style={{ borderBottom: '1px solid #eee', paddingBottom: '0.5rem', marginBottom: '1rem' }}>
                                    Per-Student Scores
                                </label>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                    {analysisResults.results.map((r) => (
                                        <div key={r.submission_id} style={{
                                            display: 'grid',
                                            gridTemplateColumns: '2fr 1fr 1fr 1fr',
                                            gap: '1rem',
                                            padding: '0.75rem 1rem',
                                            background: 'white',
                                            border: '1px solid var(--border-dark)',
                                            alignItems: 'center',
                                            fontFamily: 'var(--font-body)',
                                            fontSize: '0.8rem',
                                        }}>
                                            <div>
                                                <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{r.filename || 'Unknown'}</div>
                                                <div style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>{r.student_id.slice(0, 8)}…</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: '0.15rem' }}>TF-IDF</div>
                                                <div style={{ fontWeight: 700, color: r.tfidf_originality < 60 ? '#dc2626' : '#059669' }}>{r.tfidf_originality.toFixed(1)}</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: '0.15rem' }}>Socratic</div>
                                                <div style={{ fontWeight: 700, color: r.socratic_score < 50 ? '#dc2626' : '#059669' }}>{r.socratic_score.toFixed(1)}</div>
                                            </div>
                                            <div style={{ textAlign: 'center' }}>
                                                <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--teal)', marginBottom: '0.15rem' }}>Ownership</div>
                                                <div style={{ fontWeight: 700, fontSize: '1.1rem', color: r.ownership_score < 50 ? '#dc2626' : 'var(--teal)' }}>{r.ownership_score.toFixed(1)}</div>
                                                <div style={{ fontSize: '0.55rem', fontWeight: 700, color: 'var(--muted)', marginTop: '0.1rem', textTransform: 'uppercase' as const }}>{r.similarity_method}</div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </>
                        )}

                        {/* From results endpoint */}
                        {reactiveResults && !analysisResults && (
                            <>
                                {isLoadingResults ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>Loading results...</div>
                                ) : reactiveResults.length === 0 ? (
                                    <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--muted)' }}>
                                        No submissions yet. Run "Close & Analyze" after students have submitted.
                                    </div>
                                ) : (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                                        {reactiveResults.map((r) => (
                                            <div key={r.submission_id} style={{
                                                display: 'grid',
                                                gridTemplateColumns: '2fr 1fr 1fr 1fr',
                                                gap: '1rem',
                                                padding: '0.75rem 1rem',
                                                background: 'white',
                                                border: '1px solid var(--border-dark)',
                                                alignItems: 'center',
                                                fontFamily: 'var(--font-body)',
                                                fontSize: '0.8rem',
                                            }}>
                                                <div>
                                                    <div style={{ fontWeight: 600, marginBottom: '0.2rem' }}>{r.student_name}</div>
                                                    <div style={{ color: 'var(--muted)', fontSize: '0.7rem' }}>{r.filename}</div>
                                                </div>
                                                {r.scores ? (
                                                    <>
                                                        <div style={{ textAlign: 'center' }}>
                                                            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: '0.15rem' }}>TF-IDF</div>
                                                            <div style={{ fontWeight: 700, color: r.scores.tfidf_originality < 60 ? '#dc2626' : '#059669' }}>{r.scores.tfidf_originality.toFixed(1)}</div>
                                                        </div>
                                                        <div style={{ textAlign: 'center' }}>
                                                            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--muted)', marginBottom: '0.15rem' }}>Socrates Engine</div>
                                                            <div style={{ fontWeight: 700, color: r.scores.socratic_score < 50 ? '#dc2626' : '#059669' }}>{r.scores.socratic_score.toFixed(1)}</div>
                                                        </div>
                                                        <div style={{ textAlign: 'center' }}>
                                                            <div style={{ fontFamily: 'var(--font-display)', fontSize: '0.65rem', fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: '0.06em', color: 'var(--teal)', marginBottom: '0.15rem' }}>Ownership</div>
                                                            <div style={{ fontWeight: 700, fontSize: '1.1rem', color: r.scores.ownership_score < 50 ? '#dc2626' : 'var(--teal)' }}>{r.scores.ownership_score.toFixed(1)}</div>
                                                        </div>
                                                    </>
                                                ) : (
                                                    <div style={{ gridColumn: 'span 3', textAlign: 'center', color: 'var(--muted)', fontSize: '0.75rem' }}>
                                                        Not yet analyzed — run "Close & Analyze"
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}

                        <div className={styles.modalActions} style={{ marginTop: '2rem' }}>
                            <button
                                type="button"
                                className={styles.submitBtn}
                                onClick={() => { setResultsModalAssignmentId(null); setAnalysisResults(null); setReactiveResults(null) }}
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </section>
    )
}
