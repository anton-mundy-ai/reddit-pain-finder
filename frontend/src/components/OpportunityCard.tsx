// v5: Product-focused opportunity card with version badge
import { Link } from 'react-router-dom';
import { Opportunity } from '../types';

interface Props {
  opportunity: Opportunity;
}

export default function OpportunityCard({ opportunity }: Props) {
  const { 
    id, 
    product_name, 
    tagline, 
    how_it_works,
    target_customer,
    version, 
    social_proof_count,
    subreddits,
    top_quotes,
    total_score 
  } = opportunity;

  return (
    <Link 
      to={`/opportunity/${id}`}
      className="block bg-white rounded-xl shadow-md hover:shadow-lg transition-shadow p-6 border border-gray-100"
    >
      {/* Header: Product Name + Version + Score */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-xl font-bold text-gray-900">{product_name}</h2>
          <span className="px-2 py-0.5 text-xs font-semibold bg-blue-100 text-blue-700 rounded-full">
            v{version}
          </span>
        </div>
        <div className="text-right">
          <div className="text-2xl font-bold text-emerald-600">{total_score}</div>
          <div className="text-xs text-gray-500">Score</div>
        </div>
      </div>

      {/* Tagline */}
      <p className="text-gray-600 mb-4">{tagline}</p>

      {/* Social Proof */}
      <div className="flex items-center gap-2 mb-4 text-sm">
        <span className="text-2xl">👥</span>
        <span className="font-semibold text-gray-900">{social_proof_count} mentions</span>
        <span className="text-gray-500">across {subreddits.length} subreddits</span>
      </div>

      {/* Sample Quotes */}
      {top_quotes.length > 0 && (
        <div className="space-y-2 mb-4">
          {top_quotes.slice(0, 2).map((quote, i) => (
            <div key={i} className="text-sm text-gray-600 italic border-l-2 border-gray-200 pl-3">
              "{quote.text.slice(0, 100)}{quote.text.length > 100 ? '...' : ''}"
              <span className="text-gray-400 not-italic"> — u/{quote.author}</span>
            </div>
          ))}
          {social_proof_count > 2 && (
            <div className="text-xs text-blue-600 font-medium">
              +{social_proof_count - 2} more quotes
            </div>
          )}
        </div>
      )}

      {/* Target Customer */}
      <div className="text-sm text-gray-500 mb-3">
        <span className="font-medium">Target:</span> {target_customer}
      </div>

      {/* How It Works */}
      <ul className="text-sm text-gray-700 space-y-1">
        {how_it_works.slice(0, 3).map((feature, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className="text-emerald-500">•</span>
            {feature}
          </li>
        ))}
      </ul>

      {/* Subreddits */}
      <div className="mt-4 flex flex-wrap gap-1">
        {subreddits.slice(0, 4).map(sub => (
          <span key={sub} className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
            r/{sub}
          </span>
        ))}
        {subreddits.length > 4 && (
          <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded-full">
            +{subreddits.length - 4} more
          </span>
        )}
      </div>
    </Link>
  );
}
