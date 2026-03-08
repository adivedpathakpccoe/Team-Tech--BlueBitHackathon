'use client'
import { useState } from 'react'
import SectionLabel from '@/components/ui/SectionLabel'
import PlanCard from '@/components/ui/PlanCard'
import ScrollReveal from '@/components/ui/ScrollReveal'
import styles from './PricingSection.module.css'

const plans = {
    monthly: [
        {
            tier: '// Tier 01',
            name: 'Observer',
            price: '$299',
            period: 'per month / per department',
            features: [
                'Up to 500 submissions/month',
                'LinguisticaAI™ basic detection',
                'PDF & DOCX support',
                'Single department access',
                'Email support (48h SLA)',
            ],
            featured: false,
            cta: 'Start Observer',
        },
        {
            tier: '// Tier 02',
            name: 'Sentinel',
            price: '$799',
            period: 'per month / institution-wide',
            features: [
                'Unlimited submissions',
                'All 5 intelligence modules',
                'FederatedIndex™ network access',
                'ProctorCore™ live proctoring',
                'API + LMS integration',
                'Priority support (4h SLA)',
                'Quarterly threat briefing',
            ],
            featured: true,
            cta: 'Deploy Sentinel',
        },
        {
            tier: '// Tier 03',
            name: 'Command',
            price: 'Custom',
            period: 'per contract / multi-institution',
            features: [
                'Multi-campus federated deployment',
                'Custom model fine-tuning',
                'Dedicated intelligence analyst',
                'On-premise deployment option',
                'SLA: 99.9% uptime guarantee',
                'White-label licensing',
            ],
            featured: false,
            cta: 'Contact Command',
        },
    ],
    annual: [
        {
            tier: '// Tier 01',
            name: 'Observer',
            price: '$239',
            period: 'per month, billed annually',
            features: [
                'Up to 500 submissions/month',
                'LinguisticaAI™ basic detection',
                'PDF & DOCX support',
                'Single department access',
                'Email support (48h SLA)',
            ],
            featured: false,
            cta: 'Start Observer',
        },
        {
            tier: '// Tier 02',
            name: 'Sentinel',
            price: '$639',
            period: 'per month, billed annually',
            features: [
                'Unlimited submissions',
                'All 5 intelligence modules',
                'FederatedIndex™ network access',
                'ProctorCore™ live proctoring',
                'API + LMS integration',
                'Priority support (4h SLA)',
                'Quarterly threat briefing',
            ],
            featured: true,
            cta: 'Deploy Sentinel',
        },
        {
            tier: '// Tier 03',
            name: 'Command',
            price: 'Custom',
            period: 'per contract / multi-institution',
            features: [
                'Multi-campus federated deployment',
                'Custom model fine-tuning',
                'Dedicated intelligence analyst',
                'On-premise deployment option',
                'SLA: 99.9% uptime guarantee',
                'White-label licensing',
            ],
            featured: false,
            cta: 'Contact Command',
        },
    ],
}

export default function PricingSection() {
    const [billing, setBilling] = useState<'monthly' | 'annual'>('monthly')

    return (
        <section className={styles.section} id="pricing">
            <div className={styles.header}>
                <SectionLabel text="Clearance Levels" />
                <h2 className={styles.title}>
                    Access<br />Tiers
                </h2>
                <p className={styles.desc}>
                    Institutional access is tiered by operational scope. All plans include
                    full data sovereignty and compliance documentation.
                </p>

                <div className={styles.toggle}>
                    <button
                        className={`${styles.toggleBtn} ${billing === 'monthly' ? styles.active : ''}`}
                        onClick={() => setBilling('monthly')}
                    >
                        Monthly
                    </button>
                    <button
                        className={`${styles.toggleBtn} ${billing === 'annual' ? styles.active : ''}`}
                        onClick={() => setBilling('annual')}
                    >
                        Annual <span className={styles.save}>Save 20%</span>
                    </button>
                </div>
            </div>

            <div className={styles.grid}>
                {plans[billing].map((p, i) => (
                    <ScrollReveal key={i} delay={i * 0.08}>
                        <PlanCard
                            tier={p.tier}
                            name={p.name}
                            price={p.price}
                            period={p.period}
                            features={p.features}
                            featured={p.featured}
                            cta={p.cta}
                        />
                    </ScrollReveal>
                ))}
            </div>
        </section>
    )
}
