'use client'

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  Shield, 
  Clock, 
  Users, 
  BarChart3, 
  FileUp, 
  Link2, 
  Eye, 
  Download,
  CheckCircle,
  ArrowRight,
  Star,
  Zap,
  Globe,
  Lock,
  Timer,
  Mail
} from "lucide-react";
import { useAuth } from '@/components/AuthProvider';
import { useEffect, useState } from 'react';

// Force dynamic rendering
export const dynamic = 'force-dynamic';

export default function Home() {
  const { user, loading } = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Show loading state until mounted and auth is ready
  if (!mounted || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-gray-900">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0">
          <div className="absolute top-20 left-10 w-72 h-72 bg-primary/5 rounded-full blur-3xl"></div>
          <div className="absolute bottom-20 right-10 w-96 h-96 bg-primary/5 rounded-full blur-3xl"></div>
        </div>
        
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-16">
          <div className="text-center max-w-4xl mx-auto">
            <Badge variant="secondary" className="mb-6 px-4 py-2">
              🔒 Trusted by 10,000+ users worldwide
            </Badge>
            
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
              Secure File & Link Sharing 
              <span className="text-primary"> with Total Control</span>
            </h1>
            
            <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 leading-relaxed max-w-3xl mx-auto">
              Share files and mask URLs with time-based access, recipient restrictions, 
              and detailed analytics. Your content, your rules—no compromises on security.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-12">
              {user ? (
                // Authenticated user buttons
                <>
                  <Link href="/dashboard">
                    <Button size="lg" className="px-8 py-3 font-medium text-lg">
                      Go to Dashboard
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                  <Link href="/drops/new">
                    <Button size="lg" variant="outline" className="px-8 py-3 font-medium text-lg">
                      Create New Drop
                    </Button>
                  </Link>
                </>
              ) : (
                // Non-authenticated user buttons
                <>
                  <Link href="/auth">
                    <Button size="lg" className="px-8 py-3 font-medium text-lg">
                      Start Sharing Securely
                      <ArrowRight className="ml-2 w-5 h-5" />
                    </Button>
                  </Link>
                  <Link href="#demo">
                    <Button size="lg" variant="outline" className="px-8 py-3 font-medium text-lg">
                      Watch Demo
                    </Button>
                  </Link>
                </>
              )}
            </div>

            {/* Trust Indicators */}
            <div className="flex flex-wrap justify-center items-center gap-8 text-sm text-gray-500 dark:text-gray-400">
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                No setup required
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                GDPR compliant
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle className="w-4 h-4 text-green-600" />
                99.9% uptime
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gray-50 dark:bg-gray-800/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Everything You Need for Secure Sharing
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Powerful features designed to give you complete control over your shared content
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {/* Feature 1 */}
            <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-white dark:bg-gray-800">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                  Privacy First Design
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Mask URLs and control exactly who can access your content with advanced privacy controls
                </CardDescription>
              </CardContent>
            </Card>

            {/* Feature 2 */}
            <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-white dark:bg-gray-800">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Timer className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                  Time-Based Access
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Set expiration dates or enable one-time access for maximum security and control
                </CardDescription>
              </CardContent>
            </Card>

            {/* Feature 3 */}
            <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-white dark:bg-gray-800">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Users className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                  Recipient Management
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Restrict access to specific email addresses with automatic notifications and verification
                </CardDescription>
              </CardContent>
            </Card>

            {/* Feature 4 */}
            <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-white dark:bg-gray-800">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <FileUp className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                  File & URL Sharing
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Upload files or mask any URL with the same powerful access controls and security
                </CardDescription>
              </CardContent>
            </Card>

            {/* Feature 5 */}
            <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-white dark:bg-gray-800">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <BarChart3 className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                  Detailed Analytics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Track access logs and monitor who viewed your content with comprehensive analytics
                </CardDescription>
              </CardContent>
            </Card>

            {/* Feature 6 */}
            <Card className="group hover:shadow-lg transition-all duration-300 border-0 bg-white dark:bg-gray-800">
              <CardHeader className="pb-4">
                <div className="w-12 h-12 bg-primary/10 rounded-lg flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <Zap className="w-6 h-6 text-primary" />
                </div>
                <CardTitle className="text-lg font-semibold text-gray-900 dark:text-white">
                  Instant Setup
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Get started in seconds with no complex configuration or technical setup required
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              How DropAccess Works
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Share securely in three simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-primary">1</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Upload or Mask</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Upload a file or enter any URL you want to mask and share securely
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-primary">2</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Set Controls</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Add recipient emails, set expiration times, and configure access permissions
              </p>
            </div>
            
            <div className="text-center">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-2xl font-bold text-primary">3</span>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 dark:text-white mb-4">Share Safely</h3>
              <p className="text-gray-600 dark:text-gray-400">
                Share your secure DropAccess link and monitor access in real-time
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-20 bg-gray-50 dark:bg-gray-800/50">
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
            <Card className="text-center border-0 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <div className="text-5xl mb-4">👩‍🏫</div>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                  Educators
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Share course materials, assignments, and resources with time-limited access for your students
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center border-0 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <div className="text-5xl mb-4">⚖️</div>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                  Legal Professionals
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Send confidential documents with one-time download links and audit trails
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center border-0 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <div className="text-5xl mb-4">💼</div>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                  Businesses
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Control access to demos, trials, and confidential business documents
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center border-0 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <div className="text-5xl mb-4">🏥</div>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                  Healthcare
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Share patient records and medical documents with HIPAA-compliant security
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center border-0 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <div className="text-5xl mb-4">🎨</div>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                  Creatives
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Share portfolios, designs, and creative work with clients using controlled access
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="text-center border-0 bg-white dark:bg-gray-800 hover:shadow-lg transition-shadow">
              <CardHeader className="pb-4">
                <div className="text-5xl mb-4">💰</div>
                <CardTitle className="text-xl font-semibold text-gray-900 dark:text-white">
                  Financial Services
                </CardTitle>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Securely share financial reports and sensitive data with time-based controls
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section id="pricing" className="py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-white mb-4">
              Simple, Transparent Pricing
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Start for free, upgrade when you need more power
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            {/* Free Plan */}
            <Card className="border-2 border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
              <CardHeader className="text-center pb-4">
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">Free</CardTitle>
                <div className="text-4xl font-bold text-gray-900 dark:text-white mt-4">$0</div>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  Perfect for getting started
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700 dark:text-gray-300">10 drops per month</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700 dark:text-gray-300">50MB file size limit</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700 dark:text-gray-300">Basic access controls</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700 dark:text-gray-300">Email notifications</span>
                  </div>
                </div>
                <Link href="/auth" className="block">
                  <Button className="w-full mt-6 font-medium">Get Started Free</Button>
                </Link>
              </CardContent>
            </Card>

            {/* Pro Plan */}
            <Card className="border-2 border-primary bg-white dark:bg-gray-800 relative">
              <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2">
                <Badge className="bg-primary text-primary-foreground px-4 py-1">Most Popular</Badge>
              </div>
              <CardHeader className="text-center pb-4 pt-8">
                <CardTitle className="text-2xl font-bold text-gray-900 dark:text-white">Pro</CardTitle>
                <div className="text-4xl font-bold text-gray-900 dark:text-white mt-4">$9</div>
                <CardDescription className="text-gray-600 dark:text-gray-400">
                  per month, for power users
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700 dark:text-gray-300">Unlimited drops</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700 dark:text-gray-300">1GB file size limit</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700 dark:text-gray-300">Advanced analytics</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700 dark:text-gray-300">Custom branding</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-green-600" />
                    <span className="text-gray-700 dark:text-gray-300">Priority support</span>
                  </div>
                </div>
                <Link href="/auth" className="block">
                  <Button className="w-full mt-6 font-medium">Start Pro Trial</Button>
                </Link>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 bg-primary">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Share Securely?
          </h2>
          <p className="text-xl text-primary-foreground/80 mb-8 max-w-2xl mx-auto">
            Join thousands of professionals who trust DropAccess for secure file and link sharing
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            {user ? (
              <Link href="/dashboard">
                <Button size="lg" variant="secondary" className="px-8 py-3 font-medium text-lg">
                  Go to Dashboard
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            ) : (
              <Link href="/auth">
                <Button size="lg" variant="secondary" className="px-8 py-3 font-medium text-lg">
                  Start Free Today
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
            )}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200 dark:border-gray-800 py-12 bg-white dark:bg-gray-900">
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
                <Link href="#features" className="block text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                  Features
                </Link>
                <Link href="#pricing" className="block text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                  Pricing
                </Link>
                <Link href="/auth" className="block text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                  Get Started
                </Link>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Support</h3>
              <div className="space-y-2 text-sm">
                <Link href="#" className="block text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                  Help Center
                </Link>
                <Link href="#" className="block text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                  Contact Us
                </Link>
                <Link href="#" className="block text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                  API Docs
                </Link>
              </div>
            </div>
            
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Legal</h3>
              <div className="space-y-2 text-sm">
                <Link href="#" className="block text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                  Privacy Policy
                </Link>
                <Link href="#" className="block text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                  Terms of Service
                </Link>
                <Link href="#" className="block text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white">
                  Security
                </Link>
              </div>
            </div>
          </div>
          
          <div className="border-t border-gray-200 dark:border-gray-800 mt-8 pt-8 text-center">
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              &copy; 2025 DropAccess. All rights reserved. Built with security and privacy in mind.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}