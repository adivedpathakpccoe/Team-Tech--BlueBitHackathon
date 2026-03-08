import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import AssignmentWorkspace from './AssignmentWorkspace'
import styles from './assignment.module.css'

interface AssignmentPageProps {
    params: Promise<{ id: string }>
}

export default async function AssignmentPage({ params }: AssignmentPageProps) {
    const { id: classroomAssignmentId } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get('gs_access_token')?.value

    if (!token) {
        redirect('/auth/login')
    }

    return (
        <div className={`${styles.page} soberDashboard`}>
            <div className={styles.topbar}>
                <Link href="/dashboard" className={styles.brand}>
                    GYAAN<span className={styles.brandAccent}>SETU</span>
                </Link>
            </div>
            <div className={styles.content}>
                <Link href="/dashboard" className={styles.backLink}>
                    ← Back to Dashboard
                </Link>
                <AssignmentWorkspace classroomAssignmentId={classroomAssignmentId} token={token} />
            </div>
        </div>
    )
}
