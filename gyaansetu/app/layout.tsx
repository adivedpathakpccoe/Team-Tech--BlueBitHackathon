import type { Metadata } from 'next'
import './globals.css'
import { oswald, courierPrime, playfairDisplay } from './fonts'

export const metadata: Metadata = {
  title: 'GYAANSETU — Academic Integrity Intelligence',
  description:
    'Multi-modal academic integrity system detecting plagiarism, AI content, proctoring violations, and cross-institutional fraud in real time.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${oswald.variable} ${courierPrime.variable} ${playfairDisplay.variable}`}
    >
      <body>{children}</body>
    </html>
  )
}

