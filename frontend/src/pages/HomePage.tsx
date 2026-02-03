// v5: Home page with product-focused cards
import { useState, useEffect } from 'react';
import { fetchOpportunities, fetchStats } from '../api';
import { Opportunity, Stats } from '../types';
import OpportunityCard from '../components/OpportunityCard';

export default function HomePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [oppData, statsData] = await Promise.all([
          fetchOpportunities(30),
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
  }, []);

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
    <div className="space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Reddit Pain Finder
        </h1>
        <p className="text-gray-600">
          Product opportunities discovered from real user frustrations
        </p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <StatCard label="Comments Analyzed" value={stats.raw_comments.toLocaleString()} />
          <StatCard label="Pain Points Found" value={stats.pain_records.toLocaleString()} />
          <StatCard label="Products Generated" value={stats.products_generated.toLocaleString()} />
          <StatCard label="Total Mentions" value={stats.total_social_proof.toLocaleString()} />
        </div>
      )}

      {/* Opportunities Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {opportunities.map(opp => (
          <OpportunityCard key={opp.id} opportunity={opp} />
        ))}
      </div>

      {opportunities.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <p>No product opportunities yet. Pipeline is processing...</p>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-white rounded-lg p-4 shadow-sm border border-gray-100">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}
