// v5: Opportunity detail page with all quotes
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchOpportunity } from '../api';
import { OpportunityDetail, Quote } from '../types';

export default function OpportunityPage() {
  const { id } = useParams();
  const [opportunity, setOpportunity] = useState<OpportunityDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllQuotes, setShowAllQuotes] = useState(false);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const data = await fetchOpportunity(parseInt(id));
        setOpportunity(data.opportunity);
      } catch (err) {
        setError('Failed to load opportunity');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600">{error || 'Opportunity not found'}</p>
        <Link to="/" className="text-blue-600 hover:underline mt-2 inline-block">
          ← Back to list
        </Link>
      </div>
    );
  }

  const {
    product_name,
    tagline,
    how_it_works,
    target_customer,
    version,
    social_proof_count,
    subreddits,
    all_quotes,
    unique_authors,
    total_upvotes,
    total_score
  } = opportunity;

  const displayQuotes = showAllQuotes ? all_quotes : all_quotes.slice(0, 5);

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Back link */}
      <Link to="/" className="text-blue-600 hover:underline inline-flex items-center gap-1">
        ← Back to all opportunities
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{product_name}</h1>
              <span className="px-3 py-1 text-sm font-semibold bg-blue-100 text-blue-700 rounded-full">
                v{version}
              </span>
            </div>
            <p className="text-xl text-gray-600">{tagline}</p>
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-emerald-600">{total_score}</div>
            <div className="text-sm text-gray-500">Score</div>
          </div>
        </div>

        {/* Social Proof Stats */}
        <div className="grid grid-cols-3 gap-4 mt-6 pt-6 border-t border-gray-100">
          <div>
            <div className="text-2xl font-bold text-gray-900">👥 {social_proof_count}</div>
            <div className="text-sm text-gray-500">Total mentions</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{unique_authors}</div>
            <div className="text-sm text-gray-500">Unique authors</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">{subreddits.length}</div>
            <div className="text-sm text-gray-500">Subreddits</div>
          </div>
        </div>
      </div>

      {/* Target Customer & How It Works */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-3">🎯 Target Customer</h2>
          <p className="text-gray-700">{target_customer}</p>
        </div>

        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-3">⚙️ How It Works</h2>
          <ul className="space-y-2">
            {how_it_works.map((feature, i) => (
              <li key={i} className="flex items-start gap-2 text-gray-700">
                <span className="text-emerald-500 font-bold">•</span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Subreddits */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-3">📊 Source Communities</h2>
        <div className="flex flex-wrap gap-2">
          {subreddits.map(sub => (
            <a
              key={sub}
              href={`https://reddit.com/r/${sub}`}
              target="_blank"
              rel="noopener noreferrer"
              className="px-3 py-1 bg-orange-50 text-orange-700 rounded-full text-sm hover:bg-orange-100 transition-colors"
            >
              r/{sub}
            </a>
          ))}
        </div>
      </div>

      {/* All Quotes */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">
            💬 Real User Quotes ({all_quotes.length})
          </h2>
          {all_quotes.length > 5 && (
            <button
              onClick={() => setShowAllQuotes(!showAllQuotes)}
              className="text-blue-600 hover:underline text-sm font-medium"
            >
              {showAllQuotes ? 'Show less' : `View all ${all_quotes.length} quotes`}
            </button>
          )}
        </div>

        <div className="space-y-4">
          {displayQuotes.map((quote, i) => (
            <QuoteCard key={i} quote={quote} />
          ))}
        </div>

        {!showAllQuotes && all_quotes.length > 5 && (
          <button
            onClick={() => setShowAllQuotes(true)}
            className="mt-4 w-full py-3 bg-gray-50 hover:bg-gray-100 rounded-lg text-gray-600 font-medium transition-colors"
          >
            Show all {all_quotes.length} quotes
          </button>
        )}
      </div>
    </div>
  );
}

function QuoteCard({ quote }: { quote: Quote }) {
  return (
    <div className="border-l-4 border-blue-200 pl-4 py-2">
      <p className="text-gray-700 italic">"{quote.text}"</p>
      <div className="mt-1 text-sm text-gray-500">
        — u/{quote.author} in <span className="text-orange-600">r/{quote.subreddit}</span>
      </div>
    </div>
  );
}
