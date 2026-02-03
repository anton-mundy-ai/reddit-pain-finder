// v16: Home page with embedding-based clustering + market sizing + geo analysis
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchOpportunities, fetchStats, fetchGeoStats } from '../api';
import { Opportunity, Stats, RegionCode, GeoRegionStat, REGION_INFO } from '../types';
import OpportunityRow from '../components/OpportunityRow';

export default function HomePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [geoStats, setGeoStats] = useState<GeoRegionStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'mentions' | 'market'>('mentions');
  const [showAll, setShowAll] = useState(false);
  const [regionFilter, setRegionFilter] = useState<RegionCode | ''>(''); // v16: Region filter

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        
        // Build query params
        const params = new URLSearchParams({
          limit: '100',
          min: '5',
          sort: sortBy
        });
        if (showAll) params.set('all', 'true');
        if (regionFilter) params.set('region', regionFilter);
        
        const [oppData, statsData, geoData] = await Promise.all([
          fetch(`https://ideas.koda-software.com/api/opportunities?${params}`).then(r => r.json()),
          fetchStats(),
          fetchGeoStats().catch(() => ({ regions: [] }))
        ]);
        
        setOpportunities(oppData.opportunities || []);
        setStats(statsData);
        setGeoStats(geoData.regions || []);
      } catch (err) {
        setError('Failed to load data');
        console.error(err);
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [showAll, sortBy, regionFilter]);

  const sortedOpportunities = [...opportunities].sort((a, b) => {
    // If filtering by region, sort by region_percentage first
    if (regionFilter && a.region_percentage && b.region_percentage) {
      return b.region_percentage - a.region_percentage;
    }
    if (sortBy === 'mentions') {
      return b.social_proof_count - a.social_proof_count;
    }
    if (sortBy === 'market') {
      const aMarket = a.market?.tam_estimate || 0;
      const bMarket = b.market?.tam_estimate || 0;
      return bMarket - aMarket;
    }
    return b.total_score - a.total_score;
  });

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

  // Get region info for the selected filter
  const selectedRegionInfo = regionFilter ? REGION_INFO[regionFilter] : null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="text-center flex-1">
          <h1 className="text-3xl font-bold text-gray-900">
            Reddit Pain Finder <span className="text-purple-600">v16</span>
          </h1>
          <p className="text-gray-600">
            Semantic clustering • Market sizing • Trend detection • 🌏 Geographic analysis
          </p>
        </div>
        <div className="flex gap-2">
          <Link 
            to="/trends" 
            className="px-4 py-2 bg-orange-100 text-orange-700 rounded-lg font-medium hover:bg-orange-200 transition-colors"
          >
            🔥 Trends
          </Link>
          <Link 
            to="/topics" 
            className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg font-medium hover:bg-purple-200 transition-colors"
          >
            📊 Topics
          </Link>
        </div>
      </div>

      {/* Stats Row */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-8 gap-3">
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
          <StatCard 
            label="Market Sized" 
            value={(stats.market_estimated || 0).toLocaleString()} 
            sublabel={`${((stats.market_avg_confidence || 0) * 100).toFixed(0)}% avg conf`}
            highlight
          />
          <StatCard 
            label="🔥 Hot Trends" 
            value={(stats.trends_hot || 0).toLocaleString()} 
            sublabel={`of ${stats.trends_tracked || 0} tracked`}
          />
          <StatCard 
            label="🌏 Geo Tagged" 
            value={(stats.geo_tagged || 0).toLocaleString()} 
            sublabel={`${geoStats.length} regions`}
            highlight
          />
        </div>
      )}

      {/* v16: Geographic Distribution */}
      {geoStats.length > 0 && (
        <div className="bg-gradient-to-r from-emerald-50 to-blue-50 rounded-xl p-4 border border-emerald-100">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">🌏 Geographic Distribution</h3>
            {regionFilter && (
              <button
                onClick={() => setRegionFilter('')}
                className="text-xs text-gray-500 hover:text-gray-700 underline"
              >
                Clear filter
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {geoStats.map(geo => {
              const info = REGION_INFO[geo.region];
              const isActive = regionFilter === geo.region;
              return (
                <button
                  key={geo.region}
                  onClick={() => setRegionFilter(isActive ? '' : geo.region)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all ${
                    isActive 
                      ? 'bg-emerald-600 text-white shadow-md scale-105' 
                      : 'bg-white hover:bg-gray-50 border border-gray-200'
                  }`}
                >
                  <span className="text-lg">{info.emoji}</span>
                  <div className="text-left">
                    <div className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-700'}`}>
                      {info.name}
                    </div>
                    <div className={`text-xs ${isActive ? 'text-emerald-100' : 'text-gray-500'}`}>
                      {geo.pain_count.toLocaleString()} pain points ({geo.percentage}%)
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Pipeline explanation */}
      <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-xl p-4 border border-purple-100">
        <div className="flex items-center gap-2 text-sm flex-wrap">
          <div className="flex items-center gap-1">
            <span className="font-semibold text-gray-700">1.</span>
            <span className="text-gray-600">Filter</span>
          </div>
          <span className="text-gray-400">→</span>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-gray-700">2.</span>
            <span className="text-gray-600">Tag</span>
          </div>
          <span className="text-gray-400">→</span>
          <div className="flex items-center gap-1 text-emerald-700">
            <span className="font-semibold">3.</span>
            <span className="font-medium">🌏 Geo</span>
            <span className="text-xs bg-emerald-200 px-1 rounded">NEW</span>
          </div>
          <span className="text-gray-400">→</span>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-gray-700">4.</span>
            <span className="text-gray-600">Cluster</span>
          </div>
          <span className="text-gray-400">→</span>
          <div className="flex items-center gap-1">
            <span className="font-semibold text-gray-700">5.</span>
            <span className="text-gray-600">Synthesize</span>
          </div>
          <span className="text-gray-400">→</span>
          <div className="flex items-center gap-1 text-purple-700">
            <span className="font-semibold">6.</span>
            <span className="font-medium">💰 Market</span>
          </div>
          <span className="text-gray-400">→</span>
          <div className="flex items-center gap-1 text-orange-700">
            <span className="font-semibold">7.</span>
            <span className="font-medium">🔥 Trends</span>
          </div>
        </div>
      </div>

      {/* List Controls */}
      <div className="flex items-center justify-between bg-white rounded-lg shadow-sm border border-gray-100 px-4 py-3">
        <div className="flex items-center gap-4">
          <div className="text-sm text-gray-600">
            <span className="font-semibold text-gray-900">{filteredOpportunities.length}</span> 
            {showAll ? ' total clusters' : ' products with 5+ mentions'}
            {regionFilter && selectedRegionInfo && (
              <span className="ml-2 px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-full text-xs font-medium">
                {selectedRegionInfo.emoji} {selectedRegionInfo.name}
              </span>
            )}
          </div>
          
          {/* Filter toggle */}
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
        
        <div className="flex items-center gap-4">
          {/* v16: Region filter dropdown */}
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">🌏 Region:</span>
            <select 
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value as RegionCode | '')}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All Regions</option>
              <option value="AU">🇦🇺 Australia</option>
              <option value="US">🇺🇸 United States</option>
              <option value="UK">🇬🇧 United Kingdom</option>
              <option value="EU">🇪🇺 Europe</option>
              <option value="GLOBAL">🌍 Global</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-sm text-gray-500">Sort by:</span>
            <select 
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as 'score' | 'mentions' | 'market')}
              className="text-sm border border-gray-200 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="mentions">Mentions (↓)</option>
              <option value="market">💰 Market Size</option>
              <option value="score">Score</option>
            </select>
          </div>
        </div>
      </div>

      {/* Opportunities List */}
      {filteredOpportunities.length > 0 ? (
        <div className="bg-white rounded-xl shadow-md border border-gray-100 overflow-hidden">
          <div className="flex items-center gap-4 px-4 py-2 bg-gray-50 border-b border-gray-200 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <div className="w-8 text-center">#</div>
            <div className="flex-1">Product / Topic</div>
            {regionFilter && <div className="w-16 text-center">Region %</div>}
            <div className="w-16 text-center hidden md:block">Market</div>
            <div className="w-20 text-center">Mentions</div>
            <div className="w-16 text-center">Score</div>
            <div className="hidden lg:block w-[120px]">Personas</div>
            <div className="w-5"></div>
          </div>
          
          {filteredOpportunities.map((opp, index) => (
            <OpportunityRow 
              key={opp.id} 
              opportunity={opp} 
              rank={index + 1}
              showMentionsBadge={true}
              showRegionPercentage={!!regionFilter}
            />
          ))}
        </div>
      ) : (
        <div className="text-center py-12 bg-white rounded-lg shadow-sm">
          <div className="text-6xl mb-4">{regionFilter ? '🌏' : '🔄'}</div>
          <p className="text-gray-600 font-medium">
            {regionFilter 
              ? `No products with 5+ mentions in ${REGION_INFO[regionFilter]?.name || regionFilter}` 
              : 'No products with 5+ mentions yet'}
          </p>
          <p className="text-gray-500 text-sm mt-1">
            {regionFilter 
              ? 'Try a different region or check the Topics page'
              : 'Pipeline is processing... Check the Topics page to see what\'s being captured.'}
          </p>
          <div className="flex gap-2 justify-center mt-4">
            {regionFilter && (
              <button 
                onClick={() => setRegionFilter('')}
                className="px-4 py-2 bg-emerald-100 text-emerald-700 rounded-lg text-sm font-medium hover:bg-emerald-200"
              >
                Clear region filter
              </button>
            )}
            <button 
              onClick={() => setShowAll(true)}
              className="px-4 py-2 bg-purple-100 text-purple-700 rounded-lg text-sm font-medium hover:bg-purple-200"
            >
              Show all clusters anyway
            </button>
          </div>
        </div>
      )}

      {/* Mention count distribution */}
      {stats && stats.clusters > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-100 p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-2">Cluster Distribution</h3>
          <div className="flex items-center gap-4 text-sm flex-wrap">
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
            {stats.geo_tagged && stats.geo_tagged > 0 && (
              <>
                <div className="text-gray-400">|</div>
                <div className="text-gray-500">
                  🌏 Geo-tagged: <strong>{stats.geo_tagged.toLocaleString()}</strong>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Footer note */}
      <div className="text-center text-xs text-gray-400">
        Data from Reddit + HackerNews • v16 uses embeddings for semantic similarity clustering + geographic analysis
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
