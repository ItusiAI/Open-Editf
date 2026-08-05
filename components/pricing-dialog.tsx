"use client"

import { Dialog, DialogContent, DialogTrigger, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { LandingPricingSection } from "./landing/pricing-section"

interface PricingDialogProps {
  children: React.ReactNode
}

export function PricingDialog({ children }: PricingDialogProps) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="max-w-6xl w-[95vw] max-h-[90vh] p-0 overflow-hidden flex flex-col">
        <DialogHeader className="sr-only">
          <DialogTitle>Pricing</DialogTitle>
        </DialogHeader>
        <div className="overflow-y-auto flex-1">
          <LandingPricingSection />
        </div>
      </DialogContent>
    </Dialog>
  )
}
