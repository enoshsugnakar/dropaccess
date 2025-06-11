'use client'

import { useState, useEffect } from 'react'
import { Navbar } from '@/components/Navbar'
import { ClientAuthWrapper } from '@/components/ClientAuthWrapper'
import { useAuth } from '@/components/AuthProvider'
import Link from 'next/link'
import { 
  Shield, 
  Clock, 
  Users, 
  BarChart3, 
  FileUp, 
  Link2, 
  Eye, 
  CheckCircle,
  ArrowRight,
  Star,
  Zap,
  Globe,
  Lock,
  Timer,
  Sparkles,
  TrendingUp,
  Target,
  Award,
  Rocket,
  Brain,
  Fingerprint,
  Layers,
  ShieldCheck,
  Monitor,
  ChevronRight,
  PlayCircle,
  Calendar,
  Gift,
  Infinity,
  MousePointer,
  Settings
} from "lucide-react"

function HomePage() {
  const { user } = useAuth()
  const [mounted, setMounted] = useState(false)
  const [activeTestimonial, setActiveTestimonial] = useState(0)

  useEffect(() => {
    setMounted(true)
    
    // Auto-rotate testimonials
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % 3)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  if (!mounted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 overflow-x-hidden">
      
      {/* Navigation */}
      <Navbar />
      
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center pt-16">
        {/* Simple Background Pattern */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center max-w-5xl mx-auto">
            
            {/* Status Badge */}
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 border border-primary/20 mb-8">
              <div className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></div>
              <span className="text-primary font-medium">Now in Development - Join the Waitlist</span>
            </div>
            
            {/* Main Headline */}
            <h1 className="text-5xl md:text-6xl lg:text-7xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
              Secure File & Link Sharing
              <br />
              <span className="text-primary">Reimagined</span>
            </h1>
            
            {/* Subtitle */}
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-400 mb-12 leading-relaxed max-w-4xl mx-auto">
              Share files and mask URLs with enterprise-grade security, time-based access controls, 
              and detailed analytics. Your content, your rules.
            </p>
            
            {/* CTA Buttons */}
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16">
              <Link href={user ? "/dashboard" : "/auth"}>
                <button className="bg-primary text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-primary/90 transition-colors shadow-md flex items-center">
                  {user ? (
                    <>
                      <Monitor className="mr-2 w-5 h-5" />
                      Go to Dashboard
                    </>
                  ) : (
                    <>
                      <Gift className="mr-2 w-5 h-5" />
                      Try it Out
                    </>
                  )}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </button>
              </Link>
              
              <button className="bg-white dark:bg-gray-800 text-gray-900 dark:text-white border border-gray-300 dark:border-gray-600 px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors flex items-center">
                <PlayCircle className="mr-2 w-5 h-5" />
                Watch Demo
              </button>
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap justify-center items-center gap-8 text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">Enterprise Security</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">GDPR Compliant</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">99.9% Uptime</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium">Zero Setup</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 text-primary font-medium mb-6">
              <Sparkles className="w-4 h-4 mr-2" />
              Core Features
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Everything You Need for Secure Sharing
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Powerful features designed to give you complete control over your shared content
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: "Privacy First Design",
                description: "Mask URLs and control exactly who can access your content with enterprise-grade privacy controls."
              },
              {
                icon: Timer,
                title: "Time-Based Access",
                description: "Set precise expiration dates or enable one-time access for maximum security and control."
              },
              {
                icon: Users,
                title: "Recipient Management", 
                description: "Restrict access to specific email addresses with automatic notifications and verification."
              },
              {
                icon: FileUp,
                title: "Universal File Support",
                description: "Upload any file type or mask any URL with the same powerful access controls."
              },
              {
                icon: BarChart3,
                title: "Detailed Analytics",
                description: "Track access logs and monitor who viewed your content with comprehensive insights."
              },
              {
                icon: Zap,
                title: "Instant Setup",
                description: "Get started in seconds with zero configuration. Create your first secure drop instantly."
              }
            ].map((feature, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 hover:shadow-lg transition-shadow">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  {feature.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 text-primary font-medium mb-6">
              <Target className="w-4 h-4 mr-2" />
              Simple Process
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              How DropAccess Works
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Create secure drops in three simple steps—no technical expertise required
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: "1",
                title: "Upload or Mask",
                description: "Upload any file or enter a URL you want to mask and share securely.",
                icon: FileUp
              },
              {
                step: "2", 
                title: "Set Controls",
                description: "Add recipient emails, set expiration times, and configure access permissions.",
                icon: Settings
              },
              {
                step: "3",
                title: "Share Safely", 
                description: "Share your secure DropAccess link and monitor access in real-time.",
                icon: Globe
              }
            ].map((step, index) => (
              <div key={index} className="text-center">
                <div className="relative mb-6">
                  <div className="w-16 h-16 bg-primary rounded-full flex items-center justify-center mx-auto shadow-lg">
                    <span className="text-2xl font-bold text-white">{step.step}</span>
                  </div>
                  <div className="absolute -top-2 -right-2 w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                    <step.icon className="w-4 h-4 text-primary" />
                  </div>
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-3">
                  {step.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  {step.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing Preview */}
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-2 rounded-full bg-primary/10 text-primary font-medium mb-6">
              <Award className="w-4 h-4 mr-2" />
              Simple Pricing
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Choose Your Plan
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Start free and scale as you grow. No hidden fees, cancel anytime.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
            {/* Free Plan */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Free</h3>
                <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">$0</div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">Forever free</p>
              </div>
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">3 drops per month</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">3 recipients per drop</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">10MB file upload limit</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Basic analytics</span>
                </div>
              </div>
              <button className="w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white py-3 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                Try it Out
              </button>
            </div>

            {/* Individual Plan - Featured */}
            <div className="bg-primary rounded-xl p-6 text-white relative scale-105 shadow-xl">
              <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                <div className="bg-white text-primary px-3 py-1 rounded-full text-xs font-semibold">
                  MOST POPULAR
                </div>
              </div>
              <div className="text-center mb-6 pt-2">
                <h3 className="text-xl font-semibold mb-2">Individual</h3>
                <div className="text-3xl font-bold mb-2">$9.99</div>
                <p className="text-primary-foreground/80 text-sm">per month</p>
              </div>
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-white" />
                  <span className="text-sm">15 drops per month</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-white" />
                  <span className="text-sm">20 recipients per drop</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-white" />
                  <span className="text-sm">300MB file limit</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-white" />
                  <span className="text-sm">Custom time limits</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-white" />
                  <span className="text-sm">Advanced analytics</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-white" />
                  <span className="text-sm">Priority support</span>
                </div>
              </div>
              <button className="w-full bg-white text-primary py-3 rounded-lg font-medium hover:bg-gray-100 transition-colors">
                Start Pro Trial
              </button>
            </div>

            {/* Business Plan */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 border border-gray-200 dark:border-gray-700">
              <div className="text-center mb-6">
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">Business</h3>
                <div className="text-3xl font-bold text-gray-900 dark:text-white mb-2">$19.99</div>
                <p className="text-gray-600 dark:text-gray-400 text-sm">per month</p>
              </div>
              <div className="space-y-3 mb-6">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Unlimited drops</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">1GB file limit</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">Custom branding</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-4 h-4 text-green-600" />
                  <span className="text-sm text-gray-700 dark:text-gray-300">500 recipients per drop</span>
                </div>
              </div>
              <button className="w-full bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-white py-3 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors">
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section className="py-20 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Perfect for Every Professional
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Trusted by professionals across industries for secure content sharing
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {[
              {
                title: "Educators",
                description: "Share course materials and assignments with time-limited access for your students.",
                icon: "👩‍🏫"
              },
              {
                title: "Legal Professionals",
                description: "Send confidential pdf documents with complete view mode and complete audit trails.",
                icon: "⚖️"
              },
              {
                title: "Healthcare",
                description: "Share patient records and medical documents with HIPAA-compliant security.",
                icon: "🏥"
              },
              {
                title: "Businesses",
                description: "Control access to demos, trials, and confidential business documents.",
                icon: "💼"
              },
              {
                title: "Creative Agencies",
                description: "Share portfolios and creative work with clients using controlled access.",
                icon: "🎨"
              },
              {
                title: "Financial Services",
                description: "Securely share financial reports and sensitive data with time-based controls.",
                icon: "💰"
              }
            ].map((useCase, index) => (
              <div key={index} className="bg-white dark:bg-gray-800 rounded-xl p-6 text-center hover:shadow-lg transition-shadow">
                <div className="text-4xl mb-4">{useCase.icon}</div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-3">
                  {useCase.title}
                </h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm leading-relaxed">
                  {useCase.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof 
      <section className="py-20 bg-white dark:bg-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Trusted by Security Professionals
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              See what early adopters are saying about DropAccess
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                name: "Sarah Johnson",
                role: "CISO, TechCorp",
                content: "The security controls and audit trails are exactly what we need for compliance. Simple yet powerful.",
                rating: 5
              },
              {
                name: "Marcus Chen",
                role: "Creative Director",
                content: "Perfect for sharing client work securely. The time-based access gives us complete control.",
                rating: 5
              },
              {
                name: "Dr. Emily Watson",
                role: "Healthcare IT",
                content: "HIPAA compliance made easy. The recipient verification feature is a game-changer.",
                rating: 5
              }
            ].map((testimonial, index) => (
              <div key={index} className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6">
                <div className="flex text-yellow-500 mb-4">
                  {[...Array(testimonial.rating)].map((_, i) => (
                    <Star key={i} className="w-4 h-4 fill-current" />
                  ))}
                </div>
                <p className="text-gray-700 dark:text-gray-300 mb-4 italic">
                  "{testimonial.content}"
                </p>
                <div>
                  <div className="font-semibold text-gray-900 dark:text-white text-sm">
                    {testimonial.name}
                  </div>
                  <div className="text-gray-600 dark:text-gray-400 text-xs">
                    {testimonial.role}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section> */}

      {/* Final CTA */}
      <section className="py-20 bg-primary">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            Ready to Secure Your Shared Content?
          </h2>
          <p className="text-lg mb-8 opacity-90">
            Join the waitlist to be among the first to experience secure sharing done right.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href={user ? "/dashboard" : "/auth"}>
              <button className="bg-white text-primary px-8 py-3 rounded-lg text-lg font-semibold hover:bg-gray-100 transition-colors flex items-center">
                {user ? "Go to Dashboard" : "Join Waitlist"}
                <ArrowRight className="ml-2 w-5 h-5" />
              </button>
            </Link>
            {/*<button className="border border-white/30 text-white px-8 py-3 rounded-lg text-lg font-semibold hover:bg-white/10 transition-colors">
              Schedule Demo
            </button>*/}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-12 bg-gray-50 dark:bg-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center space-x-2 mb-4">
                <Shield className="w-6 h-6 text-primary" />
                <span className="text-lg font-bold text-gray-900 dark:text-white">DropAccess</span>
              </div>
              <p className="text-gray-600 dark:text-gray-400 text-sm">
                Secure file and link sharing with complete control over your content.
              </p>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Product</h3>
              <div className="space-y-2 text-sm">
                <a href="#" className="block text-gray-600 dark:text-gray-400 hover:text-primary">Features</a>
                <a href="#" className="block text-gray-600 dark:text-gray-400 hover:text-primary">Pricing</a>
                <a href="#" className="block text-gray-600 dark:text-gray-400 hover:text-primary">Security</a>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Support</h3>
              <div className="space-y-2 text-sm">
                <a href="#" className="block text-gray-600 dark:text-gray-400 hover:text-primary">Help Center</a>
                <a href="#" className="block text-gray-600 dark:text-gray-400 hover:text-primary">Contact</a>
                <a href="#" className="block text-gray-600 dark:text-gray-400 hover:text-primary">Status</a>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Legal</h3>
              <div className="space-y-2 text-sm">
                <a href="#" className="block text-gray-600 dark:text-gray-400 hover:text-primary">Privacy</a>
                <a href="#" className="block text-gray-600 dark:text-gray-400 hover:text-primary">Terms</a>
                <a href="#" className="block text-gray-600 dark:text-gray-400 hover:text-primary">Security</a>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-200 dark:border-gray-800 mt-8 pt-8 text-center">
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              &copy; 2025 DropAccess. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default function Page() {
  return (
    <ClientAuthWrapper requireAuth={false}>
      <HomePage />
    </ClientAuthWrapper>
  )
}