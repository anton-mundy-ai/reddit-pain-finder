// v17: Trends page with professional design
import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { fetchTrends, fetchTrendHistory } from '../api';
import { TrendSummary, TrendStatus, TrendHistory } from '../types';
import {
  Card, CardHeader, CardTitle,
  Badge, StatusBadge,
  StatCard, StatGrid,
  Button, ButtonLink,
  EmptyState,
  SimpleTabs,
  Sparkline,
  Modal,
  SkeletonCard, SkeletonStats
} from '../components/ui';

// Velocity display
function VelocityDisplay({ velocity }: { velocity: number }) {
  const percent = Math.round(velocity * 100);
  const isPositive = percent > 0;
  const isNegative = percent < 0;
  
  return (
    <span className={`
      font-mono text-sm font-semibold
      ${isPositive ? 'text-green-400' : isNegative ? 'text-red-400' : 'text-gray-500'}
    `}>
      {isPositive && '+'}{percent}%
    </span>
  );
}

// Trend card
function TrendCard({ trend, onViewHistory }: { trend: TrendSummary; onViewHistory: (topic: string) => void }) {
  return (
    <Card hover padding="none" className="overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-white capitalize truncate">
              {trend.topic_canonical.replace(/_/g, ' ')}
            </h3>
            {trend.product_name && (
              <p className="text-sm text-gray-500 mt-0.5 truncate">{trend.product_name}</p>
            )}
          </div>
          <StatusBadge status={trend.trend_status} size="sm" />
        </div>
        
        {/* Stats */}
        <div className="flex items-center gap-4 text-sm mb-4">
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Mentions:</span>
            <span className="font-semibold text-white">{trend.current_count}</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="text-gray-500">Velocity:</span>
            <VelocityDisplay velocity={trend.current_velocity} />
          </div>
        </div>
        
        {/* Sparkline */}
        <div className="mb-4">
          <Sparkline 
            data={trend.sparkline} 
            width={260} 
            height={50}
            showArea
          />
          <div className="flex justify-between text-2xs text-gray-500 mt-1">
            <span>30 days ago</span>
            <span>Today</span>
          </div>
        </div>
        
        {/* Peak info */}
        <div className="text-xs text-gray-500 mb-4">
          Peak: <span className="text-gray-400 font-medium">{trend.peak_count}</span> on {trend.peak_date}
        </div>
      </div>
      
      {/* Actions */}
      <div className="flex items-center justify-between px-4 py-3 bg-dark-750/50 border-t border-dark-600">
        <button
          onClick={() => onViewHistory(trend.topic_canonical)}
          className="text-sm text-brand-400 hover:text-brand-300 font-medium transition-colors"
        >
          View History →
        </button>
        {trend.cluster_id && (
          <Link
            to={`/opportunity/${trend.cluster_id}`}
            className="text-sm text-blue-400 hover:text-blue-300 font-medium transition-colors"
          >
            View Product →
          </Link>
        )}
      </div>
    </Card>
  );
}

// History modal
function HistoryModal({ 
  history, 
  isOpen,
  onClose 
}: { 
  history: TrendHistory | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  if (!history) return null;
  
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`${history.topic.replace(/_/g, ' ')} - History`}
      size="lg"
    >
      {history.snapshots.length === 0 ? (
        <EmptyState
          icon="📊"
          title="No historical data"
          description="Historical data will appear once we have more snapshots."
        />
      ) : (
        <div className="overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Date</th>
                <th className="text-center">Mentions</th>
                <th className="text-center">Velocity</th>
                <th className="text-center">Status</th>
              </tr>
            </thead>
            <tbody>
              {history.snapshots.slice().reverse().map((snap, i) => (
                <tr key={i}>
                  <td className="text-gray-300">{snap.date}</td>
                  <td className="text-center font-medium text-white">{snap.count}</td>
                  <td className="text-center">
                    {snap.velocity !== null ? (
                      <VelocityDisplay velocity={snap.velocity} />
                    ) : (
                      <span className="text-gray-500">-</span>
                    )}
                  </td>
                  <td className="text-center">
                    <StatusBadge status={snap.status} size="sm" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
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
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            📈 Trend Detection
          </h1>
          <p className="text-gray-400 mt-1">
            Track rising and cooling pain points over time
          </p>
        </div>
        <ButtonLink to="/" variant="ghost" icon={
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        }>
          Back to Opportunities
        </ButtonLink>
      </div>

      {/* Stats Summary */}
      {loading ? (
        <SkeletonStats count={5} />
      ) : stats && (
        <StatGrid cols={5}>
          <StatCard 
            icon="📊"
            value={stats.total_tracked.toString()} 
            label="Topics Tracked"
          />
          <StatCard 
            icon="🔥"
            value={stats.hot_count.toString()} 
            label="Hot Topics"
            variant="danger"
          />
          <StatCard 
            icon="📈"
            value={stats.rising_count.toString()} 
            label="Rising"
            variant="success"
          />
          <StatCard 
            icon="📉"
            value={stats.cooling_count.toString()} 
            label="Cooling"
            variant="brand"
          />
          <StatCard 
            value={stats.last_snapshot || 'Never'} 
            label="Last Snapshot"
            size="sm"
          />
        </StatGrid>
      )}

      {/* Controls */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <SimpleTabs
          tabs={[
            { id: 'all', label: 'All', icon: '📊' },
            { id: 'hot', label: `Hot (${trends.hot.length})`, icon: '🔥' },
            { id: 'rising', label: `Rising (${trends.rising.length})`, icon: '📈' },
            { id: 'cooling', label: `Cooling (${trends.cooling.length})`, icon: '📉' },
          ]}
          value={activeTab}
          onChange={(v) => setActiveTab(v as typeof activeTab)}
        />

        <SimpleTabs
          tabs={[
            { id: '7d', label: '7 days' },
            { id: '30d', label: '30 days' },
            { id: '90d', label: '90 days' },
          ]}
          value={period}
          onChange={(v) => setPeriod(v as typeof period)}
        />
      </div>

      {/* Trends Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <EmptyState
          icon="😕"
          title="Failed to load trends"
          description={error}
          action={{ label: 'Try again', onClick: loadTrends }}
        />
      ) : visibleTrends.length === 0 ? (
        <EmptyState
          icon="📊"
          title="No trends yet"
          description="Trends will appear once we have historical data. Check back after a few days of data collection."
        />
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

      {/* History Modal */}
      <HistoryModal
        history={historyData}
        isOpen={!!historyTopic}
        onClose={() => {
          setHistoryTopic(null);
          setHistoryData(null);
        }}
      />
    </div>
  );
}
