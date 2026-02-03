// Layout component with professional header and navigation
import { Link, useLocation } from 'react-router-dom';
import { ReactNode, useState } from 'react';
import AlertDropdown from './AlertDropdown';

interface NavLink {
  path: string;
  label: string;
  icon: string;
  badge?: string;
}

const navLinks: NavLink[] = [
  { path: '/', label: 'Opportunities', icon: '💡' },
  { path: '/trends', label: 'Trends', icon: '📈' },
  { path: '/topics', label: 'Topics', icon: '🏷️' },
  { path: '/competitors', label: 'Competitor Gaps', icon: '🎯' },
];

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  return (
    <div className="min-h-screen bg-gradient-dark flex flex-col">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-dark-600/50 bg-dark-900/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            {/* Logo & Brand */}
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-3 group">
                {/* Logo */}
                <div className="relative">
                  <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-shadow">
                    <span className="text-xl filter drop-shadow-sm">💡</span>
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-dark-900" title="Live" />
                </div>
                {/* Brand text */}
                <div className="hidden sm:block">
                  <h1 className="text-lg font-bold text-white tracking-tight">Pain Finder</h1>
                  <p className="text-2xs text-gray-500 -mt-0.5">Discover validated SaaS opportunities</p>
                </div>
              </Link>
              
              {/* Desktop Navigation */}
              <nav className="hidden lg:flex items-center gap-1">
                {navLinks.map(link => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`nav-link ${location.pathname === link.path ? 'nav-link-active' : ''}`}
                  >
                    <span>{link.icon}</span>
                    <span>{link.label}</span>
                    {link.badge && (
                      <span className="badge badge-brand text-2xs">{link.badge}</span>
                    )}
                  </Link>
                ))}
              </nav>
            </div>
            
            {/* Right side actions */}
            <div className="flex items-center gap-3">
              {/* Alerts */}
              <AlertDropdown />
              
              {/* Version badge */}
              <div className="hidden sm:flex items-center gap-2">
                <span className="badge badge-brand">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse-soft" />
                  v16 🌏
                </span>
              </div>
              
              {/* GitHub link */}
              <a 
                href="https://github.com/anton-mundy-ai/reddit-pain-finder" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                <span className="hidden md:inline">GitHub</span>
              </a>
              
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 rounded-lg text-gray-400 hover:text-white hover:bg-dark-700 transition-colors"
              >
                {mobileMenuOpen ? (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile Navigation */}
        {mobileMenuOpen && (
          <div className="lg:hidden border-t border-dark-600/50 bg-dark-800/95 backdrop-blur-xl animate-slide-down">
            <nav className="px-4 py-3 space-y-1">
              {navLinks.map(link => (
                <Link
                  key={link.path}
                  to={link.path}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors
                    ${location.pathname === link.path 
                      ? 'bg-brand-500/20 text-brand-300' 
                      : 'text-gray-400 hover:text-white hover:bg-dark-700'}
                  `}
                >
                  <span className="text-lg">{link.icon}</span>
                  <span>{link.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}
      </header>
      
      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {children}
      </main>
      
      {/* Footer */}
      <footer className="border-t border-dark-600/50 bg-dark-850">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-xl">💡</span>
                <span className="text-sm font-medium text-gray-400">Pain Finder</span>
              </div>
              <span className="text-dark-500">•</span>
              <span className="text-sm text-gray-500">Discover validated SaaS opportunities</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-gray-500">
              <span className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-soft" />
                Powered by GPT-4o-mini & Cloudflare
              </span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
