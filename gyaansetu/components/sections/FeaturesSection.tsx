import SectionLabel from '@/components/ui/SectionLabel'
import FeatureItem from '@/components/ui/FeatureItem'
import ScrollReveal from '@/components/ui/ScrollReveal'
import styles from './FeaturesSection.module.css'

const features = [
    {
        badge: 'LinguisticaAI™',
        name: 'Neural Authorship Fingerprinting',
        desc: 'Builds per-student linguistic topology models from authenticated writing samples. Flags statistical divergence in vocabulary, syntax complexity, and n-gram distributions.',
        metricNum: '94%',
        metricLabel: 'Detection Rate',
    },
    {
        badge: 'FederatedIndex™',
        name: 'Cross-Institutional Corpus Network',
        desc: 'Real-time deduplication against a privacy-preserving federated index spanning 4,200+ institutions. Catches inter-institutional submission reuse without raw data exposure.',
        metricNum: '4.2K+',
        metricLabel: 'Institutions',
    },
    {
        badge: 'ProctorCore™',
        name: 'Behavioral Biometric Proctoring',
        desc: 'Continuous identity verification via keystroke dynamics, mouse entropy, and gaze tracking. Detects session handover and virtual camera injection at the OS level.',
        metricNum: '99.1%',
        metricLabel: 'Uptime SLA',
    },
    {
        badge: 'ForensicLens™',
        name: 'Document Metadata Analysis',
        desc: 'Extracts embedded revision history, authoring timestamps, and font substitution artifacts from submitted documents to surface forensic inconsistencies.',
        metricNum: '0.3s',
        metricLabel: 'Avg. Latency',
    },
    {
        badge: 'ContextGraph™',
        name: 'Semantic Coherence Scoring',
        desc: 'Evaluates logical consistency, citation validity, and conceptual progression against course material to identify purchased or template-based submissions.',
        metricNum: '2.1M+',
        metricLabel: 'Analyzed/Year',
    },
]

export default function FeaturesSection() {
    return (
        <section className={styles.section}>
            <div className={styles.header}>
                <SectionLabel text="Core Intelligence Modules" />
                <h2 className={styles.title}>
                    Multi-Layered<br />Protection
                </h2>
                <p className={styles.desc}>
                    Our modular architecture combines independent verification layers to ensure
                    the highest standards of academic integrity.
                </p>
            </div>
            <div className={styles.list}>
                {features.map((f, i) => (
                    <ScrollReveal key={i} delay={i * 0.08}>
                        <FeatureItem
                            index={i}
                            badge={f.badge}
                            name={f.name}
                            desc={f.desc}
                            metricNum={f.metricNum}
                            metricLabel={f.metricLabel}
                        />
                    </ScrollReveal>
                ))}
            </div>
        </section>
    )
}
