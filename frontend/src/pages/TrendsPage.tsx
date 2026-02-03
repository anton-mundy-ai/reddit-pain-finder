// v10: Trends visualization page
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchTrends, fetchTrendHistory } from '../api';
import { TrendSummary, TrendStatus, TrendHistory } from '../types';

// Simple sparkline component
function Sparkline({ data, height = 30, width = 100 }: { data: number[]; height?: number; width?: number }) {
  if (!data || data.length === 0) return <span className="text-gray-400 text-xs">No data</span>;
  
  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  
  const points = data.map((value, i) => {
    const x = (i / (data.length - 1)) * width;
    const y = height - ((value - min) / range) * height;
    return `${x},${y}`;
  }).join(' ');
  
  // Determine color based on trend
  const first = data[0] || 0;
  const last = data[data.length - 1] || 0;
  const color = last > first ? '#22c55e' : last < first ? '#ef4444' : '#6b7280';
  
  return (
    <svg width={width} height={height} className="inline-block">
      <polyline
        fill="none"
        stroke={color}
        strokeWidth="2"
        points={points}
      />
    </svg>
  );
}

// Trend status badge
function StatusBadge({ status }: { status: TrendStatus }) {
  const configs: Record<TrendStatus, { icon: string; bg: string; text: string; label: string }> = {
    hot: { icon: '🔥', bg: 'bg-red-100', text: 'text-red-800', label: 'Hot' },
    rising: { icon: '📈', bg: 'bg-green-100', text: 'text-green-800', label: 'Rising' },
    stable: { icon: '➖', bg: 'bg-gray-100', text: 'text-gray-800', label: 'Stable' },
    cooling: { icon: '📉', bg: 'bg-blue-100', text: 'text-blue-800', label: 'Cooling' },
    cold: { icon: '❄️', bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Cold' },
  };
  
  const config = configs[status] || configs.stable;
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-sm font-medium ${config.bg} ${config.text}`}>
      {config.icon} {config.label}
    </span>
  );
}

// Velocity display
function VelocityDisplay({ velocity }: { velocity: number }) {
  const percent = Math.round(velocity * 100);
  const isPositive = percent > 0;
  const isNegative = percent < 0;
  
  return (
    <span className={`font-mono text-sm ${
      isPositive ? 'text-green-600' : isNegative ? 'text-red-600' : 'text-gray-500'
    }`}>
      {isPositive && '+'}{percent}%
    </span>
  );
}

// Trend card component
function TrendCard({ trend, onViewHistory }: { trend: TrendSummary; onViewHistory: (topic: string) => void }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 capitalize">
            {trend.topic_canonical.replace(/_/g, ' ')}
          </h3>
          {trend.product_name && (
            <p className="text-sm text-gray-500 mt-0.5">{trend.product_name}</p>
          )}
        </div>
        <StatusBadge status={trend.trend_status} />
      </div>
      
      {/* Stats row */}
      <div className="flex items-center gap-4 text-sm mb-3">
        <div>
          <span className="text-gray-500">Mentions:</span>
          <span className="ml-1 font-semibold text-gray-900">{trend.current_count}</span>
        </div>
        <div>
          <span className="text-gray-500">Velocity:</span>
          <span className="ml-1"><VelocityDisplay velocity={trend.current_velocity} /></span>
        </div>
        <div>
          <span className="text-gray-500">Peak:</span>
          <span className="ml-1 font-medium text-gray-700">{trend.peak_count}</span>
        </div>
      </div>
      
      {/* Sparkline */}
      <div className="mb-3">
        <Sparkline data={trend.sparkline} width={200} height={40} />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>30d ago</span>
          <span>Today</span>
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => onViewHistory(trend.topic_canonical)}
          className="text-sm text-purple-600 hover:text-purple-800"
        >
          View History →
        </button>
        {trend.cluster_id && (
          <Link
            to={`/opportunity/${trend.cluster_id}`}
            className="text-sm text-blue-600 hover:text-blue-800 ml-auto"
          >
            View Product →
          </Link>
        )}
      </div>
    </div>
  );
}

// History modal
function HistoryModal({ 
  history, 
  onClose 
}: { 
  history: TrendHistory | null; 
  onClose: () => void;
}) {
  if (!history) return null;
  
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        <div className="p-4 border-b flex items-center justify-between">
          <h2 className="text-xl font-semibold capitalize">
            {history.topic.replace(/_/g, ' ')} - History
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-2xl">
            ×
          </button>
        </div>
        
        <div className="p-4 overflow-y-auto max-h-[60vh]">
          {history.snapshots.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No historical data available yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b">
                  <th className="pb-2 font-medium text-gray-600">Date</th>
                  <th className="pb-2 font-medium text-gray-600">Mentions</th>
                  <th className="pb-2 font-medium text-gray-600">Velocity</th>
                  <th className="pb-2 font-medium text-gray-600">Status</th>
                </tr>
              </thead>
              <tbody>
                {history.snapshots.slice().reverse().map((snap, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-2 text-gray-700">{snap.date}</td>
                    <td className="py-2 font-medium">{snap.count}</td>
                    <td className="py-2">
                      {snap.velocity !== null ? (
                        <VelocityDisplay velocity={snap.velocity} />
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="py-2">
                      <StatusBadge status={snap.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}

export default function TrendsPage() {
  const [trends, setTrends] = useState<{
    hot: TrendSummary[];
    rising: TrendSummary[];
    stable: TrendSummary[];
    cooling: TrendSummary[];
  }>({ hot: [], rising: [], stable: [], cooling: [] });
  const [stats, setStats] = useState<{
    total_tracked: number;
    hot_count: number;
    rising_count: number;
    stable_count: number;
    cooling_count: number;
    last_snapshot: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('7d');
  const [activeTab, setActiveTab] = useState<'all' | 'hot' | 'rising' | 'cooling'>('all');
  const [historyTopic, setHistoryTopic] = useState<string | null>(null);
  const [historyData, setHistoryData] = useState<TrendHistory | null>(null);

  const loadTrends = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchTrends({ limit: 100, period });
      setTrends(data.categorized || { hot: [], rising: [], stable: [], cooling: [] });
      setStats(data.stats || null);
    } catch (err) {
      setError('Failed to load trends');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, [period]);

  useEffect(() => {
    loadTrends();
  }, [loadTrends]);

  const handleViewHistory = async (topic: string) => {
    setHistoryTopic(topic);
    try {
      const data = await fetchTrendHistory(topic, 90);
      setHistoryData(data.history);
    } catch (err) {
      console.error('Failed to load history:', err);
    }
  };

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
        <button onClick={loadTrends} className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
          Retry
        </button>
      </div>
    );
  }

  // Get visible trends based on active tab
  const getVisibleTrends = () => {
    switch (activeTab) {
      case 'hot': return trends.hot;
      case 'rising': return trends.rising;
      case 'cooling': return [...trends.cooling];
      default: return [...trends.hot, ...trends.rising, ...trends.stable.slice(0, 10), ...trends.cooling];
    }
  };

  const visibleTrends = getVisibleTrends();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">📊 Trend Detection</h1>
          <p className="text-gray-600">Track rising and cooling pain points over time</p>
        </div>
        <Link to="/" className="text-blue-600 hover:underline">
          ← Back to Opportunities
        </Link>
      </div>

      {/* Stats summary */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-white rounded-lg p-4 shadow-sm border">
            <div className="text-2xl font-bold text-gray-900">{stats.total_tracked}</div>
            <div className="text-sm text-gray-500">Topics Tracked</div>
          </div>
          <div className="bg-red-50 rounded-lg p-4 shadow-sm border border-red-100">
            <div className="text-2xl font-bold text-red-600">🔥 {stats.hot_count}</div>
            <div className="text-sm text-red-600">Hot Topics</div>
          </div>
          <div className="bg-green-50 rounded-lg p-4 shadow-sm border border-green-100">
            <div className="text-2xl font-bold text-green-600">📈 {stats.rising_count}</div>
            <div className="text-sm text-green-600">Rising</div>
          </div>
          <div className="bg-blue-50 rounded-lg p-4 shadow-sm border border-blue-100">
            <div className="text-2xl font-bold text-blue-600">📉 {stats.cooling_count}</div>
            <div className="text-sm text-blue-600">Cooling</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 shadow-sm border">
            <div className="text-sm font-medium text-gray-700">{stats.last_snapshot || 'Never'}</div>
            <div className="text-sm text-gray-500">Last Snapshot</div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap items-center gap-4">
        {/* Tab selector */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg">
          {[
            { key: 'all', label: 'All', icon: '📊' },
            { key: 'hot', label: 'Hot', icon: '🔥' },
            { key: 'rising', label: 'Rising', icon: '📈' },
            { key: 'cooling', label: 'Cooling', icon: '📉' },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                activeTab === tab.key
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.icon} {tab.label}
            </button>
          ))}
        </div>

        {/* Period selector */}
        <div className="flex gap-1 bg-gray-100 p-1 rounded-lg ml-auto">
          {(['7d', '30d', '90d'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                period === p
                  ? 'bg-white shadow-sm text-gray-900'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {p}
            </button>
          ))}
        </div>
      </div>

      {/* Trends grid */}
      {visibleTrends.length === 0 ? (
        <div className="text-center py-12 bg-white rounded-xl border">
          <div className="text-4xl mb-4">📊</div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No trends yet</h3>
          <p className="text-gray-500">
            Trends will appear once we have historical data. Check back after a few days of data collection.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {visibleTrends.map(trend => (
            <TrendCard 
              key={trend.topic_canonical} 
              trend={trend}
              onViewHistory={handleViewHistory}
            />
          ))}
        </div>
      )}

      {/* History modal */}
      {historyTopic && (
        <HistoryModal
          history={historyData}
          onClose={() => {
            setHistoryTopic(null);
            setHistoryData(null);
          }}
        />
      )}
    </div>
  );
}
