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
                <a href="/api/login">Log In</a>
              </Button>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-24 px-4 sm:px-6 lg:px-8 overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-white to-blue-50 dark:from-gray-900 dark:via-gray-800 dark:to-gray-900"></div>
        <div className="relative max-w-5xl mx-auto text-center">
          <div className="mb-8">
            <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-white mb-6 leading-tight">
              Transform Healthcare Training with
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[hsl(202,71%,44%)] to-[hsl(202,71%,60%)]"> AI Excellence</span>
            </h1>
            <p className="text-xl md:text-2xl text-gray-600 dark:text-gray-300 mb-10 max-w-4xl mx-auto leading-relaxed">
              Elevate your professional development with our cutting-edge platform. Interactive courses, comprehensive training, and an AI tutor rigorously trained on NICE, NHS, and CQC guidelines.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button size="lg" className="bg-gradient-to-r from-[hsl(202,71%,44%)] to-[hsl(202,71%,52%)] hover:from-[hsl(202,71%,40%)] hover:to-[hsl(202,71%,48%)] text-white px-8 py-4 text-lg font-semibold shadow-lg hover:shadow-xl transition-all duration-300" asChild>
                <a href="/api/login">Start Your Journey</a>
              </Button>
              <Button variant="outline" size="lg" className="border-2 border-[hsl(202,71%,44%)] text-[hsl(202,71%,44%)] hover:bg-[hsl(202,71%,44%)] hover:text-white px-8 py-4 text-lg font-semibold transition-all duration-300" asChild>
                <a href="#features">Learn More</a>
              </Button>
            </div>
          </div>
        </div>
        {/* Decorative elements */}
        <div className="absolute top-20 left-10 w-20 h-20 bg-blue-200 dark:bg-blue-800 rounded-full opacity-20 animate-pulse"></div>
        <div className="absolute bottom-20 right-10 w-16 h-16 bg-green-200 dark:bg-green-800 rounded-full opacity-20 animate-pulse delay-1000"></div>
        <div className="absolute top-1/2 left-1/4 w-12 h-12 bg-purple-200 dark:bg-purple-800 rounded-full opacity-20 animate-pulse delay-500"></div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 bg-gradient-to-b from-white to-gray-50 dark:from-gray-950 dark:to-gray-900">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium mb-4">
              ✨ Evidence-Based Learning Platform
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-6">
              Why Choose MediMind AI?
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Interactive training modules designed specifically for healthcare professionals, 
              powered by cutting-edge AI technology.
            </p>
          </div>
          
          <div className="grid md:grid-cols-3 gap-8">
            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-0 shadow-lg bg-white dark:bg-gray-800">
              <CardHeader className="text-center pb-6 pt-8">
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-700 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <BookOpen className="w-8 h-8 text-[hsl(202,71%,44%)]" />
                </div>
                <CardTitle className="text-xl font-bold mb-3">Interactive Training</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Comprehensive interactive modules with real-world scenarios and hands-on learning experiences.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-0 shadow-lg bg-white dark:bg-gray-800">
              <CardHeader className="text-center pb-6 pt-8">
                <div className="w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 dark:from-green-800 dark:to-green-700 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Users className="w-8 h-8 text-green-600" />
                </div>
                <CardTitle className="text-xl font-bold mb-3">AI-Powered Tutor</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  Get instant answers to your questions with our AI tutor trained on 
                  NICE guidelines, NHS best practices, and CQC guidelines.
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="group hover:shadow-xl transition-all duration-300 hover:-translate-y-2 border-0 shadow-lg bg-white dark:bg-gray-800">
              <CardHeader className="text-center pb-6 pt-8">
                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-800 dark:to-purple-700 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform duration-300">
                  <Shield className="w-8 h-8 text-purple-600" />
                </div>
                <CardTitle className="text-xl font-bold mb-3">Compliance Focused</CardTitle>
                <CardDescription className="text-gray-600 dark:text-gray-400 leading-relaxed">
                  All content aligned with current regulations and best practice 
                  guidelines to ensure high-quality, compliant care.
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* Benefits Section */}
      <section className="py-20 bg-white dark:bg-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div className="space-y-8">
              <div>
                <div className="inline-flex items-center px-4 py-2 bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200 rounded-full text-sm font-medium mb-4">
                  🏆 Professional Excellence
                </div>
                <h2 className="text-3xl md:text-4xl font-bold text-gray-900 dark:text-gray-100 mb-6 leading-tight">
                  Trusted by Healthcare Professionals
                </h2>
              </div>
              
              <div className="space-y-6">
                <div className="group flex items-start space-x-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Guidelines Compliance</h3>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">Training content directly aligned with current NICE, NHS, and CQC guidelines for maximum compliance.</p>
                  </div>
                </div>
                
                <div className="group flex items-start space-x-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Flexible Learning</h3>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">Complete training at your own pace with personalized learning paths and adaptive content delivery.</p>
                  </div>
                </div>
                
                <div className="group flex items-start space-x-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Expert AI Support</h3>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">24/7 AI tutor provides instant, expert-level guidance based on evidence-based practices and current standards.</p>
                  </div>
                </div>
                
                <div className="group flex items-start space-x-4 p-4 rounded-xl hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors duration-200">
                  <div className="w-8 h-8 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform duration-200">
                    <CheckCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-gray-100 mb-2">Progress Tracking</h3>
                    <p className="text-gray-600 dark:text-gray-400 leading-relaxed">Comprehensive analytics and reporting to monitor learning progress and skill development.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="lg:text-center">
              <div className="relative bg-gradient-to-br from-[hsl(202,71%,44%)] to-[hsl(202,71%,52%)] rounded-3xl p-8 md:p-10 text-white shadow-2xl overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-white/10 to-transparent"></div>
                <div className="relative">
                  <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Shield className="w-8 h-8 text-white" />
                  </div>
                  <h3 className="text-2xl md:text-3xl font-bold mb-4">Ready to Transform Care Quality?</h3>
                  <p className="text-blue-100 mb-8 text-lg leading-relaxed">
                    Join thousands of healthcare professionals already advancing their skills with MediMind AI
                  </p>
                  <Button size="lg" className="bg-white text-[hsl(202,71%,44%)] hover:bg-gray-100 font-semibold px-8 py-4 text-lg shadow-lg hover:shadow-xl transition-all duration-300" asChild>
                    <a href="/api/login">Start Your Journey</a>
                  </Button>
                </div>
                {/* Decorative elements */}
                <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full"></div>
                <div className="absolute -bottom-6 -left-6 w-32 h-32 bg-white/5 rounded-full"></div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Sign Up Section */}
      <section className="py-20 bg-gradient-to-b from-gray-50 to-white dark:from-gray-900 dark:to-gray-950">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <div className="inline-flex items-center px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-800 dark:text-blue-200 rounded-full text-sm font-medium mb-4">
              🚀 Get Started Today
            </div>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-gray-100 mb-6">
              Choose Your Learning Path
            </h2>
            <p className="text-xl text-gray-600 dark:text-gray-400 max-w-3xl mx-auto leading-relaxed">
              Select the perfect plan for your professional development journey and start transforming healthcare training today.
            </p>
          </div>
          
          <div className="grid md:grid-cols-2 gap-8 max-w-5xl mx-auto">
            <Card className="group relative p-8 text-center hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-0 shadow-lg bg-white dark:bg-gray-800">
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-800 dark:to-blue-700 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Users className="w-8 h-8 text-[hsl(202,71%,44%)]" />
                </div>
                <CardTitle className="text-2xl md:text-3xl font-bold mb-4">Individual Learner</CardTitle>
                <CardDescription className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
                  Perfect for healthcare professionals looking to enhance their diabetes care expertise
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="text-left space-y-4 mb-8">
                  <li className="flex items-center group-hover:text-blue-600 transition-colors duration-200">
                    <div className="w-6 h-6 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="font-medium">Access to all training modules</span>
                  </li>
                  <li className="flex items-center group-hover:text-blue-600 transition-colors duration-200">
                    <div className="w-6 h-6 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="font-medium">24/7 AI tutor support</span>
                  </li>
                  <li className="flex items-center group-hover:text-blue-600 transition-colors duration-200">
                    <div className="w-6 h-6 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="font-medium">Comprehensive progress tracking</span>
                  </li>
                  <li className="flex items-center group-hover:text-blue-600 transition-colors duration-200">
                    <div className="w-6 h-6 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="font-medium">Professional certificate</span>
                  </li>
                </ul>
                <Button size="lg" className="w-full bg-gradient-to-r from-[hsl(202,71%,44%)] to-[hsl(202,71%,52%)] hover:from-[hsl(202,71%,40%)] hover:to-[hsl(202,71%,48%)] text-white font-semibold py-4 shadow-lg hover:shadow-xl transition-all duration-300" asChild>
                  <a href="/api/login">Start Individual Journey</a>
                </Button>
              </CardContent>
            </Card>

            <Card className="group relative p-8 text-center hover:shadow-2xl transition-all duration-300 hover:-translate-y-2 border-2 border-[hsl(202,71%,44%)] shadow-lg bg-white dark:bg-gray-800 overflow-hidden">
              <div className="absolute top-0 right-0 bg-gradient-to-l from-[hsl(202,71%,44%)] to-transparent text-white px-6 py-2 text-sm font-bold">
                POPULAR
              </div>
              <CardHeader>
                <div className="w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 dark:from-purple-800 dark:to-purple-700 rounded-full flex items-center justify-center mx-auto mb-6 group-hover:scale-110 transition-transform duration-300">
                  <Shield className="w-8 h-8 text-purple-600" />
                </div>
                <CardTitle className="text-2xl md:text-3xl font-bold mb-4">Healthcare Organization</CardTitle>
                <CardDescription className="text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
                  Comprehensive training solution for nursing homes and care facilities
                </CardDescription>
              </CardHeader>
              <CardContent className="pt-6">
                <ul className="text-left space-y-4 mb-8">
                  <li className="flex items-center group-hover:text-blue-600 transition-colors duration-200">
                    <div className="w-6 h-6 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="font-medium">Unlimited user accounts</span>
                  </li>
                  <li className="flex items-center group-hover:text-blue-600 transition-colors duration-200">
                    <div className="w-6 h-6 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="font-medium">Advanced team analytics</span>
                  </li>
                  <li className="flex items-center group-hover:text-blue-600 transition-colors duration-200">
                    <div className="w-6 h-6 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="font-medium">Compliance reporting dashboard</span>
                  </li>
                  <li className="flex items-center group-hover:text-blue-600 transition-colors duration-200">
                    <div className="w-6 h-6 bg-green-100 dark:bg-green-800 rounded-full flex items-center justify-center mr-3 flex-shrink-0">
                      <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400" />
                    </div>
                    <span className="font-medium">Dedicated support manager</span>
                  </li>
                </ul>
                <Button size="lg" className="w-full bg-gradient-to-r from-[hsl(202,71%,44%)] to-[hsl(202,71%,52%)] hover:from-[hsl(202,71%,40%)] hover:to-[hsl(202,71%,48%)] text-white font-semibold py-4 shadow-lg hover:shadow-xl transition-all duration-300" asChild>
                  <a href="/api/login">Start Organization Plan</a>
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 dark:from-gray-950 dark:via-gray-900 dark:to-gray-950 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <div className="flex items-center justify-center space-x-4 mb-6">
              <div className="w-12 h-12 bg-white/10 rounded-full flex items-center justify-center">
                <img 
                  src={logoPath} 
                  alt="MediMind AI Logo" 
                  className="w-8 h-8 object-contain"
                />
              </div>
              <div className="text-left">
                <span className="text-2xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">MediMind AI</span>
                <p className="text-sm text-gray-400">Healthcare Training Platform</p>
              </div>
            </div>
            <p className="text-lg text-gray-300 mb-8 max-w-2xl mx-auto leading-relaxed">
              Empowering healthcare professionals with evidence-based diabetes care training through cutting-edge AI technology.
            </p>
            <div className="border-t border-gray-700 pt-8">
              <p className="text-sm text-gray-400">
                © 2025 MediMind AI. All rights reserved. | Trusted by healthcare professionals worldwide.
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}