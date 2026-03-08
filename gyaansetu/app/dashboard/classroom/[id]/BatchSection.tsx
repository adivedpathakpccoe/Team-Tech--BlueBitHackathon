'use client'

import { useState, useEffect } from 'react'
import { classroomsApi } from '@/lib/api'
import styles from './classroom.module.css'
import { toast } from 'sonner'

interface Batch {
    id: string
    name: string
    description: string | null
    join_code: string
    member_count?: number
}

export default function BatchSection({ classroomId, token }: { classroomId: string, token: string }) {
    const [batches, setBatches] = useState<Batch[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)

    const copyToClipboard = (text: string, label: string) => {
        navigator.clipboard.writeText(text)
        toast.success(`${label} copied to clipboard`)
    }

    useEffect(() => {
        fetchBatches()
    }, [classroomId, token])

    const fetchBatches = async () => {
        try {
            const res = await classroomsApi.listBatches(classroomId, token)
            if (res.ok && Array.isArray(res.data)) {
                setBatches(res.data)
            }
        } catch (error) {
            console.error('Failed to fetch batches:', error)
            toast.error('Failed to load batches')
        } finally {
            setIsLoading(false)
        }
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim() || isSubmitting) return

        setIsSubmitting(true)
        try {
            const res = await classroomsApi.createBatch(classroomId, { name, description }, token)
            if (res.ok) {
                setName('')
                setDescription('')
                setIsModalOpen(false)
                toast.success('Batch created successfully')
                fetchBatches()
            }
        } catch (error) {
            console.error('Failed to create batch:', error)
            toast.error(error instanceof Error ? error.message : 'Error creating batch')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <section className={styles.section}>
            <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Batches</h2>
                <button
                    className={styles.createBtn}
                    onClick={() => setIsModalOpen(true)}
                >
                    + Create Batch
                </button>
            </div>

            <div className={styles.batchGrid}>
                {isLoading ? (
                    <div className={styles.noBatches}>Loading batches...</div>
                ) : batches.length > 0 ? (
                    batches.map((batch) => (
                        <div key={batch.id} className={styles.batchCard}>
                            <h3 className={styles.batchTitle}>{batch.name}</h3>
                            <p className={styles.batchDesc}>
                                {batch.description || 'No description provided.'}
                            </p>
                            <div className={styles.batchMeta}>
                                <div
                                    className={styles.joinCode}
                                    onClick={() => copyToClipboard(batch.join_code, 'Join code')}
                                    title="Click to copy join code"
                                >
                                    <span className={styles.joinLabel}>Join Code:</span>
                                    <div className={styles.codeWrapper}>
                                        <span className={styles.codeValue}>{batch.join_code}</span>
                                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={styles.copyIcon}><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                                    </div>
                                </div>
                                <div className={styles.memberCount}>
                                    <span className={styles.memberIndicator} />
                                    {batch.member_count ?? 0} Students Enrolled
                                </div>
                            </div>
                        </div>
                    ))
                ) : (
                    <div className={styles.noBatches}>
                        No batches created yet. Create one to allow students to join.
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
                    <div
                        className={styles.modal}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className={styles.modalTitle}>New Batch</h3>
                        <form onSubmit={handleCreate}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Batch Name</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="e.g. Fall 2024 - Morning Section"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Description</label>
                                <textarea
                                    className={styles.textarea}
                                    placeholder="Optional description..."
                                    value={description}
                                    onChange={(e) => setDescription(e.target.value)}
                                />
                            </div>
                            <div className={styles.modalActions}>
                                <button
                                    type="button"
                                    className={styles.cancelBtn}
                                    onClick={() => setIsModalOpen(false)}
                                    disabled={isSubmitting}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className={styles.submitBtn}
                                    disabled={isSubmitting || !name.trim()}
                                >
                                    {isSubmitting ? 'Creating...' : 'Create Batch'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    )
}
