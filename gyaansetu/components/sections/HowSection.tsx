import SectionLabel from '@/components/ui/SectionLabel'
import HowStep from '@/components/ui/HowStep'
import ScrollReveal from '@/components/ui/ScrollReveal'
import styles from './HowSection.module.css'

const steps = [
    {
        title: 'Institutional Onboarding',
        body: 'Secure API integration with your LMS in under 48 hours. Zero student-side configuration required. FERPA & GDPR-compliant data handling from day one.',
    },
    {
        title: 'Submission Ingestion',
        body: 'Every submitted artifact — document, code, media — is processed through our multi-modal pipeline. Metadata extraction, behavioral fingerprinting, and corpus indexing occur in parallel.',
    },
    {
        title: 'Multi-Layer Analysis',
        body: 'All five intelligence modules execute concurrently. LinguisticaAI™, FederatedIndex™, ProctorCore™, ForensicLens™, and ContextGraph™ generate a composite integrity score.',
    },
    {
        title: 'Actionable Intelligence Report',
        body: 'Educators receive a classified dossier: flagged vectors, confidence intervals, evidence chains, and recommended adjudication actions — ready for institutional review.',
    },
]

export default function HowSection() {
    return (
        <section className={styles.section} id="how">
            <div className={styles.header}>
                <SectionLabel text="Operational Protocol" />
                <h2 className={styles.title}>
                    How It<br />Works
                </h2>
                <p className={styles.desc}>
                    From submission to verdict in under a second. The GYAANSETU pipeline is engineered
                    for institutional scale — handling thousands of concurrent submissions without latency.
                </p>
            </div>
            <div className={styles.grid}>
                {steps.map((s, i) => (
                    <ScrollReveal key={i} delay={i * 0.08}>
                        <HowStep index={i} title={s.title} body={s.body} />
                    </ScrollReveal>
                ))}
            </div>
        </section>
    )
}
