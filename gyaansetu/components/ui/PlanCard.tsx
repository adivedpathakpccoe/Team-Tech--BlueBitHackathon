import Link from 'next/link'
import styles from './PlanCard.module.css'

interface PlanCardProps {
    tier: string
    name: string
    price: string
    period: string
    features: string[]
    featured?: boolean
    cta: string
}

export default function PlanCard({
    tier,
    name,
    price,
    period,
    features,
    featured = false,
    cta,
}: PlanCardProps) {
    return (
        <div className={`${styles.plan} ${featured ? styles.planFeatured : ''}`}>
            {featured && <span className={styles.ribbon}>Most Popular</span>}
            <div className={styles.tier}>{tier}</div>
            <div className={`${styles.name} ${featured ? styles.nameFeatured : ''}`}>{name}</div>
            <div className={`${styles.price} ${featured ? styles.priceFeatured : ''}`}>{price}</div>
            <div className={`${styles.period} ${featured ? styles.periodFeatured : ''}`}>{period}</div>
            <div className={`${styles.divider} ${featured ? styles.dividerFeatured : ''}`} />
            <ul className={styles.features}>
                {features.map((f, i) => (
                    <li key={i} className={`${styles.feature} ${featured ? styles.featureFeatured : ''}`}>
                        <span className={styles.check}>✓</span>
                        {f}
                    </li>
                ))}
            </ul>
            <Link
                href="#contact"
                className={`${styles.btn} ${featured ? styles.btnFeatured : ''}`}
            >
                {cta}
            </Link>
        </div>
    )
}
