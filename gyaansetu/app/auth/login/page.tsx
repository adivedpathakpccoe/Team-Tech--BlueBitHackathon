'use client'

import { useState, Suspense, useEffect } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { login } from '../actions'
import styles from '../auth.module.css'

const LoginForm = () => {
    const searchParams = useSearchParams()
    const [isSignupSuccess, setIsSignupSuccess] = useState(false)
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        if (searchParams.get('signup') === 'success') {
            setIsSignupSuccess(true)
        }
    }, [searchParams])

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

                {isSignupSuccess && (
                    <div className={styles.success}>
                        ✓ Account created. Please sign in below.
                    </div>
                )}

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

export default function LoginPage() {
    return (
        <Suspense fallback={null}>
            <LoginForm />
        </Suspense>
    )
}
