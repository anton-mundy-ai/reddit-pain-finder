import { useState, useEffect } from 'react';
import { fetchOpportunities, fetchStats } from '../api';
import { Opportunity, Stats } from '../types';
import OpportunityCard from '../components/OpportunityCard';

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="bg-dark-700 rounded-xl p-4 border border-dark-600">
      <div className="text-3xl font-bold text-white">{value.toLocaleString()}</div>
      <div className="text-sm text-gray-400 mt-1">{label}</div>
    </div>
  );
}

export default function HomePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [auOnly, setAuOnly] = useState(false);
  const [minScore, setMinScore] = useState(0);

  useEffect(() => { loadData(); }, [auOnly, minScore]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [opps, statsData] = await Promise.all([
        fetchOpportunities({ limit: 50, auOnly, minScore: minScore || undefined }),
        fetchStats()
      ]);
      setOpportunities(opps);
      setStats(statsData);
    } catch (err) {
      setError('Failed to load data. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="text-center py-8">
        <h1 className="text-4xl font-bold text-white mb-4">Discover Startup Opportunities</h1>
        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
          AI-powered analysis of Reddit discussions to find real pain points and unmet needs.
        </p>
      </div>

      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Posts Analyzed" value={stats.raw_posts} />
          <StatCard label="Pain Points Found" value={stats.pain_records} />
          <StatCard label="Opportunity Clusters" value={stats.clusters} />
          <StatCard label="Scored Opportunities" value={stats.scored_clusters} />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-4 py-4 border-b border-dark-600">
        <label className="flex items-center gap-2">
          <input type="checkbox" checked={auOnly} onChange={(e) => setAuOnly(e.target.checked)}
                 className="w-4 h-4 rounded border-dark-500 bg-dark-700 text-indigo-600" />
          <span className="text-gray-300">🇦🇺 Australia-focused only</span>
        </label>
        <label className="flex items-center gap-2">
          <span className="text-gray-300">Min score:</span>
          <select value={minScore} onChange={(e) => setMinScore(parseInt(e.target.value))}
                  className="bg-dark-700 border border-dark-500 rounded-lg px-3 py-1.5 text-white">
            <option value="0">All</option>
            <option value="30">30+</option>
            <option value="50">50+</option>
            <option value="70">70+</option>
          </select>
        </label>
        <button onClick={loadData} disabled={loading}
                className="ml-auto px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white font-medium disabled:opacity-50">
          {loading ? 'Loading...' : 'Refresh'}
        </button>
      </div>

      {error && <div className="bg-red-900/30 border border-red-700 rounded-lg p-4 text-red-300">{error}</div>}

      {loading && opportunities.length === 0 && (
        <div className="text-center py-16">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-4 border-indigo-500 border-t-transparent"></div>
          <p className="mt-4 text-gray-400">Loading opportunities...</p>
        </div>
      )}

      {!loading && opportunities.length === 0 && (
        <div className="text-center py-16">
          <p className="text-xl text-gray-400">No opportunities found yet.</p>
          <p className="text-gray-500 mt-2">Check back soon as more data is processed.</p>
        </div>
      )}

      <div className="space-y-4">
        {opportunities.map((opp, index) => (
          <OpportunityCard key={opp.id} opportunity={opp} rank={index + 1} />
        ))}
      </div>
    </div>
  );
}
