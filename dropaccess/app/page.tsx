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
import { ClientAuthWrapper } from "@/components/ClientAuthWrapper";
import { useAuth } from "@/components/AuthProvider";

function HomePage() {
  const { user } = useAuth();

  return (
    <div className="min-h-screen bg-white dark:bg-gray-900">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 border-b border-gray-200 dark:border-gray-800 bg-white/80 dark:bg-gray-900/80 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <Shield className="w-8 h-8 text-primary" />
              <span className="text-xl font-bold text-gray-900 dark:text-white">DropAccess</span>
            </div>
            <div className="hidden md:flex items-center space-x-8">
              <Link href="#features" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                Features
              </Link>
              <Link href="#pricing" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                Pricing
              </Link>
              <Link href="#use-cases" className="text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white transition-colors">
                Use Cases
              </Link>
            </div>
            <div className="flex items-center space-x-4">
              {user ? (
                <Link href="/dashboard">
                  <Button className="font-medium">Dashboard</Button>
                </Link>
              ) : (
                <>
                  <Link href="/auth">
                    <Button variant="ghost" className="font-medium">Sign In</Button>
                  </Link>
                  <Link href="/auth">
                    <Button className="font-medium">Get Started</Button>
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* Rest of your existing home page content */}
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
              <Link href={user ? "/dashboard" : "/auth"}>
                <Button size="lg" className="px-8 py-3 font-medium text-lg">
                  {user ? "Go to Dashboard" : "Start Sharing Securely"}
                  <ArrowRight className="ml-2 w-5 h-5" />
                </Button>
              </Link>
              <Link href="#demo">
                <Button size="lg" variant="outline" className="px-8 py-3 font-medium text-lg">
                  Watch Demo
                </Button>
              </Link>
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

      {/* Add all your other sections here... */}
      {/* For brevity, I'm not including all sections, but they should remain the same */}
      
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
              &copy; 2024 DropAccess. All rights reserved. Built with security and privacy in mind.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default function Page() {
  return (
    <ClientAuthWrapper requireAuth={false}>
      <HomePage />
    </ClientAuthWrapper>
  );
}