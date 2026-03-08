// Dashboard has its own full-page layout — suppress root ClassBar/Nav/Footer
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
