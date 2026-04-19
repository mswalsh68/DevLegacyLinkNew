import Navbar from '../_components/Navbar'
import Hero from '../_components/Hero'
import Problem from '../_components/Problem'
import HowItWorks from '../_components/HowItWorks'
import Features from '../_components/Features'
import WhoItsFor from '../_components/WhoItsFor'
import ContactCTA from '../_components/ContactCTA'
import Footer from '../_components/Footer'

export default function MarketingHome() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <Problem />
        <HowItWorks />
        <Features />
        <WhoItsFor />
        <ContactCTA />
      </main>
      <Footer />
    </>
  )
}
