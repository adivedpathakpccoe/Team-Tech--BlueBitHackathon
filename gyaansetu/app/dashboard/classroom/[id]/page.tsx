import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { classroomsApi } from '@/lib/api'
import styles from './classroom.module.css'
import BatchSection from './BatchSection'

interface ClassroomPageProps {
    params: Promise<{ id: string }>
}

export default async function ClassroomPage({ params }: ClassroomPageProps) {
    const { id: classroomId } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get('gs_access_token')?.value

    if (!token) {
        redirect('/auth/login')
    }

    let classroom = null
    try {
        const res = await classroomsApi.get(classroomId, token)
        if (res.ok) {
            classroom = res.data as any
        }
    } catch (error) {
        console.error('Failed to fetch classroom:', error)
        // If not found or unauthorized, redirect back to dashboard
        redirect('/dashboard')
    }

    if (!classroom) {
        redirect('/dashboard')
    }

    return (
        <div className={`${styles.page} soberDashboard`}>
            {/* Topbar Re-use */}
            <div className={styles.topbar}>
                <Link href="/dashboard" className={styles.dashBrand}>
                    GYAAN<span className={styles.dashBrandAccent}>SETU</span>
                </Link>
                <div className={styles.userInfo}>
                    {/* User info logic can be added here if needed, 
                        but for now let's keep it simple */}
                </div>
            </div>

            <div className={styles.content}>
                <Link href="/dashboard" className={styles.backLink}>
                    ← Back to Dashboard
                </Link>

                <header className={styles.classroomHeader}>
                    <h1 className={styles.title}>{classroom.name}</h1>
                    {classroom.description && (
                        <p className={styles.desc}>{classroom.description}</p>
                    )}
                </header>

                <BatchSection classroomId={classroomId} token={token} />
            </div>
        </div>
    )
}
