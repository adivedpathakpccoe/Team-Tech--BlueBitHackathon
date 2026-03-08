import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { logout } from '@/app/auth/actions'
import { authApi, classroomsApi, studentApi, type AuthUser } from '@/lib/api'
import styles from './dashboard.module.css'
import ClassroomSection from './ClassroomSection'
import StudentSection from './StudentSection'

export default async function DashboardPage() {
    const cookieStore = await cookies()
    const token = cookieStore.get('gs_access_token')?.value

    if (!token) {
        redirect('/auth/login')
    }

    // Fast JWT decode to determine role before hitting the DB
    let role = 'student'
    try {
        const payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64').toString())
        role = payload.user_metadata?.role ?? 'student'
    } catch { }
    const isTeacher = role === 'teacher'

    let user: AuthUser | null = null
    let initialData: any = null

    try {
        // Fetch user and initial section data in parallel for speed
        const [userRes, dataRes] = await Promise.all([
            authApi.me(token).catch(() => ({ data: null })),
            isTeacher
                ? classroomsApi.list(token).catch(() => ({ data: [] }))
                : studentApi.getMyBatches(token).catch(() => ({ data: [] }))
        ])

        user = userRes.data as AuthUser ?? null
        initialData = dataRes.data ?? []

        if (!user) throw new Error('Unauthorized')
    } catch (err) {
        console.error('[DASHBOARD ERROR]', err)
        redirect('/auth/signout')
    }

    const name = user?.name ?? user?.email?.split('@')[0] ?? 'Agent'

    const quickCards = isTeacher
        ? [
            { tag: 'Action', title: 'Create Assignment', desc: 'Configure a new assignment with Proactive or Reactive detection mode.', type: 'Primary' },
            { tag: 'Review', title: 'Review Submissions', desc: 'Analyze student submissions with behavioral scores and honeypot flags.', type: 'Activity' },
            { tag: 'Insights', title: 'Integrity Dashboard', desc: 'Monitor ownership scores, risk levels, and evidence chains.', type: 'Strategy' },
        ]
        : [
            { tag: 'Access', title: 'My Assignments', desc: 'View active assignments in your enrolled courses.', type: 'Primary' },
            { tag: 'Action', title: 'Submit Work', desc: 'Upload a document or write directly in the monitored editor.', type: 'Activity' },
            { tag: 'Stats', title: 'My Results', desc: 'Review feedback and ownership scores for your past submissions.', type: 'Strategy' },
        ]

    return (
        <div className={`${styles.page} soberDashboard`}>
            {/* Topbar */}
            <div className={styles.topbar}>
                <div className={styles.dashBrand}>
                    GYAAN<span className={styles.dashBrandAccent}>SETU</span>
                </div>
                <div className={styles.userInfo}>
                    <div className={styles.userMeta}>
                        <div className={styles.userName}>{name}</div>
                        <div className={styles.userRole}>{isTeacher ? 'Professor' : 'Student'} — Active Session</div>
                    </div>
                    <form action={logout}>
                        <button type="submit" className={styles.logoutBtn}>Sign Out</button>
                    </form>
                </div>
            </div>

            {/* Content */}
            <div className={styles.content}>
                <div className={styles.greeting}>Institutional Overview</div>

                <h1 className={styles.title}>
                    Welcome,<br />
                    <span className={styles.titleAccent}>{name}.</span>
                </h1>
                <p className={styles.desc}>
                    {isTeacher
                        ? 'Your educator workspace is active. Manage your courses, monitor submission integrity, and generate detailed reports from this central console.'
                        : 'Your student workspace is ready. Access your assignments and track your submission status.'}
                </p>

                {isTeacher ? (
                    <ClassroomSection token={token} initialClassrooms={initialData} />
                ) : (
                    <StudentSection token={token} initialBatches={initialData} />
                )}

                <div className={`${styles.cards} ${styles.quickCards}`}>
                    {quickCards.map((c, i) => (
                        <div key={i} className={styles.card}>
                            <span className={`${styles.cardTag} ${styles[`cardTag${c.type}`]}`}>
                                {c.tag}
                            </span>
                            <div className={styles.cardTitle}>{c.title}</div>
                            <p className={styles.cardDesc}>{c.desc}</p>
                        </div>
                    ))}
                </div>

                <div className={styles.status}>
                    <span className={styles.statusDot} />
                    Integrity Network: Online — All systems operational.
                </div>
            </div>
        </div>
    )
}
