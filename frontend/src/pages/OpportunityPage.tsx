// v13: Opportunity detail page with MVP Features + Early Adopters Outreach + Landing Page Generator
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchOpportunity, fetchOpportunityFeatures, fetchOutreachList, updateOutreachStatus, getOutreachExportUrl, fetchOpportunityLanding, generateOpportunityLanding, MVPFeature, OutreachContact, OutreachStats, OutreachTemplate, OutreachStatus, LandingPage } from '../api';
import { OpportunityDetail, Quote } from '../types';

type TabType = 'overview' | 'features' | 'landing' | 'outreach' | 'quotes';

export default function OpportunityPage() {
  const { id } = useParams();
  const [opportunity, setOpportunity] = useState<OpportunityDetail | null>(null);
  const [features, setFeatures] = useState<{
    must_have: MVPFeature[];
    nice_to_have: MVPFeature[];
    differentiator: MVPFeature[];
  } | null>(null);
  const [outreachData, setOutreachData] = useState<{
    contacts: OutreachContact[];
    stats: OutreachStats;
    templates: OutreachTemplate[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [showAllQuotes, setShowAllQuotes] = useState(false);
  const [expandedFeature, setExpandedFeature] = useState<number | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<number | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<number | null>(null);
  const [landing, setLanding] = useState<LandingPage | null>(null);
  const [generatingLanding, setGeneratingLanding] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      if (!id) return;
      try {
        const [oppData, featuresData] = await Promise.all([
          fetchOpportunity(parseInt(id)),
          fetchOpportunityFeatures(parseInt(id)).catch(() => null)
        ]);
        setOpportunity(oppData.opportunity);
        if (featuresData?.grouped) {
          setFeatures(featuresData.grouped);
        }
      } catch (err) {
        setError('Failed to load opportunity');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [id]);
  
  // Load outreach data when tab is selected
  useEffect(() => {
    async function loadOutreach() {
      if (activeTab !== 'outreach' || !id || outreachData) return;
      try {
        const data = await fetchOutreachList(parseInt(id));
        setOutreachData(data);
      } catch (err) {
        console.error('Failed to load outreach data:', err);
      }
    }
    loadOutreach();
  }, [activeTab, id, outreachData]);
  
  // Load landing page data when tab is selected
  useEffect(() => {
    async function loadLanding() {
      if (activeTab !== 'landing' || !id || landing) return;
      try {
        const data = await fetchOpportunityLanding(parseInt(id));
        if (data?.landing) {
          setLanding(data.landing);
        }
      } catch (err) {
        console.error('Failed to load landing page:', err);
      }
    }
    loadLanding();
  }, [activeTab, id, landing]);
  
  const handleGenerateLanding = async () => {
    if (!id) return;
    setGeneratingLanding(true);
    try {
      const result = await generateOpportunityLanding(parseInt(id));
      if (result.landing) {
        setLanding(result.landing);
      }
    } catch (err) {
      console.error('Failed to generate landing:', err);
    } finally {
      setGeneratingLanding(false);
    }
  };
  
  const copyToClipboard = async (text: string, field: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  };
  
  async function handleStatusUpdate(contactId: number, newStatus: OutreachStatus) {
    if (!outreachData) return;
    setStatusUpdating(contactId);
    try {
      await updateOutreachStatus(contactId, newStatus);
      // Update local state
      setOutreachData({
        ...outreachData,
        contacts: outreachData.contacts.map(c => 
          c.id === contactId ? { ...c, outreach_status: newStatus } : c
        ),
        stats: {
          ...outreachData.stats,
          pending: newStatus === 'pending' ? outreachData.stats.pending + 1 : outreachData.stats.pending - (outreachData.contacts.find(c => c.id === contactId)?.outreach_status === 'pending' ? 1 : 0),
          contacted: newStatus === 'contacted' ? outreachData.stats.contacted + 1 : outreachData.stats.contacted,
          responded: newStatus === 'responded' ? outreachData.stats.responded + 1 : outreachData.stats.responded
        }
      });
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setStatusUpdating(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600">{error || 'Opportunity not found'}</p>
        <Link to="/" className="text-purple-600 hover:underline mt-2 inline-block">
          ← Back to list
        </Link>
      </div>
    );
  }

  const {
    product_name,
    tagline,
    topic,
    how_it_works,
    target_customer,
    version,
    social_proof_count,
    subreddits,
    personas,
    all_quotes,
    unique_authors,
    total_upvotes,
    total_score,
    severity_breakdown
  } = opportunity;

  const displayQuotes = showAllQuotes ? all_quotes : all_quotes.slice(0, 5);
  
  const hnQuotes = all_quotes.filter(q => q.subreddit === 'hackernews').length;
  const redditQuotes = all_quotes.length - hnQuotes;
  
  const totalFeatures = features 
    ? features.must_have.length + features.nice_to_have.length + features.differentiator.length 
    : 0;

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800 border-red-200';
      case 'high': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'medium': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'low': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };
  
  const getFeatureTypeBadge = (type: string) => {
    switch (type) {
      case 'must_have': return { emoji: '🔴', label: 'Must-have', color: 'bg-red-100 text-red-800 border-red-200' };
      case 'nice_to_have': return { emoji: '🟡', label: 'Nice-to-have', color: 'bg-yellow-100 text-yellow-800 border-yellow-200' };
      case 'differentiator': return { emoji: '🔵', label: 'Differentiator', color: 'bg-blue-100 text-blue-800 border-blue-200' };
      default: return { emoji: '⚪', label: type, color: 'bg-gray-100 text-gray-800 border-gray-200' };
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <Link to="/" className="text-purple-600 hover:underline inline-flex items-center gap-1">
        ← Back to all opportunities
      </Link>

      {/* Header */}
      <div className="bg-white rounded-xl shadow-lg p-8 border border-gray-100">
        <div className="flex items-start justify-between mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-3xl font-bold text-gray-900">{product_name}</h1>
              <span className="px-3 py-1 text-sm font-semibold bg-purple-100 text-purple-700 rounded-full">
                v{version}
              </span>
            </div>
            <p className="text-xl text-gray-600">{tagline}</p>
            
            {/* Topic badge */}
            {topic && (
              <div className="mt-3">
                <span className="px-3 py-1 text-sm bg-purple-50 text-purple-700 rounded-full capitalize">
                  Topic: {topic.replace(/_/g, ' ')}
                </span>
              </div>
            )}
            
            {/* Personas */}
            {personas && personas.length > 0 && (
              <div className="flex gap-2 mt-3">
                {personas.map(p => (
                  <span key={p} className="px-2.5 py-0.5 text-sm bg-blue-50 text-blue-700 rounded-full capitalize">
                    {p.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            )}
          </div>
          <div className="text-right">
            <div className="text-4xl font-bold text-purple-600">{total_score}</div>
            <div className="text-sm text-gray-500">Score</div>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-100">
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
            <div className="text-sm text-gray-500">Communities</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-gray-900">↑ {total_upvotes}</div>
            <div className="text-sm text-gray-500">Total upvotes</div>
          </div>
        </div>
        
        {/* Severity breakdown */}
        {severity_breakdown && Object.keys(severity_breakdown).length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-100">
            <div className="text-sm font-semibold text-gray-700 mb-2">Severity Breakdown</div>
            <div className="flex gap-3">
              {severity_breakdown.critical > 0 && (
                <span className="px-3 py-1 bg-red-100 text-red-800 rounded-full text-sm">
                  🔴 Critical: {severity_breakdown.critical}
                </span>
              )}
              {severity_breakdown.high > 0 && (
                <span className="px-3 py-1 bg-orange-100 text-orange-800 rounded-full text-sm">
                  🟠 High: {severity_breakdown.high}
                </span>
              )}
              {severity_breakdown.medium > 0 && (
                <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full text-sm">
                  🟡 Medium: {severity_breakdown.medium}
                </span>
              )}
              {severity_breakdown.low > 0 && (
                <span className="px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm">
                  🟢 Low: {severity_breakdown.low}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* MVP Features Section - NEW in v12 */}
      {features && totalFeatures > 0 && (
        <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-4">
            🎯 MVP Feature Requirements ({totalFeatures})
          </h2>
          
          {/* Must-have features */}
          {features.must_have.length > 0 && (
            <div className="mb-6">
              <h3 className="text-md font-semibold text-red-700 mb-3 flex items-center gap-2">
                🔴 Must-have ({features.must_have.length})
                <span className="text-xs font-normal text-gray-500">Core features - build these first</span>
              </h3>
              <div className="space-y-3">
                {features.must_have.map(feature => (
                  <FeatureCard 
                    key={feature.id} 
                    feature={feature} 
                    expanded={expandedFeature === feature.id}
                    onToggle={() => setExpandedFeature(expandedFeature === feature.id ? null : feature.id)}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Nice-to-have features */}
          {features.nice_to_have.length > 0 && (
            <div className="mb-6">
              <h3 className="text-md font-semibold text-yellow-700 mb-3 flex items-center gap-2">
                🟡 Nice-to-have ({features.nice_to_have.length})
                <span className="text-xs font-normal text-gray-500">Add after launch</span>
              </h3>
              <div className="space-y-3">
                {features.nice_to_have.map(feature => (
                  <FeatureCard 
                    key={feature.id} 
                    feature={feature}
                    expanded={expandedFeature === feature.id}
                    onToggle={() => setExpandedFeature(expandedFeature === feature.id ? null : feature.id)}
                  />
                ))}
              </div>
            </div>
          )}
          
          {/* Differentiator features */}
          {features.differentiator.length > 0 && (
            <div>
              <h3 className="text-md font-semibold text-blue-700 mb-3 flex items-center gap-2">
                🔵 Differentiators ({features.differentiator.length})
                <span className="text-xs font-normal text-gray-500">Beat the competition</span>
              </h3>
              <div className="space-y-3">
                {features.differentiator.map(feature => (
                  <FeatureCard 
                    key={feature.id} 
                    feature={feature}
                    expanded={expandedFeature === feature.id}
                    onToggle={() => setExpandedFeature(expandedFeature === feature.id ? null : feature.id)}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      )}

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
                <span className="text-purple-500 font-bold">✓</span>
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Source Communities */}
      <div className="bg-white rounded-xl shadow-md p-6 border border-gray-100">
        <h2 className="text-lg font-bold text-gray-900 mb-3">📊 Source Communities</h2>
        <div className="flex flex-wrap gap-2">
          {subreddits.map(sub => (
            <a
              key={sub}
              href={sub === 'hackernews' ? 'https://news.ycombinator.com' : `https://reddit.com/r/${sub}`}
              target="_blank"
              rel="noopener noreferrer"
              className={`px-3 py-1 rounded-full text-sm transition-colors ${
                sub === 'hackernews' 
                  ? 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                  : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
              }`}
            >
              {sub === 'hackernews' ? '🔶 HackerNews' : `r/${sub}`}
            </a>
          ))}
        </div>
        {hnQuotes > 0 && (
          <p className="text-sm text-gray-500 mt-3">
            {redditQuotes} from Reddit • {hnQuotes} from HackerNews
          </p>
        )}
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
              className="text-purple-600 hover:underline text-sm font-medium"
            >
              {showAllQuotes ? 'Show less' : `View all ${all_quotes.length} quotes`}
            </button>
          )}
        </div>

        <div className="space-y-4">
          {displayQuotes.map((quote, i) => (
            <QuoteCard key={i} quote={quote} getSeverityColor={getSeverityColor} />
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

function FeatureCard({ 
  feature, 
  expanded, 
  onToggle 
}: { 
  feature: MVPFeature; 
  expanded: boolean;
  onToggle: () => void;
}) {
  let sourceQuotes: string[] = [];
  try {
    sourceQuotes = JSON.parse(feature.source_quotes || '[]');
  } catch {}
  
  return (
    <div className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h4 className="font-semibold text-gray-900">{feature.feature_name}</h4>
            <span className="px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full">
              Priority: {feature.priority_score}
            </span>
            {feature.mention_count > 1 && (
              <span className="px-2 py-0.5 text-xs bg-purple-50 text-purple-600 rounded-full">
                {feature.mention_count} mentions
              </span>
            )}
          </div>
          <p className="text-sm text-gray-600">{feature.description}</p>
        </div>
        {sourceQuotes.length > 0 && (
          <button 
            onClick={onToggle}
            className="ml-3 text-gray-400 hover:text-gray-600"
          >
            {expanded ? '▲' : '▼'}
          </button>
        )}
      </div>
      
      {expanded && sourceQuotes.length > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-100">
          <div className="text-xs font-semibold text-gray-500 mb-2">Source quotes:</div>
          <div className="space-y-2">
            {sourceQuotes.map((quote, i) => (
              <p key={i} className="text-sm text-gray-600 italic pl-3 border-l-2 border-gray-200">
                "{quote}"
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function QuoteCard({ quote, getSeverityColor }: { quote: Quote; getSeverityColor: (s: string) => string }) {
  const isHN = quote.subreddit === 'hackernews';
  
  return (
    <div className={`border-l-4 pl-4 py-2 ${isHN ? 'border-orange-300' : 'border-purple-200'}`}>
      <p className="text-gray-700 italic">"{quote.text}"</p>
      <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
        <span className="text-gray-500">— {quote.author}</span>
        {isHN ? (
          <span className="text-orange-600">🔶 HackerNews</span>
        ) : (
          <span className="text-purple-600">r/{quote.subreddit}</span>
        )}
        {quote.persona && (
          <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs capitalize">
            {quote.persona.replace(/_/g, ' ')}
          </span>
        )}
        {quote.severity && (
          <span className={`px-2 py-0.5 rounded-full text-xs border ${getSeverityColor(quote.severity)}`}>
            {quote.severity}
          </span>
        )}
      </div>
    </div>
  );
}
