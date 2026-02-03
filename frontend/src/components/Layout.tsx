import { Link, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';

export default function Layout({ children }: { children: ReactNode }) {
  const location = useLocation();
  
  const navLinks = [
    { path: '/', label: 'Opportunities', icon: '💡' },
    { path: '/trends', label: 'Trends', icon: '📊' },
    { path: '/topics', label: 'Topics', icon: '🏷️' },
    { path: '/competitors', label: 'Competitor Gaps', icon: '🎯' },
  ];
  
  return (
    <div className="min-h-screen bg-dark-900">
      <header className="border-b border-dark-600 bg-dark-800/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-8">
              <Link to="/" className="flex items-center gap-3">
                <span className="text-2xl">💡</span>
                <span className="text-xl font-semibold text-white">Pain Point Finder</span>
              </Link>
              <nav className="hidden md:flex items-center gap-1">
                {navLinks.map(link => (
                  <Link
                    key={link.path}
                    to={link.path}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      location.pathname === link.path
                        ? 'bg-accent-500/20 text-accent-400'
                        : 'text-gray-400 hover:text-white hover:bg-dark-700'
                    }`}
                  >
                    <span className="mr-1.5">{link.icon}</span>
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>
            <a href="https://github.com/anton-mundy-ai/reddit-pain-finder" target="_blank" rel="noopener noreferrer"
               className="text-gray-400 hover:text-white transition-colors">GitHub</a>
          </div>
        </div>
      </header>
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">{children}</main>
      <footer className="border-t border-dark-600 bg-dark-800 mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-gray-500 text-sm">
            Analyzing Reddit to discover startup opportunities • Powered by GPT-4o-mini & Cloudflare
          </p>
        </div>
      </footer>
    </div>
  );
}
