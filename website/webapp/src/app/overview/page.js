import {
  Activity,
  BarChart3,
  Eye,
  MapPin,
  Shield,
  TrendingUp,
  Users,
  Zap,
  Layout,
  Clock,
  FileText,
  ChevronRight,
} from "lucide-react";
import Navigation from "../components/Navigation";

function App() {
  return (
    <div className="min-h-screen bg-white">
      {/* Navigation */}
      <Navigation />

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div>
              <div className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-full text-sm font-medium mb-6">
                <Zap className="w-4 h-4" />
                Privacy-First Technology
              </div>
              <h1 className="text-5xl md:text-6xl font-bold text-slate-900 leading-tight mb-6">
                Transform Library Space Management with
                <span className="text-emerald-600"> Intelligent Tracking</span>
              </h1>
              <p className="text-xl text-slate-600 mb-8 leading-relaxed">
                Harness computer vision to optimize library zones, understand
                patron movement patterns, and create better spaces—all while
                respecting privacy.
              </p>
              <div className="flex flex-col sm:flex-row gap-4">
                <button className="px-8 py-4 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all hover:shadow-xl font-medium text-lg flex items-center justify-center gap-2 group">
                  Schedule Demo
                  <ChevronRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </button>
                <button className="px-8 py-4 border-2 border-slate-200 text-slate-700 rounded-lg hover:border-slate-300 transition-all font-medium text-lg">
                  View Documentation
                </button>
              </div>
            </div>
            <div className="relative">
              <div className="bg-gradient-to-br from-emerald-50 to-blue-50 rounded-2xl p-8 shadow-2xl">
                <div className="bg-white rounded-xl p-6 shadow-lg">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm font-semibold text-slate-700">
                      Live Zone Activity
                    </span>
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></div>
                      <span className="text-xs text-slate-600">Live</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 mb-6">
                    <div className="bg-emerald-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-emerald-700 mb-1">
                        247
                      </div>
                      <div className="text-xs text-slate-600">
                        Active Patrons
                      </div>
                    </div>
                    <div className="bg-blue-50 rounded-lg p-4">
                      <div className="text-2xl font-bold text-blue-700 mb-1">
                        12
                      </div>
                      <div className="text-xs text-slate-600">
                        Zones Monitored
                      </div>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-700">
                        Reading Area
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-emerald-500 rounded-full"
                            style={{ width: "75%" }}
                          ></div>
                        </div>
                        <span className="text-xs font-medium text-slate-600">
                          75%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-700">
                        Study Rooms
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-blue-500 rounded-full"
                            style={{ width: "60%" }}
                          ></div>
                        </div>
                        <span className="text-xs font-medium text-slate-600">
                          60%
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center justify-between p-3 bg-slate-50 rounded-lg">
                      <span className="text-sm text-slate-700">
                        Computer Lab
                      </span>
                      <div className="flex items-center gap-2">
                        <div className="w-24 h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-amber-500 rounded-full"
                            style={{ width: "45%" }}
                          ></div>
                        </div>
                        <span className="text-xs font-medium text-slate-600">
                          45%
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              How It Works
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Simple deployment, powerful insights. Our system integrates
              seamlessly with your existing infrastructure.
            </p>
          </div>
          <div className="grid md:grid-cols-4 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Eye className="w-8 h-8 text-emerald-600" />
              </div>
              <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold">
                1
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Computer Vision
              </h3>
              <p className="text-slate-600">
                Cameras detect movement patterns without identifying individuals
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <MapPin className="w-8 h-8 text-blue-600" />
              </div>
              <div className="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold">
                2
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Zone Mapping
              </h3>
              <p className="text-slate-600">
                Define custom zones aligned with your library layout
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Activity className="w-8 h-8 text-violet-600" />
              </div>
              <div className="w-8 h-8 bg-violet-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold">
                3
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Real-Time Analysis
              </h3>
              <p className="text-slate-600">
                Track occupancy and movement across all zones instantly
              </p>
            </div>
            <div className="text-center">
              <div className="w-16 h-16 bg-amber-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-8 h-8 text-amber-600" />
              </div>
              <div className="w-8 h-8 bg-amber-600 rounded-full flex items-center justify-center mx-auto mb-4 text-white font-bold">
                4
              </div>
              <h3 className="text-lg font-semibold text-slate-900 mb-2">
                Actionable Insights
              </h3>
              <p className="text-slate-600">
                Generate reports and optimize space allocation
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Powerful Features
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Everything you need to optimize library operations and enhance
              patron experience
            </p>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            <div className="bg-white p-8 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-xl transition-all">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <TrendingUp className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Heat Map Visualization
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Identify high-traffic areas and underutilized spaces with
                intuitive heat maps that reveal usage patterns over time.
              </p>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-xl transition-all">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <Users className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Occupancy Monitoring
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Track real-time occupancy levels to ensure safety compliance and
                optimal resource allocation across all zones.
              </p>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-slate-200 hover:border-violet-300 hover:shadow-xl transition-all">
              <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center mb-4">
                <Shield className="w-6 h-6 text-violet-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Privacy by Design
              </h3>
              <p className="text-slate-600 leading-relaxed">
                No facial recognition or personal data collection. Track
                movement patterns while fully respecting patron privacy.
              </p>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-slate-200 hover:border-amber-300 hover:shadow-xl transition-all">
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center mb-4">
                <Clock className="w-6 h-6 text-amber-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Historical Analytics
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Access historical data to identify trends, peak hours, and
                seasonal patterns for strategic planning.
              </p>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-slate-200 hover:border-emerald-300 hover:shadow-xl transition-all">
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center mb-4">
                <Layout className="w-6 h-6 text-emerald-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Custom Zone Configuration
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Define and modify zones to match your unique library layout with
                our intuitive configuration interface.
              </p>
            </div>
            <div className="bg-white p-8 rounded-2xl border border-slate-200 hover:border-blue-300 hover:shadow-xl transition-all">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                <FileText className="w-6 h-6 text-blue-600" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900 mb-3">
                Automated Reporting
              </h3>
              <p className="text-slate-600 leading-relaxed">
                Generate comprehensive reports for stakeholders with
                customizable metrics and visualizations.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Use Cases */}
      <section id="use-cases" className="py-20 px-6 bg-slate-50">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-slate-900 mb-4">
              Real-World Applications
            </h2>
            <p className="text-xl text-slate-600 max-w-2xl mx-auto">
              Discover how libraries are using LibraryZone to enhance operations
              and patron experience
            </p>
          </div>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Layout className="w-6 h-6 text-emerald-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">
                    Space Planning & Optimization
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    Identify underutilized areas and reallocate resources based
                    on actual usage data. Make informed decisions about
                    furniture placement, collection arrangement, and space
                    renovations.
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Users className="w-6 h-6 text-blue-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">
                    Resource Allocation
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    Optimize staffing levels by understanding peak usage times.
                    Ensure adequate support in high-traffic zones while reducing
                    costs during low-activity periods.
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-violet-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <Shield className="w-6 h-6 text-violet-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">
                    Safety & Compliance
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    Monitor occupancy limits for fire code compliance. Track
                    evacuation patterns and ensure all zones remain within safe
                    capacity thresholds.
                  </p>
                </div>
              </div>
            </div>
            <div className="bg-white rounded-2xl p-8 shadow-lg">
              <div className="flex items-start gap-4 mb-4">
                <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <BarChart3 className="w-6 h-6 text-amber-600" />
                </div>
                <div>
                  <h3 className="text-xl font-semibold text-slate-900 mb-2">
                    Program Effectiveness
                  </h3>
                  <p className="text-slate-600 leading-relaxed">
                    Measure the impact of library programs and events. Track
                    attendance patterns and patron engagement to refine
                    programming strategies and demonstrate value to
                    stakeholders.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-6">
        <div className="max-w-5xl mx-auto">
          <div className="bg-gradient-to-br from-emerald-600 to-blue-600 rounded-3xl p-12 md:p-16 text-center text-white shadow-2xl">
            <h2 className="text-4xl md:text-5xl font-bold mb-6">
              Ready to Transform Your Library?
            </h2>
            <p className="text-xl mb-8 text-emerald-50 max-w-2xl mx-auto">
              Join leading institutions using data-driven insights to create
              better spaces and experiences for their communities.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button className="px-8 py-4 bg-white text-emerald-600 rounded-lg hover:bg-emerald-50 transition-all hover:shadow-xl font-medium text-lg">
                Schedule a Demo
              </button>
              <button className="px-8 py-4 border-2 border-white text-white rounded-lg hover:bg-white/10 transition-all font-medium text-lg">
                Contact Sales
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-300 py-12 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Activity className="w-6 h-6 text-emerald-500" />
                <span className="text-lg font-semibold text-white">
                  LibraryZone
                </span>
              </div>
              <p className="text-sm text-slate-400">
                Privacy-focused library analytics for the modern institution.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Product</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Features
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Pricing
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Case Studies
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Documentation
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Company</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    About
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Blog
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Careers
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Contact
                  </a>
                </li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-white mb-4">Legal</h4>
              <ul className="space-y-2 text-sm">
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Privacy Policy
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Terms of Service
                  </a>
                </li>
                <li>
                  <a href="#" className="hover:text-white transition-colors">
                    Security
                  </a>
                </li>
              </ul>
            </div>
          </div>
          <div className="border-t border-slate-800 pt-8 text-sm text-slate-400 text-center">
            © 2025 LibraryZone. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
