'use client'

import { useState, useEffect } from 'react'
import { Navbar } from '@/components/Navbar'
import { useAuth } from '@/components/AuthProvider'
import { PricingButton } from '@/components/PricingButton'
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

export default function HomePage() {
  const { user, loading } = useAuth()
  const [activeTestimonial, setActiveTestimonial] = useState(0)

  useEffect(() => {
    // Auto-rotate testimonials
    const interval = setInterval(() => {
      setActiveTestimonial((prev) => (prev + 1) % 3)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  // Simple loading state - only show briefly during initial auth check
  if (loading) {
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
              and detailed analytics.
              Your content, your rules.
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
              Key Features
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Everything You Need for Secure Sharing
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Advanced security features that give you complete control over your content
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                icon: Shield,
                title: "Enterprise Security",
                description: "End-to-end encryption, secure access tokens, and audit logs ensure your content stays protected."
              },
              {
                icon: Timer,
                title: "Time-Based Access",
                description: "Set precise expiration times or verification windows to control when your content can be accessed."
              },
              {
                icon: Users,
                title: "Recipient Control",
                description: "Specify exactly who can access your content with email-based verification and access tracking."
              },
              {
                icon: BarChart3,
                title: "Detailed Analytics",
                description: "Monitor access patterns, download statistics, and recipient behavior with comprehensive reporting."
              },
              {
                icon: Link2,
                title: "URL Masking",
                description: "Hide the true destination of links while maintaining security and tracking capabilities."
              },
              {
                icon: Globe,
                title: "Global Access",
                description: "Secure sharing across borders with localized access controls and compliance features."
              }
            ].map((feature, index) => (
              <div key={index} className="text-center p-6">
                <div className="w-16 h-16 bg-primary/10 rounded-xl flex items-center justify-center mx-auto mb-6">
                  <feature.icon className="w-8 h-8 text-primary" />
                </div>
                <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">
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
              <Rocket className="w-4 h-4 mr-2" />
              How It Works
            </div>
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Secure Sharing in 3 Steps
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Get started with secure content sharing in minutes
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-12">
            {[
              {
                step: "1",
                title: "Upload & Configure",
                description: "Upload files or add URLs, then set your security preferences and access controls.",
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
      <section id="pricing" className="py-20 bg-white dark:bg-gray-800">
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
            <PricingButton 
              plan="free"
              planName="Free"
              price="$0"
              features={[
                "3 drops per month",
                "3 recipients per drop", 
                "10MB file upload limit",
                "Basic analytics"
              ]}
            />

            {/* Individual Plan - Featured */}
            <PricingButton 
              plan="individual"
              planName="Individual"
              price="$9.99"
              features={[
                "15 drops per month",
                "20 recipients per drop",
                "300MB file limit", 
                "Custom time limits",
                "Advanced analytics",
                "Priority support"
              ]}
              popular={true}
            />

            {/* Business Plan */}
            <PricingButton 
              plan="business"
              planName="Business"
              price="$19.99"
              features={[
                "Unlimited drops",
                "Unlimited recipients",
                "Unlimited file size",
                "Advanced analytics",
                "Custom branding",
                "Priority support",
                "Team management"
              ]}
            />
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-gradient-to-r from-primary to-primary/80 text-white">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Secure Your Content?
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
                <a href="#pricing" className="block text-gray-600 dark:text-gray-400 hover:text-primary">Pricing</a>
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