// Layout component with professional header and navigation
import { Link, useLocation } from 'react-router-dom';
import { ReactNode, useState, useEffect } from 'react';
import AlertDropdown from './AlertDropdown';
import { useAuth } from '../contexts/AuthContext';

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
  const { user, isAuthenticated, isLoading } = useAuth();
  
  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [location.pathname]);

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (mobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [mobileMenuOpen]);
  
  return (
    <div className="min-h-screen bg-gradient-dark flex flex-col overflow-x-hidden">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-dark-600/50 bg-dark-900/95 backdrop-blur-xl supports-[backdrop-filter]:bg-dark-900/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-14 sm:h-16">
            {/* Logo & Brand */}
            <div className="flex items-center gap-4 lg:gap-8">
              <Link to="/" className="flex items-center gap-2 sm:gap-3 group">
                {/* Logo */}
                <div className="relative shrink-0">
                  <div className="w-8 h-8 sm:w-9 sm:h-9 bg-gradient-to-br from-brand-500 to-brand-600 rounded-xl flex items-center justify-center shadow-glow-sm group-hover:shadow-glow transition-shadow">
                    <span className="text-lg sm:text-xl filter drop-shadow-sm">💡</span>
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 sm:w-3 sm:h-3 bg-green-500 rounded-full border-2 border-dark-900" title="Live" />
                </div>
                {/* Brand text */}
                <div className="hidden xs:block sm:block">
                  <h1 className="text-base sm:text-lg font-bold text-white tracking-tight">Pain Finder</h1>
                  <p className="text-2xs text-gray-500 -mt-0.5 hidden sm:block">Discover validated SaaS opportunities</p>
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
            <div className="flex items-center gap-2 sm:gap-3">
              {/* Alerts */}
              <AlertDropdown />
              
              {/* User info & Upgrade to Pro */}
              {!isLoading && isAuthenticated && user && (
                <div className="hidden sm:flex items-center gap-2">
                  {user.plan === 'free' ? (
                    <button
                      className="btn btn-sm bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-medium px-3 py-1.5 rounded-lg text-xs shadow-lg shadow-amber-500/20 transition-all hover:shadow-amber-500/30"
                      onClick={() => alert('Pro plan coming soon! 🚀')}
                      title="Upgrade to unlock more features"
                    >
                      ⭐ Upgrade to Pro
                    </button>
                  ) : (
                    <span className="badge bg-gradient-to-r from-amber-500/20 to-orange-500/20 text-amber-300 border border-amber-500/30">
                      ⭐ Pro
                    </span>
                  )}
                  <div className="flex items-center gap-1.5 text-sm text-gray-400 pl-2 border-l border-dark-600">
                    <span className="w-6 h-6 rounded-full bg-brand-500/20 flex items-center justify-center text-xs">
                      {user.email.charAt(0).toUpperCase()}
                    </span>
                    <span className="hidden lg:inline max-w-[120px] truncate">{user.email}</span>
                  </div>
                </div>
              )}
              
              {/* Version badge */}
              <div className="hidden md:flex items-center gap-2">
                <span className="badge badge-brand">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse-soft" />
                  v24
                </span>
              </div>
              
              {/* GitHub link */}
              <a 
                href="https://github.com/anton-mundy-ai/reddit-pain-finder" 
                target="_blank" 
                rel="noopener noreferrer"
                className="hidden sm:flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm p-2 -m-2"
                aria-label="View on GitHub"
              >
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" />
                </svg>
                <span className="hidden lg:inline">GitHub</span>
              </a>
              
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden p-2 -mr-2 rounded-lg text-gray-400 hover:text-white hover:bg-dark-700 transition-colors touch-manipulation"
                aria-expanded={mobileMenuOpen}
                aria-label="Toggle navigation menu"
              >
                <svg 
                  className={`w-6 h-6 transition-transform duration-200 ${mobileMenuOpen ? 'rotate-90' : ''}`} 
                  fill="none" 
                  stroke="currentColor" 
                  viewBox="0 0 24 24"
                >
                  {mobileMenuOpen ? (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  )}
                </svg>
              </button>
            </div>
          </div>
        </div>
        
        {/* Mobile Navigation - with animated height */}
        <div 
          className={`
            lg:hidden overflow-hidden transition-all duration-300 ease-out
            ${mobileMenuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'}
          `}
        >
          <div className="border-t border-dark-600/50 bg-dark-800/98 backdrop-blur-xl">
            <nav className="px-4 py-3 space-y-1">
              {navLinks.map(link => (
                <Link
                  key={link.path}
                  to={link.path}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl text-base font-medium transition-all active:scale-[0.98]
                    ${location.pathname === link.path 
                      ? 'bg-brand-500/20 text-brand-300 shadow-inner-glow' 
                      : 'text-gray-400 hover:text-white hover:bg-dark-700 active:bg-dark-600'}
                  `}
                >
                  <span className="text-xl">{link.icon}</span>
                  <span>{link.label}</span>
                  {location.pathname === link.path && (
                    <svg className="w-4 h-4 ml-auto text-brand-400" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                    </svg>
                  )}
                </Link>
              ))}
              
              {/* Mobile-only: User info & Upgrade */}
              {!isLoading && isAuthenticated && user && (
                <div className="px-4 py-3 mt-2 border-t border-dark-600/50 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="w-8 h-8 rounded-full bg-brand-500/20 flex items-center justify-center text-sm">
                      {user.email.charAt(0).toUpperCase()}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white truncate">{user.email}</p>
                      <p className="text-xs text-gray-500 capitalize">{user.plan} plan</p>
                    </div>
                  </div>
                  {user.plan === 'free' && (
                    <button
                      className="w-full btn bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-medium px-4 py-2.5 rounded-lg text-sm shadow-lg shadow-amber-500/20"
                      onClick={() => alert('Pro plan coming soon! 🚀')}
                    >
                      ⭐ Upgrade to Pro
                    </button>
                  )}
                </div>
              )}
              
              {/* Mobile-only: Version badge */}
              <div className="flex items-center justify-between px-4 py-3 mt-2 border-t border-dark-600/50">
                <span className="text-sm text-gray-500">Version</span>
                <span className="badge badge-brand">
                  <span className="w-1.5 h-1.5 rounded-full bg-brand-400 animate-pulse-soft" />
                  v24
                </span>
              </div>
            </nav>
          </div>
        </div>
      </header>
      
      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
      
      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6 lg:py-8">
        <div key={location.pathname} className="page-content">
          {children}
        </div>
      </main>
      
      {/* Footer */}
      <footer className="border-t border-dark-600/50 bg-dark-850 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4">
            {/* Brand */}
            <div className="flex items-center gap-2 sm:gap-4">
              <div className="flex items-center gap-2">
                <span className="text-lg sm:text-xl">💡</span>
                <span className="text-sm font-medium text-gray-400">Pain Finder</span>
              </div>
              <span className="hidden sm:inline text-dark-500">•</span>
              <span className="hidden sm:inline text-sm text-gray-500">Discover validated SaaS opportunities</span>
            </div>
            
            {/* Status */}
            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse-soft" />
              <span>Powered by GPT-4o-mini & Cloudflare</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
