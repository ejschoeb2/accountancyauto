"use client";

import { PricingSlider } from "@/components/pricing-slider";

export const PricingSection = () => {
  return (
    <section id="pricing" className="py-20 lg:py-28">
      <PricingSlider defaultClients={10} />
    </section>
  );
};
