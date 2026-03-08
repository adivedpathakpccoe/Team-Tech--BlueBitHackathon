import Link from 'next/link'
import styles from './CalloutSection.module.css'

export default function CalloutSection() {
    return (
        <section className={styles.section}>
            <div className={styles.watermark}>GYAANSETU</div>
            <div className={styles.inner}>
                <span className={styles.label}>// Field Report — 2026</span>
                <p className={styles.quote}>
                    &ldquo;58% of academic institutions report a{' '}
                    <span className={styles.accent}>statistically significant increase</span> in
                    AI-assisted submission fraud since 2023.&rdquo;
                </p>
                <p className={styles.source}>
                    — Global Academic Integrity Monitor, 2026 Annual Threat Assessment
                </p>
                <Link href="#pricing" className={styles.btn}>
                    Deploy GYAANSETU Now
                </Link>
            </div>
        </section>
    )
}
