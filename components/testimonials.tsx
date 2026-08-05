"use client"

import { useState } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ChevronLeft, ChevronRight, Star } from 'lucide-react'
import { useTranslations } from 'next-intl'
import Image from 'next/image'

interface Testimonial {
  id: number
  name: string
  title: string
  content: string
  rating: number
  avatar: string
}

const testimonials: Testimonial[] = [
  {
    id: 1,
    name: "Alex Johnson",
    title: "创业公司CEO",
    content: "Editf 帮我们在2周内就上线了MVP！完整的用户认证和支付系统让我们专注于核心业务逻辑，节省了至少3个月的开发时间。",
    rating: 5,
    avatar: "/avatars/alex.jpg"
  },
  {
    id: 2,
    name: "Sarah Miller",
    title: "全栈开发者",
    content: "This template is incredible! The multi-language support and SEO optimization saved us months of development. We launched globally from day one.",
    rating: 5,
    avatar: "/avatars/sarah.jpg"
  },
  {
    id: 3,
    name: "李明",
    title: "技术总监",
    content: "作为技术总监，我对Editf的代码质量印象深刻。TypeScript + Next.js的架构非常现代化，团队很快就能上手开发。",
    rating: 5,
    avatar: "/avatars/liming.jpg"
  },
  {
    id: 4,
    name: "David Chen",
    title: "产品经理",
    content: "The Stripe integration is seamless! We had our subscription billing up and running in hours, not weeks. The template handles all the complex payment flows perfectly.",
    rating: 5,
    avatar: "/avatars/david.jpg"
  },
  {
    id: 5,
    name: "王小雨",
    title: "独立开发者",
    content: "Editf的多语言支持让我的产品轻松进入国际市场。SEO优化也做得很到位，搜索引擎排名提升明显。",
    rating: 5,
    avatar: "/avatars/wangxiaoyu.jpg"
  },
  {
    id: 6,
    name: "Michael Rodriguez",
    title: "SaaS创始人",
    content: "Perfect for rapid prototyping! The authentication system, database setup, and UI components are production-ready. We went from idea to launch in 3 weeks.",
    rating: 5,
    avatar: "/avatars/michael.jpg"
  }
]

export function Testimonials() {
  const t = useTranslations('testimonials')
  const [currentIndex, setCurrentIndex] = useState(0)

  const nextTestimonial = () => {
    setCurrentIndex((prev) => (prev + 1) % testimonials.length)
  }

  const prevTestimonial = () => {
    setCurrentIndex((prev) => (prev - 1 + testimonials.length) % testimonials.length)
  }

  const goToTestimonial = (index: number) => {
    setCurrentIndex(index)
  }

  const currentTestimonial = testimonials[currentIndex]

  return (
    <section className="py-20 relative">
      <div className="container mx-auto px-4">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-foreground mb-4">{t('title')}</h2>
          <p className="text-xl text-muted-foreground">
            {t('description')}
          </p>
        </div>

        <div className="max-w-4xl mx-auto">
          <Card className="bg-secondary/90 backdrop-blur-sm border-0 shadow-2xl ring-1 ring-cyber-500/50 cyber-glow-subtle">
            <CardContent className="p-12">
              {/* 星级评分 */}
              <div className="flex justify-center mb-8">
                {[...Array(5)].map((_, i) => (
                  <Star
                    key={i}
                    className="w-6 h-6 text-primary fill-current"
                  />
                ))}
              </div>

              {/* 评价内容 */}
              <blockquote className="text-center mb-8">
                <p className="text-2xl text-foreground leading-relaxed font-medium">
                  "{currentTestimonial.content}"
                </p>
              </blockquote>

              {/* 用户信息 */}
              <div className="flex items-center justify-center space-x-4">
                <div className="relative w-16 h-16 rounded-full overflow-hidden bg-gradient-to-br from-cyber-500 to-cyber-600 cyber-glow">
                  <div className="w-full h-full flex items-center justify-center">
                    <span className="text-primary-foreground font-semibold text-lg">
                      {currentTestimonial.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                </div>
                <div className="text-center">
                  <h4 className="text-xl font-semibold text-foreground">
                    {currentTestimonial.name}
                  </h4>
                  <p className="text-primary font-medium">{currentTestimonial.title}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 导航控件 */}
          <div className="flex items-center justify-center mt-8 space-x-6">
            <Button
              variant="outline"
              size="icon"
              onClick={prevTestimonial}
              className="rounded-full w-12 h-12 border-cyber-500/50 bg-secondary/50 hover:bg-secondary text-primary backdrop-blur-sm transition-all duration-300 cyber-glow-subtle"
            >
              <ChevronLeft className="w-5 h-5" />
            </Button>

            {/* 指示器 */}
            <div className="flex space-x-2">
              {testimonials.map((_, index) => (
                <button
                  key={index}
                  onClick={() => goToTestimonial(index)}
                  className={`w-3 h-3 rounded-full transition-all duration-300 ${
                    index === currentIndex
                      ? 'bg-primary scale-125 cyber-glow'
                      : 'bg-secondary hover:bg-primary/50'
                  }`}
                />
              ))}
            </div>

            <Button
              variant="outline"
              size="icon"
              onClick={nextTestimonial}
              className="rounded-full w-12 h-12 border-cyber-500/50 bg-secondary/50 hover:bg-secondary text-primary backdrop-blur-sm transition-all duration-300 cyber-glow-subtle"
            >
              <ChevronRight className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
} 