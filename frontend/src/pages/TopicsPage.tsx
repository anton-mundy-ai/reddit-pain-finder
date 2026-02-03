// v17: Topics page with professional design
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchTopics, fetchPainPoints } from '../api';
import { Topic, PainPoint } from '../types';
import {
  Card, CardHeader, CardTitle,
  Badge, SeverityBadge,
  Button, ButtonLink,
  EmptyState,
  SimpleTabs,
  SkeletonCard, SkeletonRow
} from '../components/ui';

export default function TopicsPage() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [painPoints, setPainPoints] = useState<PainPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<string | null>(null);
  const [view, setView] = useState<'topics' | 'painpoints'>('topics');

  useEffect(() => {
    async function load() {
      try {
        const [topicsData, painPointsData] = await Promise.all([
          fetchTopics(),
          fetchPainPoints(300)
        ]);
        setTopics(topicsData.topics || []);
        setPainPoints(painPointsData.painpoints || []);
      } catch (err) {
        setError('Failed to load data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const filteredPainPoints = selectedTopic
    ? painPoints.filter(p => p.topics.includes(selectedTopic))
    : painPoints;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            🏷️ Pain Point Explorer
          </h1>
          <p className="text-gray-400 mt-1">
            Visualize topics and raw pain points from the community
          </p>
        </div>
        <ButtonLink to="/" variant="ghost" icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        }>
          Back to Products
        </ButtonLink>
      </div>

      {/* View Toggle */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <SimpleTabs
          tabs={[
            { id: 'topics', label: `Topics (${topics.length})`, icon: '📊' },
            { id: 'painpoints', label: `Pain Points (${painPoints.length})`, icon: '💬' },
          ]}
          value={view}
          onChange={(v) => {
            setView(v as 'topics' | 'painpoints');
            if (v === 'topics') setSelectedTopic(null);
          }}
        />
        
        {/* Selected Topic Filter */}
        {selectedTopic && (
          <div className="flex items-center gap-2 px-4 py-2 bg-brand-500/10 rounded-lg border border-brand-500/30">
            <span className="text-sm text-brand-300">Filtering by:</span>
            <Badge variant="brand" size="md">
              {selectedTopic.replace(/_/g, ' ')}
            </Badge>
            <button 
              onClick={() => setSelectedTopic(null)}
              className="ml-1 text-brand-400 hover:text-brand-300 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        )}
      </div>

      {/* Loading State */}
      {loading && (
        view === 'topics' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
          </div>
        ) : (
          <div className="card overflow-hidden">
            {[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}
          </div>
        )
      )}

      {/* Error State */}
      {error && (
        <EmptyState
          icon="😕"
          title="Failed to load data"
          description={error}
          action={{ label: 'Try again', onClick: () => window.location.reload() }}
        />
      )}

      {/* Topics View */}
      {!loading && !error && view === 'topics' && (
        topics.length === 0 ? (
          <EmptyState
            icon="🏷️"
            title="No topics yet"
            description="Topics will appear once pain points are tagged and grouped."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {topics.map(topic => (
              <TopicCard
                key={topic.topic}
                topic={topic}
                onClick={() => {
                  setSelectedTopic(topic.topic);
                  setView('painpoints');
                }}
              />
            ))}
          </div>
        )
      )}

      {/* Pain Points View */}
      {!loading && !error && view === 'painpoints' && (
        filteredPainPoints.length === 0 ? (
          <EmptyState
            icon="💬"
            title="No pain points found"
            description={selectedTopic ? "No pain points found for this topic." : "Pain points will appear once comments are analyzed."}
            action={selectedTopic ? { label: 'Clear filter', onClick: () => setSelectedTopic(null) } : undefined}
          />
        ) : (
          <div className="space-y-3">
            {filteredPainPoints.map(pp => (
              <PainPointCard 
                key={pp.id} 
                painPoint={pp}
                selectedTopic={selectedTopic}
                onTopicClick={setSelectedTopic}
              />
            ))}
          </div>
        )
      )}
    </div>
  );
}

// Topic Card Component
function TopicCard({ topic, onClick }: { topic: Topic; onClick: () => void }) {
  const severityTotal = Object.values(topic.severity_breakdown).reduce((a, b) => a + b, 0);
  
  return (
    <Card 
      hover 
      padding="none"
      className="overflow-hidden"
      onClick={onClick}
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <h3 className="font-semibold text-white capitalize">
            {topic.topic.replace(/_/g, ' ')}
          </h3>
          <Badge 
            variant={topic.count >= 5 ? 'green' : 'gray'} 
            size="lg"
          >
            {topic.count}
          </Badge>
        </div>
        
        {/* Severity Bar */}
        <div className="h-2 rounded-full overflow-hidden bg-dark-600 mb-3">
          {severityTotal > 0 && (
            <div className="h-full flex">
              {topic.severity_breakdown.critical > 0 && (
                <div 
                  className="bg-red-500 transition-all" 
                  style={{ width: `${(topic.severity_breakdown.critical / severityTotal) * 100}%` }}
                />
              )}
              {topic.severity_breakdown.high > 0 && (
                <div 
                  className="bg-orange-500 transition-all" 
                  style={{ width: `${(topic.severity_breakdown.high / severityTotal) * 100}%` }}
                />
              )}
              {topic.severity_breakdown.medium > 0 && (
                <div 
                  className="bg-yellow-500 transition-all" 
                  style={{ width: `${(topic.severity_breakdown.medium / severityTotal) * 100}%` }}
                />
              )}
              {topic.severity_breakdown.low > 0 && (
                <div 
                  className="bg-green-500 transition-all" 
                  style={{ width: `${(topic.severity_breakdown.low / severityTotal) * 100}%` }}
                />
              )}
            </div>
          )}
        </div>
        
        {/* Personas */}
        <div className="flex flex-wrap gap-1.5 mb-3">
          {topic.personas.slice(0, 3).map(p => (
            <Badge key={p} variant="blue" size="sm">
              {p.replace(/_/g, ' ')}
            </Badge>
          ))}
          {topic.personas.length > 3 && (
            <Badge variant="gray" size="sm">+{topic.personas.length - 3}</Badge>
          )}
        </div>
        
        {/* Subreddits */}
        <div className="text-xs text-gray-500">
          {topic.subreddits.slice(0, 3).map(s => `r/${s}`).join(', ')}
          {topic.subreddits.length > 3 && ` +${topic.subreddits.length - 3}`}
        </div>
      </div>
      
      {/* Ready badge */}
      {topic.count >= 5 && (
        <div className="px-4 py-2 bg-green-500/10 border-t border-green-500/20 text-xs text-green-400 font-medium flex items-center gap-1.5">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
          Ready for product synthesis
        </div>
      )}
    </Card>
  );
}

// Pain Point Card Component
function PainPointCard({ 
  painPoint, 
  selectedTopic,
  onTopicClick 
}: { 
  painPoint: PainPoint;
  selectedTopic: string | null;
  onTopicClick: (topic: string) => void;
}) {
  return (
    <Card padding="md">
      <div className="flex items-start gap-4">
        {/* Severity */}
        <div className="shrink-0">
          <SeverityBadge severity={painPoint.severity} />
        </div>
        
        {/* Content */}
        <div className="flex-1 min-w-0">
          <p className="text-gray-300 text-sm italic leading-relaxed">
            "{painPoint.raw_quote}"
          </p>
          
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-gray-500">— {painPoint.author}</span>
            <Badge variant="purple" size="sm">r/{painPoint.subreddit}</Badge>
            <Badge variant="blue" size="sm">{painPoint.persona.replace(/_/g, ' ')}</Badge>
            {painPoint.cluster_id && (
              <Badge variant="green" size="sm" dot>Clustered</Badge>
            )}
          </div>
          
          {/* Topics */}
          <div className="mt-3 flex flex-wrap gap-1.5">
            {painPoint.topics.map(t => (
              <button
                key={t}
                onClick={(e) => {
                  e.stopPropagation();
                  onTopicClick(t);
                }}
                className={`
                  badge transition-colors cursor-pointer
                  ${selectedTopic === t
                    ? 'badge-brand'
                    : 'badge-gray hover:bg-brand-500/20 hover:text-brand-300 hover:border-brand-500/30'}
                `}
              >
                {t.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
        </div>
        
        {/* Score */}
        <div className="shrink-0 text-right">
          <div className="text-sm font-semibold text-gray-400">↑ {painPoint.source_score}</div>
        </div>
      </div>
    </Card>
  );
}
