"use client";

const tiers = [
  {
    name: "Sole Trader",
    price: 39,
    clientLimit: "Up to 40 clients",
    tagline: "For independent accountants managing a focused client portfolio.",
  },
  {
    name: "Practice",
    price: 89,
    clientLimit: "Up to 150 clients",
    tagline: "For growing practices with a broader range of clients and deadlines.",
  },
  {
    name: "Firm",
    price: 159,
    clientLimit: "Unlimited clients",
    tagline: "For established firms with no limits on scale.",
  },
] as const;

export const PricingSection = () => {
  return (
    <section id="pricing" className="py-20 lg:py-28">
      <div className="max-w-6xl mx-auto px-6">

        {/* Section header — mirrors features section exactly */}
        <div className="mb-16 lg:mb-20">
          <p className="text-[11px] font-semibold tracking-[0.25em] uppercase text-muted-foreground mb-5">
            Pricing
          </p>
          <h2 className="text-4xl lg:text-5xl font-bold text-foreground leading-[1.15] max-w-xl">
            One plan per practice size.<br className="hidden lg:block" /> No surprises, no add-ons.
          </h2>
        </div>

        {/* Pricing rows — same row pattern as feature rows */}
        <div>
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className="group relative overflow-hidden border-t border-border last:border-b"
            >
              {/* Background price — replaces the ordinal from the features section */}
              <span
                className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 font-bold leading-none select-none text-foreground opacity-[0.04] group-hover:opacity-[0.08] transition-opacity duration-500"
                style={{ fontSize: "clamp(5rem, 10vw, 8rem)" }}
                aria-hidden="true"
              >
                £{tier.price}
              </span>

              <div className="relative py-10 lg:py-12 grid grid-cols-1 lg:grid-cols-[260px_1fr_auto] gap-6 lg:gap-16 items-center">

                {/* Left: tier name + client limit (mirrors icon + title column) */}
                <div>
                  <h3 className="text-[17px] font-bold text-foreground tracking-tight">
                    {tier.name}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">{tier.clientLimit}</p>
                </div>

                {/* Middle: tagline (mirrors description column) */}
                <p className="text-muted-foreground leading-relaxed text-[15px]">
                  {tier.tagline}
                </p>

                {/* Right: price + CTA */}
                <div className="flex items-center gap-6 shrink-0">
                  <div>
                    <span className="text-3xl font-bold text-foreground tabular-nums">£{tier.price}</span>
                    <span className="text-sm text-muted-foreground ml-1">/mo</span>
                  </div>
                  <a
                    href="/onboarding"
                    className="inline-flex items-center justify-center rounded-lg bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-violet-700 transition-colors whitespace-nowrap"
                  >
                    Start Free Trial
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* VAT note */}
        <p className="text-sm text-muted-foreground mt-10">
          All prices exclude VAT.
        </p>

      </div>
    </section>
  );
};
