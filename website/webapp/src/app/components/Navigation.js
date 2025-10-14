import { Activity } from "lucide-react";

export default function Navigation() {
  return (
    <nav className="top-0 w-full bg-white/95 backdrop-blur-sm border-b border-slate-200 z-50">
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="w-8 h-8 text-emerald-600" />
          <span className="text-xl font-semibold text-slate-900">
            <a href="/overview">LibraryZone</a>
          </span>
        </div>
        <div className="hidden md:flex items-center gap-8">
          <a
            href="#features"
            className="text-slate-600 hover:text-slate-900 transition-colors"
          >
            Features
          </a>
          <a
            href="#how-it-works"
            className="text-slate-600 hover:text-slate-900 transition-colors"
          >
            How It Works
          </a>
          <a
            href="#use-cases"
            className="text-slate-600 hover:text-slate-900 transition-colors"
          >
            Use Cases
          </a>
          <button className="px-5 py-2.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-all hover:shadow-lg">
            <a href="/" className="">
              Request Demo
            </a>
          </button>
        </div>
      </div>
    </nav>
  );
}
