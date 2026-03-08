import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { logout } from '@/app/auth/actions'
import { authApi, type AuthUser } from '@/lib/api'
import styles from './dashboard.module.css'

export default async function DashboardPage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('gs_access_token')?.value

    if (!token) {
        redirect('/auth/login')
    }

    let user: AuthUser | null = null
    try {
        const res = await authApi.me(token)
        user = res.data ?? null
    } catch {
        // Token is invalid / expired → force re-login
        redirect('/auth/login')
    }

    const name = user?.name ?? user?.email?.split('@')[0] ?? 'Agent'
    const role = user?.role ?? 'student'
    const isTeacher = role === 'teacher'

    const quickCards = isTeacher
        ? [
            { tag: 'Module Alpha', title: 'Create Assignment', desc: 'Configure a new assignment with Proactive or Reactive detection mode and inject honeypot traps.' },
            { tag: 'Module Beta', title: 'Review Submissions', desc: 'Analyze student submissions with behavioral scores, honeypot flags, and Socratic challenge results.' },
            { tag: 'Module Gamma', title: 'Integrity Dashboard', desc: 'Monitor ownership scores, risk levels, and evidence chains across all enrolled students.' },
        ]
        : [
            { tag: 'Module Alpha', title: 'My Assignments', desc: 'View active assignments in your enrolled courses. Submit work through the secure writing platform.' },
            { tag: 'Module Beta', title: 'Submit Work', desc: 'Upload a document or write directly in the monitored editor for your current assignment.' },
            { tag: 'Module Gamma', title: 'My Results', desc: 'Review feedback and ownership scores for your past submissions.' },
        ]

    return (
        <div className={styles.page}>
            {/* Topbar */}
            <div className={styles.topbar}>
                <div className={styles.dashBrand}>
                    GYAAN<span className={styles.dashBrandAccent}>SETU</span>
                </div>
                <div className={styles.userInfo}>
                    <div className={styles.userMeta}>
                        <div className={styles.userName}>{name}</div>
                        <div className={styles.userRole}>// {isTeacher ? 'Educator' : 'Student'} — Clearance Active</div>
                    </div>
                    <form action={logout}>
                        <button type="submit" className={styles.logoutBtn}>Log Out</button>
                    </form>
                </div>
            </div>

            {/* Content */}
            <div className={styles.content}>
                <div className={styles.greeting}>// Intelligence Briefing — Operational Status</div>
                <h1 className={styles.title}>
                    Welcome,<br />
                    <span className={styles.titleAccent}>{name}.</span>
                </h1>
                <p className={styles.desc}>
                    {isTeacher
                        ? 'Your educator dashboard is active. Create assignments, monitor submissions, and access integrity intelligence reports from here.'
                        : 'Your student workspace is ready. View your assignments, submit work, and track your verification results from here.'}
                </p>

                <div className={styles.cards}>
                    {quickCards.map((c, i) => (
                        <div key={i} className={styles.card}>
                            <span className={styles.cardTag}>{c.tag}</span>
                            <div className={styles.cardTitle}>{c.title}</div>
                            <p className={styles.cardDesc}>{c.desc}</p>
                        </div>
                    ))}
                </div>

                <div className={styles.status}>
                    <span className={styles.statusDot} />
                    System Operational — Session Authenticated
                </div>
            </div>
        </div>
    )
}
