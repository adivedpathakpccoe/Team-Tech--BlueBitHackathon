import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import AnalyticsClient from './AnalyticsClient'

interface AnalyticsPageProps {
    params: Promise<{ id: string; assignmentId: string }>
}

export default async function AssignmentAnalyticsPage({ params }: AnalyticsPageProps) {
    const { id: classroomId, assignmentId } = await params
    const cookieStore = await cookies()
    const token = cookieStore.get('gs_access_token')?.value

    if (!token) {
        redirect('/auth/login')
    }

    return (
        <AnalyticsClient
            classroomId={classroomId}
            assignmentId={assignmentId}
            token={token}
        />
    )
}
