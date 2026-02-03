// v6.1: Topics visualization page
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchTopics, fetchPainPoints } from '../api';
import { Topic, PainPoint } from '../types';

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-purple-500 border-t-transparent"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <p className="text-red-600">{error}</p>
      </div>
    );
  }

  // Filter pain points by selected topic
  const filteredPainPoints = selectedTopic
    ? painPoints.filter(p => p.topics.includes(selectedTopic))
    : painPoints;

  // Severity color
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 text-red-800';
      case 'high': return 'bg-orange-100 text-orange-800';
      case 'medium': return 'bg-yellow-100 text-yellow-800';
      case 'low': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Pain Point Explorer</h1>
          <p className="text-gray-600">Visualize topics and raw pain points</p>
        </div>
        <Link to="/" className="text-blue-600 hover:underline">
          ← Back to Products
        </Link>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => { setView('topics'); setSelectedTopic(null); }}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            view === 'topics' 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📊 Topics ({topics.length})
        </button>
        <button
          onClick={() => setView('painpoints')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            view === 'painpoints' 
              ? 'bg-purple-600 text-white' 
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          💬 Pain Points ({painPoints.length})
        </button>
      </div>

      {/* Selected Topic Filter */}
      {selectedTopic && (
        <div className="flex items-center gap-2 bg-purple-50 rounded-lg px-4 py-2">
          <span className="text-purple-700">Filtering by:</span>
          <span className="font-semibold text-purple-900">{selectedTopic.replace(/_/g, ' ')}</span>
          <button 
            onClick={() => setSelectedTopic(null)}
            className="ml-2 text-purple-600 hover:text-purple-800"
          >
            ✕ Clear
          </button>
        </div>
      )}

      {/* Topics View */}
      {view === 'topics' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {topics.map(topic => (
            <div 
              key={topic.topic}
              onClick={() => { setSelectedTopic(topic.topic); setView('painpoints'); }}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 cursor-pointer hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between mb-2">
                <h3 className="font-semibold text-gray-900 capitalize">
                  {topic.topic.replace(/_/g, ' ')}
                </h3>
                <span className={`px-2.5 py-0.5 rounded-full text-sm font-bold ${
                  topic.count >= 5 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                }`}>
                  {topic.count}
                </span>
              </div>
              
              {/* Severity breakdown bar */}
              <div className="flex h-2 rounded-full overflow-hidden bg-gray-100 mb-2">
                {topic.severity_breakdown.critical > 0 && (
                  <div 
                    className="bg-red-500" 
                    style={{ width: `${(topic.severity_breakdown.critical / topic.count) * 100}%` }}
                  />
                )}
                {topic.severity_breakdown.high > 0 && (
                  <div 
                    className="bg-orange-500" 
                    style={{ width: `${(topic.severity_breakdown.high / topic.count) * 100}%` }}
                  />
                )}
                {topic.severity_breakdown.medium > 0 && (
                  <div 
                    className="bg-yellow-500" 
                    style={{ width: `${(topic.severity_breakdown.medium / topic.count) * 100}%` }}
                  />
                )}
                {topic.severity_breakdown.low > 0 && (
                  <div 
                    className="bg-green-500" 
                    style={{ width: `${(topic.severity_breakdown.low / topic.count) * 100}%` }}
                  />
                )}
              </div>
              
              {/* Personas */}
              <div className="flex flex-wrap gap-1 mb-2">
                {topic.personas.slice(0, 3).map(p => (
                  <span key={p} className="px-2 py-0.5 text-xs bg-blue-50 text-blue-700 rounded-full capitalize">
                    {p.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
              
              {/* Subreddits */}
              <div className="text-xs text-gray-500">
                {topic.subreddits.slice(0, 3).map(s => `r/${s}`).join(', ')}
                {topic.subreddits.length > 3 && ` +${topic.subreddits.length - 3}`}
              </div>
              
              {topic.count >= 5 && (
                <div className="mt-2 text-xs text-green-600 font-medium">
                  ✓ Ready for product
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Pain Points View */}
      {view === 'painpoints' && (
        <div className="space-y-3">
          {filteredPainPoints.map(pp => (
            <div 
              key={pp.id}
              className="bg-white rounded-lg shadow-sm border border-gray-100 p-4"
            >
              <div className="flex items-start gap-3">
                {/* Severity indicator */}
                <div className={`px-2 py-0.5 text-xs font-medium rounded ${getSeverityColor(pp.severity)}`}>
                  {pp.severity}
                </div>
                
                {/* Quote */}
                <div className="flex-1">
                  <p className="text-gray-700 text-sm italic">"{pp.raw_quote}"</p>
                  <div className="mt-2 flex flex-wrap gap-2 items-center">
                    <span className="text-xs text-gray-500">
                      — {pp.author} in r/{pp.subreddit}
                    </span>
                    <span className="text-xs text-gray-400">|</span>
                    <span className="text-xs text-blue-600 capitalize">
                      {pp.persona.replace(/_/g, ' ')}
                    </span>
                    {pp.cluster_id && (
                      <>
                        <span className="text-xs text-gray-400">|</span>
                        <span className="text-xs text-green-600">
                          ✓ Clustered
                        </span>
                      </>
                    )}
                  </div>
                  
                  {/* Topics */}
                  <div className="mt-2 flex flex-wrap gap-1">
                    {pp.topics.map(t => (
                      <button
                        key={t}
                        onClick={() => setSelectedTopic(t)}
                        className={`px-2 py-0.5 text-xs rounded-full transition-colors ${
                          selectedTopic === t
                            ? 'bg-purple-600 text-white'
                            : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                        }`}
                      >
                        {t.replace(/_/g, ' ')}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Score */}
                <div className="text-right">
                  <div className="text-sm font-semibold text-gray-600">↑ {pp.source_score}</div>
                </div>
              </div>
            </div>
          ))}
          
          {filteredPainPoints.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              No pain points found for this topic.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
