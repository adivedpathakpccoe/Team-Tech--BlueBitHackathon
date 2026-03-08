import styles from './ProblemCard.module.css'

interface ProblemCardProps {
    index: number
    tag: string
    title: string
    body: string
}

export default function ProblemCard({ index, tag, title, body }: ProblemCardProps) {
    return (
        <div className={styles.card}>
            <span className={styles.ghost}>{String(index + 1).padStart(2, '0')}</span>
            <div className={styles.tag}>{tag}</div>
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.body}>{body}</p>
        </div>
    )
}
