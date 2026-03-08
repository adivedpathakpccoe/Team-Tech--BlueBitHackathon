'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { classroomsApi } from '@/lib/api'
import styles from './dashboard.module.css'

interface Classroom {
    id: string
    name: string
    description: string | null
    owner_id: string
}

export default function ClassroomSection({ token }: { token: string }) {
    const [classrooms, setClassrooms] = useState<Classroom[]>([])
    const [isModalOpen, setIsModalOpen] = useState(false)
    const [name, setName] = useState('')
    const [description, setDescription] = useState('')
    const [isLoading, setIsLoading] = useState(true)
    const [isSubmitting, setIsSubmitting] = useState(false)
    const router = useRouter()

    useEffect(() => {
        fetchClassrooms()
    }, [token])

    const fetchClassrooms = async () => {
        try {
            const res = await classroomsApi.list(token)
            if (res.success && Array.isArray(res.data)) {
                setClassrooms(res.data)
            }
        } catch (error) {
            console.error('Failed to fetch classrooms:', error)
        } finally {
            setIsLoading(false)
        }
    }

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault()
        if (!name.trim() || isSubmitting) return

        setIsSubmitting(true)
        try {
            const res = await classroomsApi.create({ name, description }, token)
            if (res.success) {
                setName('')
                setDescription('')
                setIsModalOpen(false)
                fetchClassrooms()
            }
        } catch (error) {
            console.error('Failed to create classroom:', error)
            alert('Error creating classroom. Please try again.')
        } finally {
            setIsSubmitting(false)
        }
    }

    return (
        <section className={styles.classroomSection}>
            <div className={styles.sectionHeader}>
                <h2 className={styles.sectionTitle}>Your Classrooms</h2>
                <button
                    className={styles.createBtn}
                    onClick={() => setIsModalOpen(true)}
                >
                    + Create Classroom
                </button>
            </div>

            <div className={styles.cards}>
                {isLoading ? (
                    <div className={styles.noClassrooms}>Loading classrooms...</div>
                ) : classrooms.length > 0 ? (
                    classrooms.map((cls) => (
                        <div
                            key={cls.id}
                            className={`${styles.card} ${styles.classroomCard}`}
                            onClick={() => router.push(`/dashboard/classroom/${cls.id}`)}
                        >
                            <span className={`${styles.cardTag} ${styles.cardTagPrimary}`}>
                                Classroom
                            </span>
                            <div className={styles.cardTitle}>{cls.name}</div>
                            <p className={styles.cardDesc}>
                                {cls.description || 'No description provided.'}
                            </p>
                        </div>
                    ))
                ) : (
                    <div className={styles.noClassrooms}>
                        No classrooms found. Create your first one to get started.
                    </div>
                )}
            </div>

            {isModalOpen && (
                <div className={styles.modalOverlay} onClick={() => setIsModalOpen(false)}>
                    <div
                        className={styles.modal}
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className={styles.modalTitle}>New Classroom</h3>
                        <form onSubmit={handleCreate}>
                            <div className={styles.formGroup}>
                                <label className={styles.label}>Classroom Name</label>
                                <input
                                    type="text"
                                    className={styles.input}
                                    placeholder="e.g. CS101 - Introduction to Computer Science"
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
                                    placeholder="Provide a brief overview of the classroom..."
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
                                    {isSubmitting ? 'Creating...' : 'Create Classroom'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </section>
    )
}
