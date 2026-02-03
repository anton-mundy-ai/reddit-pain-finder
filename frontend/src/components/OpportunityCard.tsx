// Opportunity card (legacy - use OpportunityRow for list view)
import { Link } from 'react-router-dom';
import { Opportunity } from '../types';
import { Card, Badge } from './ui';

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
    <Link to={`/opportunity/${id}`} className="block">
      <Card hover padding="lg">
        {/* Header: Product Name + Version + Score */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-white">{product_name}</h2>
            <Badge variant="brand" size="sm">v{version}</Badge>
          </div>
          <div className="text-right">
            <div className="text-2xl font-bold text-brand-400">{total_score}</div>
            <div className="text-xs text-gray-500">Score</div>
          </div>
        </div>

        {/* Tagline */}
        <p className="text-gray-400 mb-4">{tagline}</p>

        {/* Social Proof */}
        <div className="flex items-center gap-2 mb-4 text-sm">
          <span className="text-2xl">👥</span>
          <span className="font-semibold text-white">{social_proof_count} mentions</span>
          <span className="text-gray-500">across {subreddits.length} subreddits</span>
        </div>

        {/* Sample Quotes */}
        {top_quotes.length > 0 && (
          <div className="space-y-2 mb-4">
            {top_quotes.slice(0, 2).map((quote, i) => (
              <div key={i} className="text-sm text-gray-400 italic border-l-2 border-brand-500/50 pl-3">
                "{quote.text.slice(0, 100)}{quote.text.length > 100 ? '...' : ''}"
                <span className="text-gray-500 not-italic"> — u/{quote.author}</span>
              </div>
            ))}
            {social_proof_count > 2 && (
              <div className="text-xs text-brand-400 font-medium">
                +{social_proof_count - 2} more quotes
              </div>
            )}
          </div>
        )}

        {/* Target Customer */}
        <div className="text-sm text-gray-500 mb-3">
          <span className="font-medium text-gray-400">Target:</span> {target_customer}
        </div>

        {/* How It Works */}
        <ul className="text-sm text-gray-400 space-y-1">
          {how_it_works.slice(0, 3).map((feature, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="text-brand-400">•</span>
              {feature}
            </li>
          ))}
        </ul>

        {/* Subreddits */}
        <div className="mt-4 flex flex-wrap gap-1">
          {subreddits.slice(0, 4).map(sub => (
            <Badge key={sub} variant="gray" size="sm">r/{sub}</Badge>
          ))}
          {subreddits.length > 4 && (
            <Badge variant="gray" size="sm">+{subreddits.length - 4} more</Badge>
          )}
        </div>
      </Card>
    </Link>
  );
}
