import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle, Users, Shield, BookOpen } from "lucide-react";
import logoPath from "@assets/logo (1)_1753961810037.png";

export default function Landing() {
  return (
    <div className="min-h-screen bg-[hsl(210,40%,98%)] dark:bg-[hsl(222.2,84%,4.9%)]">
      {/* Header */}
      <header className="border-b bg-white dark:bg-gray-950 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex justify-between items-center">
            <div className="flex items-center space-x-3">
              <img 
                src={logoPath} 
                alt="MediMind AI Logo" 
                className="w-10 h-10 object-contain"
              />
              <div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                  MediMind AI
                </h1>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Healthcare Training Platform
                </p>
              </div>
            </div>
            <div className="flex space-x-3">
              <Button variant="outline" asChild>
                <a href="/api/login">Sign In</a>
              </Button>
              <Button asChild>
                <a href="/api/login">Get Started</a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <p className="text-xl text-gray-600 dark:text-gray-400 mb-8 max-w-3xl mx-auto">
            Elevate your professional development with our cutting-edge platform. You'll get interactive courses, comprehensive diabetes care training, and an AI tutor rigorously trained on NICE, NHS, and CQC guidelines. This ensures your learning is always accurate and aligned with the highest standards. Benefit from the combined power of expert educators and intelligent AI supervision, delivering the best possible professional growth for healthcare workers.
          </p>
          
        </div>
      </section>

      {/* Features Section */}
      <section className="py-16 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-4">
              Evidence-Based Learning
            </h2>
            <p className="text-lg text-gray-600 dark:text-gray-400 max-w-2xl mx-auto">
              Interactive training modules designed specifically for healthcare professionals.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card>
              <CardHeader>
                <BookOpen className="w-10 h-10 text-[hsl(202,71%,44%)] mb-2" />
                <CardTitle>Interactive Video Training</CardTitle>
                <CardDescription>
                  Comprehensive video modules covering insulin administration, 
                  blood glucose monitoring, and diabetes management protocols.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Users className="w-10 h-10 text-[hsl(202,71%,44%)] mb-2" />
                <CardTitle>AI-Powered Tutor</CardTitle>
                <CardDescription>
                  Get instant answers to your questions with our AI tutor trained on 
                  NICE guidelines, NHS best practices, and CQC standards.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card>
              <CardHeader>
                <Shield className="w-10 h-10 text-[hsl(202,71%,44%)] mb-2" />
                <CardTitle>Compliance Focused</CardTitle>
                <CardDescription>
                  All content aligned with current regulations and best practice 
                  guidelines to ensure high-quality, compliant care.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-6">
                Why Choose MediMind AI?
              </h2>
              <div className="space-y-4">
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">NICE Guidelines Compliance</h3>
                    <p className="text-gray-600 dark:text-gray-400">Training content directly aligned with current NICE diabetes guidelines.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Flexible Learning</h3>
                    <p className="text-gray-600 dark:text-gray-400">Complete training at your own pace, individually or in group sessions.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Expert Support</h3>
                    <p className="text-gray-600 dark:text-gray-400">AI tutor provides instant, expert-level guidance based on evidence-based practices.</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <CheckCircle className="w-6 h-6 text-green-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-gray-100">Progress Tracking</h3>
                    <p className="text-gray-600 dark:text-gray-400">Monitor learning progress and ensure comprehensive skill development.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="lg:text-center">
              <div className="bg-[hsl(202,71%,44%)] dark:bg-[hsl(202,71%,44%)] rounded-2xl p-8 text-white">
                <h3 className="text-2xl font-bold mb-4">Ready to Improve Care Quality?</h3>
                <p className="text-blue-100 mb-6">
                  Join healthcare professionals already using MediMind AI to deliver 
                  better diabetes care with confidence.
                </p>
                <Button size="lg" className="bg-white text-[hsl(202,71%,44%)] hover:bg-gray-100" asChild>
                  <a href="/api/login">Start Your Training Journey</a>
                </Button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 dark:bg-gray-950 text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-3 mb-4">
              <img 
                src={logoPath} 
                alt="MediMind AI Logo" 
                className="w-8 h-8 object-contain"
              />
              <span className="text-xl font-bold">MediMind AI</span>
            </div>
            <p className="text-gray-400 mb-4">
              Professional diabetes care training for healthcare workers
            </p>
            <p className="text-sm text-gray-500">
              © 2025 MediMind AI. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}