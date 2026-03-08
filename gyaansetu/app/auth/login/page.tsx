'use client'
import { useState } from 'react'
import Link from 'next/link'
import { login } from '../actions'
import styles from '../auth.module.css'

export default function LoginPage() {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
        e.preventDefault()
        setLoading(true)
        setError(null)
        const formData = new FormData(e.currentTarget)
        const result = await login(formData)
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
                    Access<br />Intelligence
                </h1>
                <p className={styles.sub}>// Enter your credentials to proceed</p>

                {error && <div className={styles.error}>{error}</div>}

                <form className={styles.form} onSubmit={handleSubmit}>
                    <div className={styles.field}>
                        <label className={styles.label} htmlFor="email">Email Address</label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            placeholder="agent@institution.edu"
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
                            placeholder="••••••••••••"
                            className={styles.input}
                            required
                            autoComplete="current-password"
                        />
                    </div>

                    <button type="submit" className={styles.btn} disabled={loading}>
                        {loading ? (
                            <>Authenticating <span className={styles.loadingDot} /></>
                        ) : (
                            'Login — Enter Platform'
                        )}
                    </button>
                </form>

                <div className={styles.divider} />
                <p className={styles.switchText}>
                    No account?{' '}
                    <Link href="/auth/signup" className={styles.switchLink}>
                        Request Access
                    </Link>
                </p>
            </div>
        </div>
    )
}
