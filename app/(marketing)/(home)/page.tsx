import Navbar       from '../_components/Navbar'
import Hero         from '../_components/Hero'
import ScreenshotHero from '../_components/ScreenshotHero'
import Problem      from '../_components/Problem'
import HowItWorks   from '../_components/HowItWorks'
import Features     from '../_components/Features'
import Screenshots  from '../_components/Screenshots'
import WhoItsFor    from '../_components/WhoItsFor'
import FounderStory from '../_components/FounderStory'
import SportsTicker from '../_components/SportsTicker'
import Plans        from '../_components/Plans'
import CTABand      from '../_components/CTABand'
import ContactCTA   from '../_components/ContactCTA'
import Footer       from '../_components/Footer'

export default function MarketingHome() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <ScreenshotHero />
        <Problem />
        <HowItWorks />
        <Features />
        <Screenshots />
        <WhoItsFor />
        <FounderStory />
        <SportsTicker />
        <Plans />
        <CTABand />
        <ContactCTA />
      </main>
      <Footer />
    </>
  )
}
