import Link from 'next/link'
import styles from './Hero.module.css'

export default function Hero() {
    return (
        <section className={styles.hero}>
            <div className={styles.watermark}>GYAANSETU</div>

            <div className={styles.eyebrow}>
                <span className={styles.eyebrowLine} />
                INTELLIGENCE DOSSIER — REF: GS-2026-ALPHA
            </div>

            <h1 className={styles.headline}>
                Academic<br />Integrity<br />Re-Defined.
            </h1>

            <p className={styles.subheadline}>
                When the era of effortless deception ends.
            </p>

            <p className={styles.desc}>
                GYAANSETU is a multi-modal academic integrity intelligence system — detecting
                plagiarism, AI-generated content, proctoring violations, and cross-institutional
                fraud at the moment they occur. Not after. Now.
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
                LIVE THREAT MONITORING — 4,200+ INSTITUTIONS PROTECTED
            </div>
        </section>
    )
}
