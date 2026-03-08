import Link from 'next/link'
import styles from './Hero.module.css'

export default function Hero() {
    return (
        <section className={styles.hero}>
            <div className={styles.watermark}>GYAANSETU</div>

            <div className={styles.eyebrow}>
                <span className={styles.eyebrowLine} />
                SECURE ACADEMIC INFRASTRUCTURE — GEN-2026.04
            </div>

            <h1 className={styles.headline}>
                Academic<br />Trust<br />Re-Imagined.
            </h1>

            <p className={styles.subheadline}>
                Integrity as a Service.
            </p>

            <p className={styles.desc}>
                GYAANSETU is a high-fidelity academic integrity intelligence system —
                authenticating submissions through authorship fingerprinting, semantic coherence,
                and proctoring biometrics. Comprehensive trust for the AI era.
            </p>

            <div className={styles.actions}>
                <Link href="/auth/signup" className={styles.btnPrimary}>
                    Get Started Free
                </Link>
                <Link href="/auth/login" className={styles.btnGhost}>
                    Sign In →
                </Link>
            </div>

            <div className={styles.statusBadge} style={{ marginTop: '3rem' }}>
                <span className={styles.dot} />
                REAL-TIME MONITORING — 4,200+ INSTITUTIONS PROTECTED
            </div>
        </section>
    )
}
