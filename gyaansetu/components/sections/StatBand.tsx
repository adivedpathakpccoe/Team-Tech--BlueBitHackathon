import styles from './StatBand.module.css'

const stats = [
    { num: '94', accent: '%', label: 'AI-generated content\ndetection accuracy' },
    { num: '2.1', accent: 'M+', label: 'Submissions analyzed\nper academic year' },
    { num: '58', accent: '%', label: 'Rise in AI-assisted\nacademic fraud (2024)' },
    { num: '0.3', accent: 's', label: 'Real-time flagging\nlatency average' },
]

export default function StatBand() {
    return (
        <div className={styles.band}>
            {stats.map((s, i) => (
                <div key={i} className={styles.stat}>
                    <div className={styles.num}>
                        {s.num}<span className={styles.accent}>{s.accent}</span>
                    </div>
                    <div className={styles.label}>{s.label}</div>
                </div>
            ))}
        </div>
    )
}
