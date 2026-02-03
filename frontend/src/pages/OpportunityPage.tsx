// v17: Opportunity detail page with professional design + v15 Early Adopters
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fetchOpportunity, fetchOpportunityFeatures, fetchOutreachList, updateOutreachStatus, getOutreachExportUrl, MVPFeature, OutreachContact, OutreachStats, OutreachTemplate, OutreachStatus } from '../api';
import { OpportunityDetail, Quote } from '../types';
import { 
  Card, CardHeader, CardTitle, CardFooter,
  Badge, SeverityBadge, MarketTierBadge,
  StatCard, StatGrid,
  Button, ButtonLink,
  EmptyState, LoadingState,
  Skeleton, SkeletonText
} from '../components/ui';

type TabType = 'overview' | 'adopters';

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
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAllQuotes, setShowAllQuotes] = useState(false);
  const [expandedFeature, setExpandedFeature] = useState<number | null>(null);
  const [expandedTemplate, setExpandedTemplate] = useState<number | null>(null);
  const [statusUpdating, setStatusUpdating] = useState<number | null>(null);

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
      if (activeTab !== 'adopters' || !id || outreachData) return;
      try {
        const data = await fetchOutreachList(parseInt(id));
        setOutreachData(data);
      } catch (err) {
        console.error('Failed to load outreach data:', err);
      }
    }
    loadOutreach();
  }, [activeTab, id, outreachData]);
  
  async function handleStatusUpdate(contactId: number, newStatus: OutreachStatus) {
    if (!outreachData) return;
    setStatusUpdating(contactId);
    try {
      await updateOutreachStatus(contactId, newStatus);
      setOutreachData({
        ...outreachData,
        contacts: outreachData.contacts.map(c => 
          c.id === contactId ? { ...c, outreach_status: newStatus } : c
        )
      });
    } catch (err) {
      console.error('Failed to update status:', err);
    } finally {
      setStatusUpdating(null);
    }
  }

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <Skeleton className="h-6 w-32" />
        <Card padding="lg" className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <Skeleton className="h-10 w-64" />
              <Skeleton className="h-6 w-96" />
            </div>
            <Skeleton className="h-16 w-20" />
          </div>
          <div className="grid grid-cols-4 gap-4 pt-4 border-t border-dark-600">
            {[1,2,3,4].map(i => <Skeleton key={i} className="h-16" />)}
          </div>
        </Card>
        <div className="grid md:grid-cols-2 gap-6">
          <Card padding="lg"><SkeletonText lines={4} /></Card>
          <Card padding="lg"><SkeletonText lines={4} /></Card>
        </div>
      </div>
    );
  }

  if (error || !opportunity) {
    return (
      <EmptyState
        icon="😕"
        title="Opportunity not found"
        description={error || "We couldn't find the opportunity you're looking for."}
        action={{ label: '← Back to list', href: '/' }}
      />
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
    severity_breakdown,
    market
  } = opportunity;

  const displayQuotes = showAllQuotes ? all_quotes : all_quotes.slice(0, 5);
  const hnQuotes = all_quotes.filter(q => q.subreddit === 'hackernews').length;
  const redditQuotes = all_quotes.length - hnQuotes;
  
  const totalFeatures = features 
    ? features.must_have.length + features.nice_to_have.length + features.differentiator.length 
    : 0;

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Back Link */}
      <Link 
        to="/" 
        className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm group"
      >
        <svg className="w-4 h-4 transition-transform group-hover:-translate-x-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to all opportunities
      </Link>

      {/* Header Card */}
      <Card padding="lg" className="relative overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-gradient-to-br from-brand-500/5 via-transparent to-purple-500/5" />
        
        <div className="relative">
          <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-6">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-2xl sm:text-3xl font-bold text-white">{product_name}</h1>
                <Badge variant="brand" size="lg">v{version}</Badge>
              </div>
              <p className="text-lg text-gray-400">{tagline}</p>
              
              {/* Topic & Personas */}
              <div className="flex flex-wrap gap-2 mt-4">
                {topic && (
                  <Badge variant="purple" size="md">
                    Topic: {topic.replace(/_/g, ' ')}
                  </Badge>
                )}
                {personas && personas.map(p => (
                  <Badge key={p} variant="blue" size="md">
                    {p.replace(/_/g, ' ')}
                  </Badge>
                ))}
              </div>
            </div>
            
            {/* Score */}
            <div className="text-center p-4 bg-dark-700/50 rounded-xl border border-dark-600">
              <div className="text-4xl font-bold text-brand-400">{total_score}</div>
              <div className="text-sm text-gray-500">Score</div>
            </div>
          </div>

          {/* Stats Row */}
          <StatGrid cols={4} className="border-t border-dark-600 pt-6">
            <StatCard 
              icon="👥"
              value={social_proof_count.toString()} 
              label="Total mentions"
              size="sm"
            />
            <StatCard 
              icon="✍️"
              value={unique_authors.toString()} 
              label="Unique authors"
              size="sm"
            />
            <StatCard 
              icon="🌐"
              value={subreddits.length.toString()} 
              label="Communities"
              size="sm"
            />
            <StatCard 
              icon="↑"
              value={total_upvotes.toLocaleString()} 
              label="Total upvotes"
              size="sm"
            />
          </StatGrid>
          
          {/* Severity Breakdown */}
          {severity_breakdown && Object.keys(severity_breakdown).length > 0 && (
            <div className="mt-6 pt-6 border-t border-dark-600">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">Severity Breakdown</h4>
              <div className="flex flex-wrap gap-2">
                {severity_breakdown.critical > 0 && (
                  <SeverityBadge severity="critical" />
                )}
                {severity_breakdown.high > 0 && (
                  <SeverityBadge severity="high" />
                )}
                {severity_breakdown.medium > 0 && (
                  <SeverityBadge severity="medium" />
                )}
                {severity_breakdown.low > 0 && (
                  <SeverityBadge severity="low" />
                )}
              </div>
            </div>
          )}
          
          {/* Market Size */}
          {market && (
            <div className="mt-6 pt-6 border-t border-dark-600">
              <h4 className="text-sm font-semibold text-gray-300 mb-3">💰 Market Size Estimate</h4>
              <div className="grid grid-cols-3 gap-4 p-4 bg-gradient-to-r from-brand-500/10 to-purple-500/10 rounded-xl border border-brand-500/20">
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">TAM</div>
                  <MarketTierBadge tier={market.tam_tier} size="lg" />
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">SAM</div>
                  <Badge variant="gray" size="lg">{market.sam_tier}</Badge>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500 mb-1">SOM</div>
                  <Badge variant="green" size="lg">{market.som_tier}</Badge>
                </div>
              </div>
              <div className="flex items-center justify-between mt-2 text-xs text-gray-500">
                <span className="capitalize">{market.category.replace(/_/g, ' ')}</span>
                <span>Confidence: {(market.confidence * 100).toFixed(0)}%</span>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* MVP Features */}
      {features && totalFeatures > 0 && (
        <Card padding="lg">
          <CardHeader>
            <CardTitle subtitle={`${totalFeatures} features extracted from user pain points`}>
              🎯 MVP Feature Requirements
            </CardTitle>
          </CardHeader>
          
          <div className="space-y-6">
            {/* Must-have */}
            {features.must_have.length > 0 && (
              <FeatureSection 
                title="Must-have"
                subtitle="Core features - build these first"
                icon="🔴"
                features={features.must_have}
                expandedFeature={expandedFeature}
                onToggle={setExpandedFeature}
                variant="red"
              />
            )}
            
            {/* Nice-to-have */}
            {features.nice_to_have.length > 0 && (
              <FeatureSection 
                title="Nice-to-have"
                subtitle="Add after launch"
                icon="🟡"
                features={features.nice_to_have}
                expandedFeature={expandedFeature}
                onToggle={setExpandedFeature}
                variant="yellow"
              />
            )}
            
            {/* Differentiators */}
            {features.differentiator.length > 0 && (
              <FeatureSection 
                title="Differentiators"
                subtitle="Beat the competition"
                icon="🔵"
                features={features.differentiator}
                expandedFeature={expandedFeature}
                onToggle={setExpandedFeature}
                variant="blue"
              />
            )}
          </div>
        </Card>
      )}

      {/* Target & How It Works */}
      <div className="grid md:grid-cols-2 gap-6">
        <Card padding="lg">
          <CardHeader>
            <CardTitle>🎯 Target Customer</CardTitle>
          </CardHeader>
          <p className="text-gray-300">{target_customer}</p>
        </Card>

        <Card padding="lg">
          <CardHeader>
            <CardTitle>⚙️ How It Works</CardTitle>
          </CardHeader>
          <ul className="space-y-2">
            {how_it_works.map((feature, i) => (
              <li key={i} className="flex items-start gap-3 text-gray-300">
                <span className="text-brand-400 mt-0.5 font-bold">✓</span>
                {feature}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {/* Source Communities */}
      <Card padding="lg">
        <CardHeader>
          <CardTitle>📊 Source Communities</CardTitle>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          {subreddits.map(sub => (
            <a
              key={sub}
              href={sub === 'hackernews' ? 'https://news.ycombinator.com' : `https://reddit.com/r/${sub}`}
              target="_blank"
              rel="noopener noreferrer"
              className="transition-transform hover:scale-105"
            >
              <Badge 
                variant={sub === 'hackernews' ? 'orange' : 'purple'} 
                size="md"
              >
                {sub === 'hackernews' ? '🔶 HackerNews' : `r/${sub}`}
              </Badge>
            </a>
          ))}
        </div>
        {hnQuotes > 0 && (
          <p className="text-sm text-gray-500 mt-4">
            {redditQuotes} from Reddit • {hnQuotes} from HackerNews
          </p>
        )}
      </Card>

      {/* Quotes */}
      <Card padding="lg">
        <CardHeader 
          action={
            all_quotes.length > 5 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllQuotes(!showAllQuotes)}
              >
                {showAllQuotes ? 'Show less' : `View all ${all_quotes.length}`}
              </Button>
            )
          }
        >
          <CardTitle>💬 Real User Quotes ({all_quotes.length})</CardTitle>
        </CardHeader>

        <div className="space-y-4">
          {displayQuotes.map((quote, i) => (
            <QuoteCard key={i} quote={quote} />
          ))}
        </div>

        {!showAllQuotes && all_quotes.length > 5 && (
          <CardFooter>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => setShowAllQuotes(true)}
            >
              Show all {all_quotes.length} quotes
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}

// Feature Section Component
function FeatureSection({
  title,
  subtitle,
  icon,
  features,
  expandedFeature,
  onToggle,
  variant
}: {
  title: string;
  subtitle: string;
  icon: string;
  features: MVPFeature[];
  expandedFeature: number | null;
  onToggle: (id: number | null) => void;
  variant: 'red' | 'yellow' | 'blue';
}) {
  const variantColors = {
    red: 'text-red-400',
    yellow: 'text-yellow-400',
    blue: 'text-blue-400',
  };
  
  return (
    <div>
      <h3 className={`text-md font-semibold ${variantColors[variant]} mb-3 flex items-center gap-2`}>
        {icon} {title} ({features.length})
        <span className="text-xs font-normal text-gray-500">{subtitle}</span>
      </h3>
      <div className="space-y-2">
        {features.map(feature => (
          <FeatureCard 
            key={feature.id} 
            feature={feature} 
            expanded={expandedFeature === feature.id}
            onToggle={() => onToggle(expandedFeature === feature.id ? null : feature.id)}
          />
        ))}
      </div>
    </div>
  );
}

// Feature Card Component
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
    <div className="card-hover p-4" onClick={onToggle}>
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <h4 className="font-semibold text-white">{feature.feature_name}</h4>
            <Badge variant="gray" size="sm">Priority: {feature.priority_score}</Badge>
            {feature.mention_count > 1 && (
              <Badge variant="brand" size="sm">{feature.mention_count} mentions</Badge>
            )}
          </div>
          <p className="text-sm text-gray-400">{feature.description}</p>
        </div>
        {sourceQuotes.length > 0 && (
          <svg 
            className={`w-5 h-5 text-gray-500 transition-transform ${expanded ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        )}
      </div>
      
      {expanded && sourceQuotes.length > 0 && (
        <div className="mt-4 pt-4 border-t border-dark-600 animate-fade-in">
          <div className="text-xs font-semibold text-gray-500 mb-2">Source quotes:</div>
          <div className="space-y-2">
            {sourceQuotes.map((quote, i) => (
              <p key={i} className="text-sm text-gray-400 italic pl-3 border-l-2 border-brand-500/50">
                "{quote}"
              </p>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// Quote Card Component
function QuoteCard({ quote }: { quote: Quote }) {
  const isHN = quote.subreddit === 'hackernews';
  
  return (
    <div className={`
      pl-4 py-3 border-l-3 rounded-r-lg
      ${isHN ? 'border-l-orange-500 bg-orange-500/5' : 'border-l-brand-500 bg-brand-500/5'}
    `}>
      <p className="text-gray-300 italic">"{quote.text}"</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <span className="text-sm text-gray-500">— {quote.author}</span>
        <Badge variant={isHN ? 'orange' : 'purple'} size="sm">
          {isHN ? '🔶 HackerNews' : `r/${quote.subreddit}`}
        </Badge>
        {quote.persona && (
          <Badge variant="blue" size="sm">
            {quote.persona.replace(/_/g, ' ')}
          </Badge>
        )}
        {quote.severity && (
          <SeverityBadge severity={quote.severity} size="sm" />
        )}
      </div>
    </div>
  );
}
