'use client'
import { useState } from 'react'
import Link from 'next/link'
import { signup } from '../actions'
import styles from '../auth.module.css'

export default function SignupPage() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [role, setRole] = useState<'teacher' | 'student'>('student')

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setError(null)
        const formData = new FormData(e.currentTarget)
        formData.set('role', role)
        const result = await signup(formData)
        if (result?.error) {
            setError(result.error)
            setLoading(false)
        }
    }

    return (
        <div className={styles.page}>
            <div className={styles.card}>
                <div className={styles.cardLabel} />

                <div className={styles.brand}>
                    GYAAN<span className={styles.brandAccent}>SETU</span>
                </div>

                <h1 className={styles.heading}>
                    Register<br />Access
                </h1>
                <p className={styles.sub}>// Create your institutional account</p>

                {error && <div className={styles.error}>{error}</div>}

                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.field}>
                        <label className={styles.label}>Select Role</label>
                        <div className={styles.roleGrid}>
                            <button
                                type="button"
                                className={`${styles.roleOption} ${role === 'teacher' ? styles.roleOptionActive : ''}`}
                                onClick={() => setRole('teacher')}
                            >
                                <span className={styles.roleTitle}>Educator</span>
                                <span className={styles.roleDesc}>Create &amp; manage assignments</span>
                            </button>
                            <button
                                type="button"
                                className={`${styles.roleOption} ${role === 'student' ? styles.roleOptionActive : ''}`}
                                onClick={() => setRole('student')}
                            >
                                <span className={styles.roleTitle}>Student</span>
                                <span className={styles.roleDesc}>Submit &amp; verify work</span>
                            </button>
                        </div>
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="name">Full Name</label>
                        <input
                            id="name"
                            name="name"
                            type="text"
                            placeholder="Your full name"
                            className={styles.input}
                            required
                            autoComplete="name"
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="email">Email Address</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="you@institution.edu"
                            className={styles.input}
                            required
                            autoComplete="email"
                        />
                    </div>

                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="password">Password</label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            placeholder="Min. 8 characters"
                            className={styles.input}
                            required
                            minLength={8}
                            autoComplete="new-password"
                        />
                    </div>

                    <button type="submit" className={styles.btn} disabled={loading}>
                        {loading ? (
                            <>Creating Account <span className={styles.loadingDot} /></>
                        ) : (
                            `Register as ${role === 'teacher' ? 'Educator' : 'Student'}`
                        )}
                    </button>
                </form>

                <div className={styles.divider} />
                <p className={styles.switchText}>
                    Already have access?{' '}
                    <Link href="/auth/login" className={styles.switchLink}>
                        Login
                    </Link>
                </p>
            </div>
        </div>
    )
}
