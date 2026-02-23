"use client";

const tiers = [
  {
    name: "Sole Trader",
    price: 39,
    clientLimit: "Up to 40 clients",
    userLimit: "1 user",
  },
  {
    name: "Practice",
    price: 89,
    clientLimit: "Up to 150 clients",
    userLimit: "Up to 5 users",
  },
  {
    name: "Firm",
    price: 159,
    clientLimit: "Unlimited clients",
    userLimit: "Unlimited users",
  },
] as const;

export const PricingSection = () => {
  return (
    <section id="pricing" className="py-20 lg:py-24">
      <div className="max-w-6xl mx-auto px-6">

        {/* Section heading */}
        <div className="text-center mb-14">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground">
            Simple, Honest Pricing
          </h2>
          <p className="mt-4 text-lg text-muted-foreground max-w-xl mx-auto">
            One plan per practice size. No surprises, no add-ons.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="bg-white rounded-xl border border-border p-8 flex flex-col gap-6"
            >
              {/* Tier name */}
              <h3 className="text-xl font-bold text-foreground">{tier.name}</h3>

              {/* Price */}
              <div className="flex items-end gap-1">
                <span className="text-4xl font-bold text-foreground">
                  £{tier.price}
                </span>
                <span className="text-muted-foreground mb-1">/mo</span>
              </div>

              {/* Limits */}
              <div className="flex flex-col gap-1 text-sm text-muted-foreground">
                <span>{tier.clientLimit}</span>
                <span>{tier.userLimit}</span>
              </div>

              {/* CTA */}
              <a
                href="/onboarding"
                className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors mt-auto"
              >
                Start Free Trial
              </a>
            </div>
          ))}
        </div>

        {/* VAT note */}
        <p className="text-center text-sm text-muted-foreground mt-8">
          All prices exclude VAT.
        </p>

      </div>
    </section>
  );
};
