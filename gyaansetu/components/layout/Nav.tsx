import Link from 'next/link'
import styles from './Nav.module.css'

export default function Nav() {
    return (
        <nav className={styles.nav}>
            <Link href="/" className={styles.logo}>
                GYAAN<span style={{ color: 'var(--red)' }}>SETU</span>
                <span className={styles.logoDot} />
            </Link>

            <div className={styles.links}>
                <Link href="#solutions" className={styles.link}>Solutions</Link>
                <Link href="#how" className={styles.link}>How It Works</Link>
                <Link href="#pricing" className={styles.link}>Pricing</Link>
                <Link href="#contact" className={styles.link}>Contact</Link>
            </div>

            <div className={styles.authButtons}>
                <Link href="/auth/login" className={styles.signInBtn}>
                    Sign In
                </Link>
                <Link href="/auth/signup" className={styles.signUpBtn}>
                    Sign Up
                </Link>
            </div>
        </nav>
    )
}
