import Hero from '@/components/sections/Hero'
import StatBand from '@/components/sections/StatBand'
import ProblemSection from '@/components/sections/ProblemSection'
import FeaturesSection from '@/components/sections/FeaturesSection'
import CalloutSection from '@/components/sections/CalloutSection'
import HowSection from '@/components/sections/HowSection'
import PricingSection from '@/components/sections/PricingSection'

export default function HomePage() {
  return (
    <main>
      <Hero />
      <StatBand />
      <ProblemSection />
      <FeaturesSection />
      <CalloutSection />
      <HowSection />
      <PricingSection />
    </main>
  )
}
