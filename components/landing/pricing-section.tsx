"use client"

import { useEffect, useState } from "react"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import { Button } from "@/components/ui/button"
import { Check, Sparkles } from "lucide-react"
import { StripeCheckoutButton } from "@/components/stripe-checkout-button"
import { SUBSCRIPTION_PRICE_IDS } from "@/lib/stripe"

interface LandingPricingSectionProps {
  locale?: string;
}

export function LandingPricingSection({ locale }: LandingPricingSectionProps) {
  const t = useTranslations("pricing")
  const tLanding = useTranslations("landing")
  const { data: session } = useSession()
  const [hasTrialSubscription, setHasTrialSubscription] = useState(false)
  const [hasActiveProSubscription, setHasActiveProSubscription] = useState(false)
  const [hasActiveAnnualSubscription, setHasActiveAnnualSubscription] = useState(false)
  const [currentSubscriptionPlan, setCurrentSubscriptionPlan] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSubscriptionStatus = async () => {
      if (!session?.user) {
        setLoading(false)
        return
      }

      try {
        const response = await fetch('/api/user/subscription')
        if (response.ok) {
          const data = await response.json()
          setHasTrialSubscription(data.hasTrialSubscription || false)
          setCurrentSubscriptionPlan(data.subscriptionPlan || null)
          
          const now = new Date()
          const isActivePro = 
            data.subscriptionStatus === 'active' &&
            data.subscriptionPlan === 'pro' &&
            data.subscriptionCurrentPeriodEnd &&
            new Date(data.subscriptionCurrentPeriodEnd) > now
          
          setHasActiveProSubscription(isActivePro || false)

          const isActiveAnnual = 
            data.subscriptionStatus === 'active' &&
            data.subscriptionPlan === 'annual' &&
            data.subscriptionCurrentPeriodEnd &&
            new Date(data.subscriptionCurrentPeriodEnd) > now
          
          setHasActiveAnnualSubscription(isActiveAnnual || false)
        }
      } catch (error) {
        console.error('获取订阅状态失败:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchSubscriptionStatus()
  }, [session])

  const plans = [
    {
      name: t("trial.name"),
      price: t("trial.price"),
      description: t("trial.description"),
      features: [
        t("trial.features.period"),
        t("trial.features.points"),
        t("trial.features.maxUpload"),
        t("trial.features.twoModes"),
        t("trial.features.license"),
      ],
      cta: t("trial.cta"),
      popular: false,
      priceId: SUBSCRIPTION_PRICE_IDS.trial,
      planType: 'trial' as const,
      showOriginalPrice: false,
    },
    {
      name: t("annual.name"),
      price: t("annual.price"),
      originalPrice: t("annual.originalPrice"),
      description: t("annual.description"),
      features: [
        t("annual.features.period"),
        t("annual.features.points"),
        t("annual.features.maxUpload"),
        t("annual.features.twoModes"),
        t("annual.features.license"),
      ],
      cta: hasActiveAnnualSubscription ? t("annual.renew") : t("annual.cta"),
      popular: true,
      priceId: SUBSCRIPTION_PRICE_IDS.annual,
      planType: 'annual' as const,
      showOriginalPrice: true,
    },
    {
      name: t("pro.name"),
      price: t("pro.price"),
      originalPrice: t("pro.originalPrice"),
      description: t("pro.description"),
      features: [
        t("pro.features.period"),
        t("pro.features.points"),
        t("pro.features.maxUpload"),
        t("pro.features.twoModes"),
        t("pro.features.license"),
      ],
      cta: t("pro.cta"),
      popular: false,
      priceId: SUBSCRIPTION_PRICE_IDS.pro,
      planType: 'pro' as const,
      showOriginalPrice: true,
    },
  ]

  return (
    <section id="pricing" className="py-12 lg:py-20 px-4 sm:px-6 lg:px-8 bg-background relative overflow-hidden">
      <div className="absolute inset-0 grid-bg opacity-30 pointer-events-none"></div>
      <div className="max-w-7xl mx-auto relative z-10">
        <div className="text-center mb-8 lg:mb-12">
          <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-7xl font-black tracking-tighter mb-4 lg:mb-8 text-foreground">
            {tLanding("pricingTitle1")}<span className="text-primary italic">{tLanding("pricingTitle2")}</span>
          </h2>
          <p className="text-sm sm:text-base md:text-lg lg:text-xl text-muted-foreground max-w-2xl mx-auto leading-relaxed font-light opacity-80 px-4">
            {tLanding("pricingDesc")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 lg:gap-8 items-stretch">
          {plans.map((plan, index) => (
            <div
              key={index}
              className={`bg-card border-border ${plan.popular ? 'border-primary/30 p-6 sm:p-8 lg:p-10 rounded-[2rem] sm:rounded-[2.5rem] lg:rounded-[3rem] flex flex-col relative scale-100 sm:scale-105 transition-all duration-500 hover:-translate-y-2 sm:hover:-translate-y-4 group z-20 overflow-hidden border-2' : 'neon-border-glow p-6 sm:p-8 lg:p-10 rounded-[2rem] sm:rounded-[2.5rem] lg:rounded-[3rem] flex flex-col transition-all duration-500 hover:-translate-y-1 sm:hover:-translate-y-2 group border'}`}
            >
              {plan.popular && (
                <>
                  <div className="absolute top-0 right-0 p-8 opacity-10">
                    <Sparkles className="w-24 h-24 text-primary" />
                  </div>
                  <div className="absolute -top-1 px-8 py-2 bg-primary text-primary-foreground font-black text-[10px] tracking-[0.3em] uppercase rounded-b-2xl left-1/2 -translate-x-1/2 shadow-[0_5px_15px_rgba(0,229,229,0.3)]">
                    {tLanding("pricingMostPopular")}
                  </div>
                </>
              )}

              <div className={`mb-6 sm:mb-8 lg:mb-10 ${plan.popular ? 'mt-4' : ''}`}>
                <h3 className={`text-xl sm:text-2xl lg:text-2xl font-bold mb-2 sm:mb-3 ${plan.popular ? 'text-primary' : 'text-foreground'}`}>
                  {plan.name}
                </h3>
                <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">{plan.description}</p>
              </div>

              <div className={`mb-6 sm:mb-8 lg:mb-10 border-b ${plan.popular ? 'border-primary/20' : 'border-border'} pb-6 sm:pb-8`}>
                {plan.showOriginalPrice ? (
                  <div className="flex items-baseline flex-wrap gap-2">
                    <span className="text-4xl sm:text-5xl font-black text-foreground">{plan.price}</span>
                    <span className="text-base sm:text-xl font-medium text-muted-foreground line-through">{plan.originalPrice}</span>
                  </div>
                ) : (
                  <div className="flex items-baseline">
                    <span className="text-4xl sm:text-5xl font-black text-foreground">{plan.price}</span>
                  </div>
                )}
              </div>

              <ul className="space-y-3 sm:space-y-4 lg:space-y-6 mb-8 sm:mb-10 lg:mb-12 flex-grow">
                {plan.features.map((feature, featureIndex) => (
                  <li key={featureIndex} className="flex items-start space-x-4">
                    <Check className={`h-5 w-5 text-primary mt-0.5 flex-shrink-0`} style={plan.popular ? { fontVariationSettings: "'FILL' 1" } : {}} />
                    <span className="text-foreground text-base font-medium">
                      {feature}
                    </span>
                  </li>
                ))}
              </ul>

              {plan.planType === 'trial' && (hasTrialSubscription || hasActiveProSubscription || hasActiveAnnualSubscription) ? (
                <Button
                  className="w-full py-4 bg-secondary border border-border text-foreground font-bold rounded-2xl opacity-50 cursor-not-allowed"
                  variant="outline"
                  disabled
                >
                  {hasActiveProSubscription
                    ? t("trial.not_available_for_pro")
                    : hasActiveAnnualSubscription
                    ? t("trial.not_available_for_annual")
                    : t("trial.trial_only_once")}
                </Button>
              ) : plan.planType === 'pro' && hasActiveAnnualSubscription ? (
                <Button
                  className="w-full py-4 bg-secondary border border-border text-foreground font-bold rounded-2xl opacity-50 cursor-not-allowed"
                  variant="outline"
                  disabled
                >
                  {t("annual.cannot_downgrade")}
                </Button>
              ) : plan.planType === 'annual' && hasActiveAnnualSubscription ? (
                <StripeCheckoutButton
                  priceId={plan.priceId}
                  planType={plan.planType}
                  className="w-full py-5 bg-primary text-primary-foreground font-black rounded-2xl hover:brightness-110 transition-all shadow-[0_10px_30px_rgba(0,229,229,0.4)] text-lg tracking-wider"
                  variant="default"
                >
                  {t("annual.renew")}
                </StripeCheckoutButton>
              ) : (
                <StripeCheckoutButton
                  priceId={plan.priceId}
                  planType={plan.planType}
                  className={plan.popular 
                    ? "w-full py-5 bg-primary text-primary-foreground font-black rounded-2xl hover:brightness-110 transition-all shadow-[0_10px_30px_rgba(0,229,229,0.4)] text-lg tracking-wider" 
                    : "w-full py-4 bg-secondary border border-border text-foreground font-bold rounded-2xl hover:bg-secondary/80 transition-all text-base tracking-wide hover:shadow-[0_0_20px_rgba(0,229,229,0.2)]"}
                  variant={plan.popular ? "default" : "outline"}
                >
                  {plan.planType === 'annual' && (currentSubscriptionPlan === 'trial' || currentSubscriptionPlan === 'pro')
                    ? t("annual.upgrade")
                    : plan.cta}
                </StripeCheckoutButton>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
