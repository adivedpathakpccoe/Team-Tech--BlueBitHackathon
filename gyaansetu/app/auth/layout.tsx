// Auth pages have their own full-bleed layout — suppress root ClassBar/Nav/Footer
export default function AuthLayout({ children }: { children: React.ReactNode }) {
    return <>{children}</>
}
