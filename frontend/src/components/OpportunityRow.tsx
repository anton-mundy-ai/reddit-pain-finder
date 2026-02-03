// v17: Redesigned opportunity row with professional styling
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Opportunity, MarketTier } from '../types';
import { Badge, MarketTierBadge, SeverityBadge } from './ui';

interface Props {
  opportunity: Opportunity;
  rank: number;
  showMentionsBadge?: boolean;
  showRegionPercentage?: boolean;  // v16: Show region percentage when filtering by region
}

export default function OpportunityRow({ opportunity, rank, showMentionsBadge = false, showRegionPercentage = false }: Props) {
  const [expanded, setExpanded] = useState(false);
  
  const { 
    id, 
    product_name, 
    tagline,
    topic,
    topic_canonical,
    broad_category,
    how_it_works,
    target_customer,
    version, 
    social_proof_count,
    subreddits,
    personas,
    top_quotes,
    total_score,
    severity_breakdown,
    avg_similarity,
    market,
    region_count,      // v16
    region_percentage  // v16
  } = opportunity;

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'bg-green-500/20 text-green-400 border-green-500/30';
    if (score >= 50) return 'bg-blue-500/20 text-blue-400 border-blue-500/30';
    if (score >= 30) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
    return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
  };

  const getMentionsVariant = (count: number) => {
    if (count >= 10) return 'bg-green-600 text-white';
    if (count >= 5) return 'bg-green-500/20 text-green-400';
    if (count >= 3) return 'bg-yellow-500/20 text-yellow-400';
    return 'bg-dark-600 text-gray-400';
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      critical: 'bg-red-500',
      high: 'bg-orange-500',
      medium: 'bg-yellow-500',
      low: 'bg-green-500',
    };
    return colors[severity] || 'bg-gray-500';
  };

  const severityTotal = Object.values(severity_breakdown || {}).reduce((a, b) => a + b, 0);

  return (
    <div className="group">
      {/* Main Row */}
      <div 
        className="flex items-center gap-3 sm:gap-4 px-4 py-3 cursor-pointer transition-colors hover:bg-dark-750"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Rank */}
        <div className="w-8 sm:w-10 text-center">
          <span className={`
            text-sm font-semibold
            ${rank <= 3 ? 'text-brand-400' : 'text-gray-500'}
          `}>
            {rank <= 3 ? ['🥇', '🥈', '🥉'][rank - 1] : `#${rank}`}
          </span>
        </div>
        
        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-white truncate">{product_name}</span>
            <Badge variant="brand" size="sm">v{version}</Badge>
            {broad_category && (
              <Badge variant="gray" size="sm">{broad_category}</Badge>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-sm text-gray-400 truncate">{tagline}</span>
          </div>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant="purple" size="sm">
              {(topic_canonical || topic || '').replace(/_/g, ' ')}
            </Badge>
          </div>
        </div>
        
        {/* v16: Region Percentage (when filtering by region) */}
        {showRegionPercentage && (
          <div className="w-16 text-center">
            {region_percentage ? (
              <div className="flex flex-col items-center">
                <span className={`text-sm font-bold ${
                  region_percentage >= 50 ? 'text-emerald-400' : 
                  region_percentage >= 25 ? 'text-emerald-500' : 'text-gray-400'
                }`}>
                  {region_percentage}%
                </span>
                {region_count && (
                  <span className="text-2xs text-gray-500">{region_count} pts</span>
                )}
              </div>
            ) : (
              <span className="text-xs text-gray-500">-</span>
            )}
          </div>
        )}
        
        {/* Market Size */}
        <div className="hidden sm:block w-20 text-center">
          {market ? (
            <MarketTierBadge tier={market.tam_tier} size="sm" />
          ) : (
            <span className="text-xs text-gray-500">-</span>
          )}
        </div>
        
        {/* Mentions */}
        <div className={`
          flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold min-w-[70px] justify-center
          ${getMentionsVariant(social_proof_count)}
        `}>
          <span className="text-sm">👥</span>
          <span className="text-lg">{social_proof_count}</span>
        </div>
        
        {/* Score */}
        <div className={`
          hidden sm:flex px-2.5 py-1 rounded-lg text-sm font-bold border
          ${getScoreColor(total_score)}
        `}>
          {total_score}
        </div>
        
        {/* Personas */}
        <div className="hidden lg:flex gap-1.5 w-32 flex-wrap">
          {(personas || []).slice(0, 2).map(p => (
            <Badge key={p} variant="blue" size="sm">
              {p.replace(/_/g, ' ')}
            </Badge>
          ))}
          {(personas || []).length > 2 && (
            <Badge variant="gray" size="sm">+{personas.length - 2}</Badge>
          )}
        </div>
        
        {/* Expand Icon */}
        <div className="w-6 flex justify-center">
          <svg 
            className={`w-5 h-5 text-gray-500 transition-transform duration-200 ${expanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      {/* Expanded Content */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 bg-dark-750/50 border-t border-dark-600/50 animate-slide-down">
          <div className="ml-8 sm:ml-10 grid md:grid-cols-2 gap-6">
            {/* Left Column */}
            <div className="space-y-4">
              {/* Sample Quotes */}
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <span>💬</span> Sample Quotes
                </h4>
                <div className="space-y-3">
                  {(top_quotes || []).slice(0, 3).map((quote, i) => (
                    <div key={i} className="relative pl-4 border-l-2 border-brand-500/50">
                      <p className="text-sm text-gray-300 italic">
                        "{quote.text.slice(0, 150)}{quote.text.length > 150 ? '...' : ''}"
                      </p>
                      <div className="flex flex-wrap items-center gap-2 mt-2">
                        <span className="text-xs text-gray-500">— {quote.author}</span>
                        {quote.persona && (
                          <Badge variant="blue" size="sm">{quote.persona.replace(/_/g, ' ')}</Badge>
                        )}
                        {quote.severity && (
                          <SeverityBadge severity={quote.severity} size="sm" />
                        )}
                        {(quote as any).similarity && (
                          <Badge variant="purple" size="sm">
                            {((quote as any).similarity * 100).toFixed(0)}% match
                          </Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Severity Distribution */}
              {severityTotal > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Severity Distribution</h4>
                  <div className="flex h-2 rounded-full overflow-hidden bg-dark-600">
                    {(['critical', 'high', 'medium', 'low'] as const).map(s => {
                      const count = severity_breakdown?.[s] || 0;
                      if (count === 0) return null;
                      return (
                        <div 
                          key={s}
                          className={`${getSeverityColor(s)} transition-all duration-500`}
                          style={{ width: `${(count / severityTotal) * 100}%` }}
                          title={`${s}: ${count}`}
                        />
                      );
                    })}
                  </div>
                  <div className="flex justify-between text-2xs text-gray-500 mt-1.5">
                    {(['critical', 'high', 'medium', 'low'] as const).map(s => (
                      <span key={s} className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-full ${getSeverityColor(s)}`} />
                        {s}: {severity_breakdown?.[s] || 0}
                      </span>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Cluster Cohesion */}
              {avg_similarity && avg_similarity > 0 && (
                <div>
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Cluster Cohesion</h4>
                  <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-dark-600 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full transition-all duration-500"
                        style={{ width: `${avg_similarity * 100}%` }}
                      />
                    </div>
                    <span className="text-sm font-semibold text-brand-400">
                      {(avg_similarity * 100).toFixed(0)}%
                    </span>
                  </div>
                </div>
              )}
              
              {/* Market Sizing */}
              {market && (
                <div className="p-4 rounded-xl bg-gradient-to-r from-brand-500/10 to-purple-500/10 border border-brand-500/20">
                  <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                    <span>💰</span> Market Size Estimate
                  </h4>
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">TAM</div>
                      <MarketTierBadge tier={market.tam_tier} size="md" />
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">SAM</div>
                      <Badge variant="gray" size="md">{market.sam_tier}</Badge>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">SOM</div>
                      <Badge variant="green" size="md">{market.som_tier}</Badge>
                    </div>
                  </div>
                  <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                    <span className="capitalize">{market.category.replace(/_/g, ' ')}</span>
                    <span>Confidence: {(market.confidence * 100).toFixed(0)}%</span>
                  </div>
                </div>
              )}
            </div>
            
            {/* Right Column */}
            <div className="space-y-4">
              {/* How It Works */}
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-3 flex items-center gap-2">
                  <span>⚙️</span> How It Works
                </h4>
                <ul className="space-y-2">
                  {(how_it_works || []).map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-400">
                      <span className="text-brand-400 mt-0.5">✓</span>
                      {feature}
                    </li>
                  ))}
                </ul>
              </div>
              
              {/* Target Customer */}
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                  <span>🎯</span> Target Customer
                </h4>
                <p className="text-sm text-gray-400">{target_customer}</p>
              </div>
              
              {/* Source Communities */}
              <div>
                <h4 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                  <span>📊</span> Source Communities
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  {(subreddits || []).slice(0, 8).map(sub => (
                    <Badge 
                      key={sub} 
                      variant={sub === 'hackernews' ? 'orange' : 'gray'} 
                      size="sm"
                    >
                      {sub === 'hackernews' ? '🔶 HN' : `r/${sub}`}
                    </Badge>
                  ))}
                  {(subreddits || []).length > 8 && (
                    <Badge variant="gray" size="sm">+{subreddits.length - 8}</Badge>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="ml-8 sm:ml-10 mt-4 pt-4 border-t border-dark-600/50">
            <Link 
              to={`/opportunity/${id}`}
              className="inline-flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 font-medium transition-colors"
              onClick={(e) => e.stopPropagation()}
            >
              View all {social_proof_count} quotes & details
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
