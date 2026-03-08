'use client'

import { useState, useEffect } from 'react'
import { classroomsApi } from '@/lib/api'
import styles from './classroom.module.css'

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

    useEffect(() => {
        fetchBatches()
    }, [classroomId, token])

    const fetchBatches = async () => {
        try {
            const res = await classroomsApi.listBatches(classroomId, token)
            if (res.success && Array.isArray(res.data)) {
                setBatches(res.data)
            }
        } catch (error) {
            console.error('Failed to fetch batches:', error)
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
            if (res.success) {
                setName('')
                setDescription('')
                setIsModalOpen(false)
                fetchBatches()
            }
        } catch (error) {
            console.error('Failed to create batch:', error)
            alert('Error creating batch. Please try again.')
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
                                <div className={styles.joinCode}>
                                    <span>Join Code:</span>
                                    <span className={styles.codeValue}>{batch.join_code}</span>
                                </div>
                                <div className={styles.memberCount}>
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
