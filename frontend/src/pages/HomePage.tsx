// v7: Home page with embedding-based clustering
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchOpportunities, fetchStats } from '../api';
import { Opportunity, Stats } from '../types';
import OpportunityRow from '../components/OpportunityRow';

export default function HomePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'mentions'>('mentions'); // v7: Default to mentions
  const [showAll, setShowAll] = useState(false); // v7: Toggle for 5+ filter

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        const [oppData, statsData] = await Promise.all([
          fetchOpportunities(100, 5, showAll),  // v7: Pass showAll flag
          fetchStats()
        ]);
        setOpportunities(oppData.opportunities || []);
        setStats(statsData);
      } catch (err) {
        setError('Failed to load data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [showAll]); // Reload when filter changes

  const sortedOpportunities = [...opportunities].sort((a, b) => {
    if (sortBy === 'mentions') {
      return b.social_proof_count - a.social_proof_count;
    }
    return b.total_score - a.total_score;
  });

  // v7: Filter by 5+ mentions unless showAll
  const filteredOpportunities = showAll 
    ? sortedOpportunities 
    : sortedOpportunities.filter(o => o.social_proof_count >= 5);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-4 border-blue-500 border-t-transparent"></div>
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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-center flex-1">
          <h1 className="text-3xl font-bold text-gray-900">
            Reddit Pain Finder <span className="text-purple-600">v7</span>
          </h1>
          <p className="text-gray-600">
            Semantic clustering • Embedding-based similarity
          </p>
        </div>
        <Link 
          to="/topics" 
          className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium hover:bg-purple-200 transition-colors"
        >
          📊 Explore Topics
        </Link>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          <StatCard 
            label="Comments" 
            value={(stats.raw_comments + stats.hn_comments).toLocaleString()} 
            sublabel="analyzed"
          />
          <StatCard 
            label="Pain Points" 
            value={stats.pain_records.toLocaleString()} 
            sublabel="extracted"
          />
          <StatCard 
            label="Embeddings" 
            value={(stats.embeddings || 0).toLocaleString()} 
            sublabel="generated"
            highlight
          />
          <StatCard 
            label="Clusters" 
            value={stats.clusters.toLocaleString()} 
            sublabel={`avg ${stats.avg_cluster_size || '?'}/cluster`}
          />
          <StatCard 
            label="Qualifying" 
            value={stats.qualifying_clusters.toLocaleString()} 
            sublabel="5+ mentions"
            highlight
          />
          <StatCard 
            label="Products" 
            value={stats.products_generated.toLocaleString()} 
            sublabel="generated"
          />
        </div>
      )}

      {/* v7: Pipeline explanation */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-100">
        <div className="flex items-center gap-3 text-sm flex-wrap">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-gray-700">1.</span>
            <span className="text-gray-600">Nano filters</span>
          </div>
          <span className="text-gray-400">→</span>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-gray-700">2.</span>
            <span className="text-gray-600">GPT-5.2 tags</span>
          </div>
          <span className="text-gray-400">→</span>
          <div className="flex items-center gap-1 text-purple-700">
            <span className="font-semibold">3.</span>
            <span className="font-medium">Embeddings</span>
            <span className="text-xs bg-purple-200 px-1 rounded">NEW</span>
          </div>
          <span className="text-gray-400">→</span>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-gray-700">4.</span>
            <span className="text-gray-600">Semantic clustering</span>
          </div>
          <span className="text-gray-400">→</span>
          <div className="flex items-center gap-1 text-green-700 font-medium">
            <span className="font-semibold">5.</span>
            <span>5+ = Product</span>
          </div>
        </div>
      </div>

      {/* List Controls */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-100 px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{filteredOpportunities.length}</span> 
            {showAll ? ' total clusters' : ' products with 5+ mentions'}
          </div>
          
          {/* v7: Filter toggle */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input 
              type="checkbox"
              checked={showAll}
              onChange={(e) => setShowAll(e.target.checked)}
              className="rounded border-gray-300 text-purple-600 focus:ring-purple-500"
            />
            <span className="text-sm text-gray-500">Show all clusters</span>
          </label>
        </div>
        
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Sort by:</span>
          <select 
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'score' | 'mentions')}
            className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
          >
            <option value="mentions">Mentions (↓)</option>
            <option value="score">Score</option>
          </select>
        </div>
      </div>

      {/* Opportunities List */}
      {filteredOpportunities.length > 0 ? (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <div className="w-8 text-center">#</div>
            <div className="flex-1">Product / Topic</div>
            <div className="w-20 text-center">Mentions</div>
            <div className="w-16 text-center">Score</div>
            <div className="hidden md:block w-[120px]">Personas</div>
            <div className="w-5"></div>
          </div>
          
          {filteredOpportunities.map((opp, index) => (
            <OpportunityRow 
              key={opp.id} 
              opportunity={opp} 
              rank={index + 1}
              showMentionsBadge={true}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <div className="text-6xl mb-4">🔄</div>
          <p className="text-gray-600 font-medium">No products with 5+ mentions yet</p>
          <p className="text-gray-500 text-sm mt-1">
            Pipeline is processing... Check the{' '}
            <Link to="/topics" className="text-purple-600 hover:underline">
              Topics page
            </Link>
            {' '}to see what's being captured.
          </p>
          <button 
            onClick={() => setShowAll(true)}
            className="mt-4 px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200"
          >
            Show all clusters anyway
          </button>
        </div>
      )}

      {/* Mention count distribution */}
      {stats && stats.clusters > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Cluster Distribution</h3>
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-600">5+ mentions: <strong>{stats.qualifying_clusters}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <span className="text-gray-600">2-4 mentions: <strong>{stats.clusters - stats.qualifying_clusters}</strong></span>
            </div>
            <div className="text-gray-400">|</div>
            <div className="text-gray-500">
              Average: <strong>{stats.avg_cluster_size || '?'}</strong> per cluster
            </div>
          </div>
        </div>
      )}

      {/* Footer note */}
      <div className="text-center text-xs text-gray-400">
        Data from Reddit + HackerNews • v7 uses embeddings for semantic similarity clustering
      </div>
    </div>
  );
}

function StatCard({ label, value, sublabel, highlight }: { label: string; value: string; sublabel?: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg p-3 shadow-sm border ${highlight ? 'bg-purple-50 border-purple-200' : 'bg-white border-gray-100'}`}>
      <div className={`text-xl font-bold ${highlight ? 'text-purple-700' : 'text-gray-900'}`}>{value}</div>
      <div className="text-xs text-gray-500">{label}</div>
      {sublabel && <div className="text-xs text-gray-400 mt-0.5">{sublabel}</div>}
    </div>
  );
}
