import { PaymentSuccess } from '@/components/dashboard/payment-success'
import { PageBackground } from '@/components/page-background'

export default function DashboardPage() {
  return (
    <PageBackground>
      <main className="relative z-10">
        <PaymentSuccess />
      </main>
    </PageBackground>
  )
} 