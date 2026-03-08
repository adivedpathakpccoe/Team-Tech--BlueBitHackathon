import ClassBar from '@/components/layout/ClassBar'
import Nav from '@/components/layout/Nav'
import Footer from '@/components/layout/Footer'

// Landing page layout — wraps only the root '/' page
export default function LandingLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            <ClassBar />
            <Nav />
            {children}
            <Footer />
        </>
    )
}
