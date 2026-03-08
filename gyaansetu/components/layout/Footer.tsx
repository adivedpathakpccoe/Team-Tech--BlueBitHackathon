import Link from 'next/link'
import styles from './Footer.module.css'

export default function Footer() {
    return (
        <footer className={styles.footer} id="contact">
            <div className={styles.masthead}>
                <div>
                    <div className={styles.brand}>
                        GYAAN<span style={{ color: 'var(--red)' }}>SETU</span>
                    </div>
                    <div className={styles.brandSub}>// Academic Integrity Intelligence Platform</div>
                </div>

                <div className={styles.columns}>
                    <div>
                        <div className={styles.colTitle}>// Platform</div>
                        <div className={styles.colLinks}>
                            <Link href="#solutions" className={styles.colLink}>Solutions</Link>
                            <Link href="#how" className={styles.colLink}>How It Works</Link>
                            <Link href="#pricing" className={styles.colLink}>Pricing</Link>
                        </div>
                    </div>
                    <div>
                        <div className={styles.colTitle}>// Intelligence</div>
                        <div className={styles.colLinks}>
                            <Link href="#" className={styles.colLink}>LinguisticaAI™</Link>
                            <Link href="#" className={styles.colLink}>FederatedIndex™</Link>
                            <Link href="#" className={styles.colLink}>ProctorCore™</Link>
                        </div>
                    </div>
                    <div>
                        <div className={styles.colTitle}>// Legal</div>
                        <div className={styles.colLinks}>
                            <Link href="#" className={styles.colLink}>Privacy Policy</Link>
                            <Link href="#" className={styles.colLink}>Terms of Service</Link>
                            <Link href="#" className={styles.colLink}>Data Processing</Link>
                        </div>
                    </div>
                </div>
            </div>

            <div className={styles.bottom}>
                <p className={styles.copy}>
                    © 2026 GYAANSETU INTELLIGENCE SYSTEMS. ALL RIGHTS RESERVED.
                </p>
                <div className={styles.status}>
                    <span className={styles.statusDot} />
                    SYSTEM OPERATIONAL — ALL NODES ACTIVE
                </div>
            </div>
        </footer>
    )
}
