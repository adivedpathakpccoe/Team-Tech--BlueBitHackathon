import styles from './SectionLabel.module.css'

export default function SectionLabel({ text }: { text: string }) {
    return <span className={styles.label}>// {text}</span>
}
