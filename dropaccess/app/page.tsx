import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Shield, Clock, Users, Zap } from "lucide-react";

export default function Home() {
  return (
    <div className="min-h-screen bg-background">
      {/* Navigation */}
      <nav className="border-b">
        <div className="container mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold">DropAccess</h1>
          <div className="flex gap-4">
            <Link href="/auth">
              <Button variant="ghost">Sign In</Button>
            </Link>
            <Link href="/auth">
              <Button>Get Started</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="container mx-auto px-4 py-20 text-center">
        <h2 className="text-5xl font-bold mb-6">
          Secure File & Link Sharing with Total Control
        </h2>
        <p className="text-xl text-muted-foreground mb-8 max-w-2xl mx-auto">
          Share files and masked URLs with time-based access, recipient restrictions, 
          and detailed analytics. Your content, your rules.
        </p>
        <div className="flex gap-4 justify-center">
          <Link href="/auth">
            <Button size="lg">Start Sharing Securely</Button>
          </Link>
          <Link href="#features">
            <Button size="lg" variant="outline">Learn More</Button>
          </Link>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="container mx-auto px-4 py-20">
        <h3 className="text-3xl font-bold text-center mb-12">
          Everything You Need for Secure Sharing
        </h3>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader>
              <Shield className="w-10 h-10 mb-2 text-primary" />
              <CardTitle>Privacy First</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Mask URLs and control exactly who can access your content
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Clock className="w-10 h-10 mb-2 text-primary" />
              <CardTitle>Time Control</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Set expiration dates or enable one-time access for maximum security
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Users className="w-10 h-10 mb-2 text-primary" />
              <CardTitle>Recipient Management</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Restrict access to specific email addresses with automatic notifications
              </CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <Zap className="w-10 h-10 mb-2 text-primary" />
              <CardTitle>Analytics</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>
                Track access logs and monitor who viewed your content (Pro feature)
              </CardDescription>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Use Cases */}
      <section className="bg-muted/50 py-20">
        <div className="container mx-auto px-4">
          <h3 className="text-3xl font-bold text-center mb-12">
            Perfect for Every Use Case
          </h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div className="text-center">
              <div className="text-4xl mb-4">👩‍🏫</div>
              <h4 className="font-semibold mb-2">Educators</h4>
              <p className="text-sm text-muted-foreground">
                Share course materials with time-limited access for your students
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">⚖️</div>
              <h4 className="font-semibold mb-2">Legal Professionals</h4>
              <p className="text-sm text-muted-foreground">
                Send confidential documents with one-time download links
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl mb-4">💼</div>
              <h4 className="font-semibold mb-2">Businesses</h4>
              <p className="text-sm text-muted-foreground">
                Control access to demos and trials with expiring links
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-8">
        <div className="container mx-auto px-4 text-center text-muted-foreground">
          <p>&copy; 2024 DropAccess. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}