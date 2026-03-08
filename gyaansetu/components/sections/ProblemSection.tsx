import SectionLabel from '@/components/ui/SectionLabel'
import ProblemCard from '@/components/ui/ProblemCard'
import ScrollReveal from '@/components/ui/ScrollReveal'
import styles from './ProblemSection.module.css'

const problems = [
    {
        tag: 'THREAT ALPHA',
        title: 'AI Content Generation',
        body: 'Students deploy GPT-class models to produce undetectable essays, code, and research. Existing systems rely on surface-level heuristics that fail to model linguistic topology.',
    },
    {
        tag: 'THREAT BETA',
        title: 'Cross-Institutional Plagiarism',
        body: 'Submission databases are siloed. Identical or near-identical manuscripts pass undetected across institutional boundaries — a systemic blind spot exploited at scale.',
    },
    {
        tag: 'THREAT GAMMA',
        title: 'Proctoring Evasion',
        body: 'Advanced evasion techniques — second devices, OBS virtual cameras, screen mirroring — render conventional webcam-based proctoring ineffective without behavioral biometrics.',
    },
    {
        tag: 'THREAT DELTA',
        title: 'Identity Fraud',
        body: 'Contract cheating services operate openly. Ghost-writing networks and exam-taking mercenaries produce audit-proof submissions that leave no forensic trail in standard systems.',
    },
]

export default function ProblemSection() {
    return (
        <section className={styles.section} id="solutions">
            <div className={styles.header}>
                <SectionLabel text="Threat Assessment" />
                <h2 className={styles.title}>
                    The Four<br />Threat Vectors
                </h2>
                <p className={styles.desc}>
                    Academic integrity is under a coordinated, multi-vector assault. Understanding the threat
                    topology is the first step to deploying effective countermeasures.
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
