'use client'
import { useEffect, useRef } from 'react'
import styles from './ScrollReveal.module.css'

export default function ScrollReveal({
    children,
    delay = 0,
}: {
    children: React.ReactNode
    delay?: number
}) {
    const ref = useRef<HTMLDivElement>(null)

    useEffect(() => {
        const el = ref.current
        if (!el) return
        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) el.classList.add(styles.visible)
            },
            { threshold: 0.1 }
        )
        observer.observe(el)
        return () => observer.disconnect()
    }, [])

    return (
        <div
            ref={ref}
            className={styles.reveal}
            style={{ transitionDelay: `${delay}s` }}
        >
            {children}
        </div>
    )
}
