import styles from './HowStep.module.css'

interface HowStepProps {
    index: number
    title: string
    body: string
}

export default function HowStep({ index, title, body }: HowStepProps) {
    return (
        <div className={styles.step}>
            <span className={styles.ghost}>{String(index + 1).padStart(2, '0')}</span>
            <div className={styles.num}>
                STEP {String(index + 1).padStart(2, '0')}
                <span className={styles.numLine} />
            </div>
            <h3 className={styles.title}>{title}</h3>
            <p className={styles.body}>{body}</p>
        </div>
    )
}
