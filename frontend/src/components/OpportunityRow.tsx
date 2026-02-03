// v7: Compact opportunity row with embedding info
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Opportunity } from '../types';

interface Props {
  opportunity: Opportunity;
  rank: number;
  showMentionsBadge?: boolean;
}

export default function OpportunityRow({ opportunity, rank, showMentionsBadge = false }: Props) {
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
    avg_similarity
  } = opportunity;

  const getScoreColor = (score: number) => {
    if (score >= 70) return 'text-emerald-600 bg-emerald-50';
    if (score >= 50) return 'text-blue-600 bg-blue-50';
    if (score >= 30) return 'text-amber-600 bg-amber-50';
    return 'text-gray-600 bg-gray-50';
  };

  const getMentionsColor = (count: number) => {
    if (count >= 10) return 'bg-green-500 text-white';
    if (count >= 5) return 'bg-green-100 text-green-700';
    if (count >= 3) return 'bg-yellow-100 text-yellow-700';
    return 'bg-gray-100 text-gray-600';
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-500';
      case 'high': return 'bg-orange-500';
      case 'medium': return 'bg-yellow-500';
      case 'low': return 'bg-green-500';
      default: return 'bg-gray-400';
    }
  };

  // Total for severity bar
  const severityTotal = Object.values(severity_breakdown || {}).reduce((a, b) => a + b, 0);

  return (
    <div className="border-b border-gray-100 last:border-b-0">
      <div 
        className="flex items-center gap-4 px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-8 text-center text-sm text-gray-400 font-medium">
          #{rank}
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-gray-900 truncate">{product_name}</span>
            <span className="px-1.5 py-0.5 text-xs font-medium bg-purple-100 text-purple-700 rounded">
              v{version}
            </span>
            {broad_category && (
              <span className="px-1.5 py-0.5 text-xs bg-gray-100 text-gray-600 rounded capitalize">
                {broad_category}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-sm text-gray-500 truncate">{tagline}</span>
            <span className="px-2 py-0.5 text-xs bg-purple-50 text-purple-600 rounded-full capitalize">
              {(topic_canonical || topic || '').replace(/_/g, ' ')}
            </span>
          </div>
        </div>
        
        {/* v7: Prominent mention count */}
        <div className={`flex items-center gap-1 px-3 py-1.5 rounded-lg font-semibold ${getMentionsColor(social_proof_count)}`}>
          <span className="text-sm">👥</span>
          <span className="text-lg">{social_proof_count}</span>
        </div>
        
        <div className={`px-2.5 py-1 rounded-lg text-sm font-bold ${getScoreColor(total_score)}`}>
          {total_score}
        </div>
        
        {/* Personas */}
        <div className="hidden md:flex gap-1 min-w-[120px] flex-wrap">
          {(personas || []).slice(0, 2).map(p => (
            <span key={p} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded-full capitalize">
              {p.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
        
        <div className="text-gray-400">
          <svg 
            className={`w-5 h-5 transition-transform ${expanded ? 'rotate-180' : ''}`} 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </div>
      
      {expanded && (
        <div className="px-4 pb-4 pt-2 bg-gray-50 border-t border-gray-100">
          <div className="ml-12 grid md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Sample Quotes</h4>
              <div className="space-y-2">
                {(top_quotes || []).slice(0, 3).map((quote, i) => (
                  <div key={i} className="text-sm text-gray-600 italic border-l-2 border-purple-200 pl-3">
                    "{quote.text.slice(0, 150)}{quote.text.length > 150 ? '...' : ''}"
                    <div className="flex items-center gap-2 mt-1 not-italic text-xs text-gray-500">
                      <span>— {quote.author}</span>
                      {quote.persona && (
                        <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded capitalize">
                          {quote.persona.replace(/_/g, ' ')}
                        </span>
                      )}
                      {quote.severity && (
                        <span className={`px-1.5 py-0.5 text-white rounded text-[10px] ${getSeverityColor(quote.severity)}`}>
                          {quote.severity}
                        </span>
                      )}
                      {(quote as any).similarity && (
                        <span className="px-1.5 py-0.5 bg-purple-50 text-purple-600 rounded text-[10px]">
                          {((quote as any).similarity * 100).toFixed(0)}% match
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              
              {/* Severity breakdown bar */}
              {severityTotal > 0 && (
                <div className="mt-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-1">Severity Distribution</h4>
                  <div className="flex h-3 rounded-full overflow-hidden bg-gray-200">
                    {(severity_breakdown?.critical || 0) > 0 && (
                      <div 
                        className="bg-red-500" 
                        style={{ width: `${(severity_breakdown.critical / severityTotal) * 100}%` }}
                        title={`Critical: ${severity_breakdown.critical}`}
                      />
                    )}
                    {(severity_breakdown?.high || 0) > 0 && (
                      <div 
                        className="bg-orange-500" 
                        style={{ width: `${(severity_breakdown.high / severityTotal) * 100}%` }}
                        title={`High: ${severity_breakdown.high}`}
                      />
                    )}
                    {(severity_breakdown?.medium || 0) > 0 && (
                      <div 
                        className="bg-yellow-500" 
                        style={{ width: `${(severity_breakdown.medium / severityTotal) * 100}%` }}
                        title={`Medium: ${severity_breakdown.medium}`}
                      />
                    )}
                    {(severity_breakdown?.low || 0) > 0 && (
                      <div 
                        className="bg-green-500" 
                        style={{ width: `${(severity_breakdown.low / severityTotal) * 100}%` }}
                        title={`Low: ${severity_breakdown.low}`}
                      />
                    )}
                  </div>
                  <div className="flex justify-between text-[10px] text-gray-500 mt-1">
                    <span>🔴 Critical</span>
                    <span>🟠 High</span>
                    <span>🟡 Medium</span>
                    <span>🟢 Low</span>
                  </div>
                </div>
              )}
              
              {/* v7: Cluster cohesion indicator */}
              {avg_similarity && avg_similarity > 0 && (
                <div className="mt-4 flex items-center gap-2 text-sm">
                  <span className="text-gray-600">Cluster cohesion:</span>
                  <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-purple-500" 
                      style={{ width: `${avg_similarity * 100}%` }}
                    />
                  </div>
                  <span className="text-purple-600 font-medium">{(avg_similarity * 100).toFixed(0)}%</span>
                </div>
              )}
            </div>
            
            <div>
              <h4 className="text-sm font-semibold text-gray-700 mb-2">How It Works</h4>
              <ul className="text-sm text-gray-600 space-y-1 mb-4">
                {(how_it_works || []).map((feature, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-purple-500">✓</span>
                    {feature}
                  </li>
                ))}
              </ul>
              
              <h4 className="text-sm font-semibold text-gray-700 mb-1">Target Customer</h4>
              <p className="text-sm text-gray-600 mb-4">{target_customer}</p>
              
              <div className="flex flex-wrap gap-1">
                {(subreddits || []).slice(0, 6).map(sub => (
                  <span key={sub} className={`px-2 py-0.5 text-xs rounded-full ${
                    sub === 'hackernews' 
                      ? 'bg-orange-100 text-orange-700' 
                      : 'bg-gray-200 text-gray-600'
                  }`}>
                    {sub === 'hackernews' ? '🔶 HN' : `r/${sub}`}
                  </span>
                ))}
                {(subreddits || []).length > 6 && (
                  <span className="px-2 py-0.5 text-xs bg-gray-200 text-gray-500 rounded-full">
                    +{subreddits.length - 6}
                  </span>
                )}
              </div>
            </div>
          </div>
          
          <div className="ml-12 mt-4 pt-3 border-t border-gray-200">
            <Link 
              to={`/opportunity/${id}`}
              className="text-sm text-purple-600 hover:text-purple-800 font-medium"
              onClick={(e) => e.stopPropagation()}
            >
              View all {social_proof_count} quotes →
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
