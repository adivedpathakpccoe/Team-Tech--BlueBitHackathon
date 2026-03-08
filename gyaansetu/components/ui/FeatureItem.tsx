import styles from './FeatureItem.module.css'

interface FeatureItemProps {
    index: number
    badge: string
    name: string
    desc: string
    metricNum: string
    metricLabel: string
}

export default function FeatureItem({
    index,
    badge,
    name,
    desc,
    metricNum,
    metricLabel,
}: FeatureItemProps) {
    return (
        <div className={styles.item}>
            <div className={styles.num}>{String(index + 1).padStart(2, '0')}</div>
            <div className={styles.content}>
                <span className={styles.badge}>{badge}</span>
                <div className={styles.name}>{name}</div>
                <p className={styles.desc}>{desc}</p>
            </div>
            <div className={styles.divider} />
            <div className={styles.metric}>
                <div className={styles.metricNum}>{metricNum}</div>
                <div className={styles.metricLabel}>{metricLabel}</div>
            </div>
        </div>
    )
}
