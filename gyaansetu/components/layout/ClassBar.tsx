import styles from './ClassBar.module.css'

export default function ClassBar() {
    return (
        <div className={styles.bar}>
            <p className={styles.text}>
                <span>◆ CLASSIFIED</span>
                <span className={styles.sep}>◆</span>
                <span>ACADEMIC INTEGRITY INTELLIGENCE — GYAANSETU PLATFORM</span>
                <span className={styles.sep}>◆</span>
                <span>CLEARANCE LEVEL: INSTITUTIONAL</span>
                <span className={styles.sep}>◆</span>
                <span>REAL-TIME THREAT MONITORING ACTIVE</span>
            </p>
        </div>
    )
}
