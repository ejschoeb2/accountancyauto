import { MarketingNav } from "@/components/marketing/nav";
import { HeroSection } from "@/components/marketing/hero-section";
import { FeaturesSection } from "@/components/marketing/features-section";
import { PricingSection } from "@/components/marketing/pricing-section";
import { ComparisonSection } from "@/components/marketing/comparison-section";
import { FaqSection } from "@/components/marketing/faq-section";
import { FooterSection } from "@/components/marketing/footer-section";

export default function MarketingPage() {
  return (
    <main className="min-h-screen scroll-smooth">
      <MarketingNav />
      <HeroSection />
      <FeaturesSection />
      <PricingSection />
      <ComparisonSection />
      <FaqSection />
      <FooterSection />
    </main>
  );
}
