import SectionLabel from '@/components/ui/SectionLabel'
import ProblemCard from '@/components/ui/ProblemCard'
import ScrollReveal from '@/components/ui/ScrollReveal'
import styles from './ProblemSection.module.css'

const problems = [
    {
        tag: 'VECTOR I',
        title: 'AI Content Generation',
        body: 'Students deploy GPT-class models to produce increasingly complex essays, code, and research. Standard detection methods fail to model the deep linguistic patterns of modern LLMs.',
    },
    {
        tag: 'VECTOR II',
        title: 'Cross-Institutional Reuse',
        body: 'Submission databases are often siloed. Identical manuscripts can pass undetected across institutional boundaries — a systemic blind spot in academic integrity.',
    },
    {
        tag: 'VECTOR III',
        title: 'Proctoring Evasion',
        body: 'Advanced evasion techniques — second devices and virtual cameras — render conventional proctoring ineffective without deep behavioral biometric analysis.',
    },
    {
        tag: 'VECTOR IV',
        title: 'Contract Fraud',
        body: 'Global contract cheating services produce customized submissions that leave no forensic trail in standard plagiarism systems, requiring multi-layered verification.',
    },
]

export default function ProblemSection() {
    return (
        <section className={styles.section} id="solutions">
            <div className={styles.header}>
                <SectionLabel text="Integrity Challenges" />
                <h2 className={styles.title}>
                    Core Research<br />Vectors
                </h2>
                <p className={styles.desc}>
                    Academic integrity faces a multi-dimensional challenge. Understanding these
                    underlying vectors is the first step toward building a sustainable culture of trust.
                </p>
            </div>
            <div className={styles.grid}>
                {problems.map((p, i) => (
                    <ScrollReveal key={i} delay={i * 0.08}>
                        <ProblemCard index={i} tag={p.tag} title={p.title} body={p.body} />
                    </ScrollReveal>
                ))}
            </div>
        </section>
    )
}
