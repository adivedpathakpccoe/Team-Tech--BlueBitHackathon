import SectionLabel from '@/components/ui/SectionLabel'
import HowStep from '@/components/ui/HowStep'
import ScrollReveal from '@/components/ui/ScrollReveal'
import styles from './HowSection.module.css'

const steps = [
    {
        title: 'Institutional Integration',
        body: 'Secure API integration with your LMS in under 48 hours. Zero student-side configuration required. Compliant data handling from day one.',
    },
    {
        title: 'Data Processing',
        body: 'Every submitted artifact — document, code, media — is processed through our secure multi-modal pipeline in real-time.',
    },
    {
        title: 'Multi-Layer Verification',
        body: 'Concurrent intelligence modules generate a composite integrity score based on authorship, proctoring, and semantic analysis.',
    },
    {
        title: 'Comprehensive Reporting',
        body: 'Educators receive a detailed report: flagged vectors, confidence intervals, and evidence chains for final institutional review.',
    },
]

export default function HowSection() {
    return (
        <section className={styles.section} id="how">
            <div className={styles.header}>
                <SectionLabel text="System Architecture" />
                <h2 className={styles.title}>
                    How It<br />Works
                </h2>
                <p className={styles.desc}>
                    Built for speed and accuracy. The GYAANSETU pipeline handles thousands
                    of concurrent submissions without compromising on integrity.
                </p>
            </div>
            <div className={styles.grid}>
                {steps.map((s, i) => (
                    <ScrollReveal key={i} delay={i * 0.08}>
                        <HowStep index={i} title={s.title} body={s.body} showLine={i === 0 || i === 2} />
                    </ScrollReveal>
                ))}
            </div>
        </section>
    )
}
