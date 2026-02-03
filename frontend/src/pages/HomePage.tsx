// v17: Home page with dark mode + component library
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { fetchOpportunities, fetchStats, fetchGeoStats } from '../api';
import { Opportunity, Stats, RegionCode, GeoRegionStat, REGION_INFO } from '../types';
import OpportunityRow from '../components/OpportunityRow';
import {
  Card, CardHeader, CardTitle,
  Badge,
  StatCard, StatGrid,
  Button, ButtonLink,
  EmptyState, LoadingState,
  SimpleTabs
} from '../components/ui';

export default function HomePage() {
  const [opportunities, setOpportunities] = useState<Opportunity[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [geoStats, setGeoStats] = useState<GeoRegionStat[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<'score' | 'mentions' | 'market'>('mentions');
  const [showAll, setShowAll] = useState(false);
  const [regionFilter, setRegionFilter] = useState<RegionCode | ''>('');

  useEffect(() => {
    async function load() {
      try {
        setLoading(true);
        
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
    return <LoadingState title="Loading opportunities..." description="Fetching latest pain points" />;
  }

  if (error) {
    return (
      <EmptyState
        icon="😕"
        title="Failed to load"
        description={error}
        action={{ label: 'Try again', onClick: () => window.location.reload() }}
      />
    );
  }

  const selectedRegionInfo = regionFilter ? REGION_INFO[regionFilter] : null;

  return (
    <div className="space-y-6">
      {/* Stats Row */}
      {stats && (
        <StatGrid cols={4}>
          <StatCard 
            icon="💬"
            value={(stats.raw_comments + stats.hn_comments).toLocaleString()} 
            label="Comments Analyzed"
            size="sm"
          />
          <StatCard 
            icon="😣"
            value={stats.pain_records.toLocaleString()} 
            label="Pain Points"
            size="sm"
          />
          <StatCard 
            icon="🔗"
            value={stats.clusters.toLocaleString()} 
            label="Clusters"
            sublabel={`avg ${stats.avg_cluster_size || '?'}/cluster`}
            size="sm"
          />
          <StatCard 
            icon="✅"
            value={stats.qualifying_clusters.toLocaleString()} 
            label="Qualifying (5+)"
            variant="success"
            size="sm"
          />
        </StatGrid>
      )}
      
      {/* Secondary Stats */}
      {stats && (
        <StatGrid cols={4}>
          <StatCard 
            icon="📦"
            value={stats.products_generated.toLocaleString()} 
            label="Products Generated"
            size="sm"
          />
          <StatCard 
            icon="💰"
            value={(stats.market_estimated || 0).toLocaleString()} 
            label="Market Sized"
            sublabel={`${((stats.market_avg_confidence || 0) * 100).toFixed(0)}% avg conf`}
            variant="brand"
            size="sm"
          />
          <StatCard 
            icon="🔥"
            value={(stats.trends_hot || 0).toLocaleString()} 
            label="Hot Trends"
            sublabel={`of ${stats.trends_tracked || 0} tracked`}
            size="sm"
          />
          <StatCard 
            icon="🌏"
            value={(stats.geo_tagged || 0).toLocaleString()} 
            label="Geo Tagged"
            sublabel={`${geoStats.length} regions`}
            variant="success"
            size="sm"
          />
        </StatGrid>
      )}

      {/* Geographic Distribution */}
      {geoStats.length > 0 && (
        <Card padding="md" className="bg-gradient-to-r from-emerald-500/10 to-blue-500/10 border-emerald-500/30">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-300">🌏 Geographic Distribution</h3>
            {regionFilter && (
              <button
                onClick={() => setRegionFilter('')}
                className="text-xs text-gray-400 hover:text-white transition-colors underline"
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
                  className={`
                    flex items-center gap-2 px-3 py-2 rounded-lg transition-all
                    ${isActive 
                      ? 'bg-emerald-600 text-white shadow-md scale-105' 
                      : 'bg-dark-700 hover:bg-dark-600 border border-dark-500'}
                  `}
                >
                  <span className="text-lg">{info.emoji}</span>
                  <div className="text-left">
                    <div className={`text-sm font-medium ${isActive ? 'text-white' : 'text-gray-200'}`}>
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
        </Card>
      )}

      {/* Pipeline Overview */}
      <Card padding="sm" className="bg-gradient-to-r from-brand-500/10 to-purple-500/10 border-brand-500/30">
        <div className="flex items-center gap-2 text-sm flex-wrap">
          {[
            { step: '1', label: 'Filter' },
            { step: '2', label: 'Tag' },
            { step: '3', label: '🌏 Geo', highlight: 'emerald', badge: 'NEW' },
            { step: '4', label: 'Cluster' },
            { step: '5', label: 'Synthesize' },
            { step: '6', label: '💰 Market', highlight: 'brand' },
            { step: '7', label: '🔥 Trends', highlight: 'orange' },
          ].map((item, i) => (
            <div key={item.step} className="flex items-center gap-2">
              {i > 0 && <span className="text-dark-500">→</span>}
              <div className={`flex items-center gap-1 ${
                item.highlight === 'emerald' ? 'text-emerald-400' :
                item.highlight === 'brand' ? 'text-brand-400' :
                item.highlight === 'orange' ? 'text-orange-400' :
                'text-gray-400'
              }`}>
                <span className="font-semibold">{item.step}.</span>
                <span className={item.highlight ? 'font-medium' : ''}>{item.label}</span>
                {item.badge && (
                  <Badge variant="green" size="sm">{item.badge}</Badge>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* List Controls */}
      <Card padding="sm">
        <div className="flex flex-col gap-3 sm:gap-4">
          {/* Top row: Count + Show all toggle */}
          <div className="flex flex-wrap items-center justify-between gap-2 sm:gap-4">
            <div className="text-sm text-gray-400">
              <span className="font-semibold text-white">{filteredOpportunities.length}</span> 
              {showAll ? ' total clusters' : ' products with 5+ mentions'}
              {regionFilter && selectedRegionInfo && (
                <Badge variant="green" size="sm" className="ml-2">
                  {selectedRegionInfo.emoji} {selectedRegionInfo.name}
                </Badge>
              )}
            </div>
            
            <label className="flex items-center gap-2 cursor-pointer shrink-0">
              <input 
                type="checkbox"
                checked={showAll}
                onChange={(e) => setShowAll(e.target.checked)}
                className="rounded border-dark-500 bg-dark-700 text-brand-600 focus:ring-brand-500 w-4 h-4"
              />
              <span className="text-sm text-gray-400">Show all</span>
            </label>
          </div>
          
          {/* Bottom row: Filters */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4">
            {/* Region filter dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 hidden sm:inline">🌏</span>
              <select 
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value as RegionCode | '')}
                className="select text-sm py-1.5 min-w-0"
              >
                <option value="">🌏 All Regions</option>
                <option value="AU">🇦🇺 Australia</option>
                <option value="US">🇺🇸 United States</option>
                <option value="UK">🇬🇧 United Kingdom</option>
                <option value="EU">🇪🇺 Europe</option>
                <option value="GLOBAL">🌍 Global</option>
              </select>
            </div>
            
            {/* Sort dropdown */}
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 hidden sm:inline">Sort:</span>
              <select 
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'score' | 'mentions' | 'market')}
                className="select text-sm py-1.5 min-w-0"
              >
                <option value="mentions">📊 Mentions (↓)</option>
                <option value="market">💰 Market Size</option>
                <option value="score">⭐ Score</option>
              </select>
            </div>
          </div>
        </div>
      </Card>

      {/* Opportunities List */}
      {filteredOpportunities.length > 0 ? (
        <Card padding="none" className="overflow-hidden">
          {/* Table Header */}
          <div className="flex items-center gap-4 px-4 py-3 bg-dark-750 border-b border-dark-600 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <div className="w-8 sm:w-10 text-center">#</div>
            <div className="flex-1">Product / Topic</div>
            {regionFilter && <div className="w-16 text-center">Region %</div>}
            <div className="w-20 text-center hidden sm:block">Market</div>
            <div className="w-20 text-center">Mentions</div>
            <div className="w-16 text-center hidden sm:block">Score</div>
            <div className="hidden lg:block w-32">Personas</div>
            <div className="w-6"></div>
          </div>
          
          {/* Rows */}
          <div className="divide-y divide-dark-700">
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
        </Card>
      ) : (
        <EmptyState
          icon={regionFilter ? '🌏' : '🔄'}
          title={regionFilter 
            ? `No products with 5+ mentions in ${REGION_INFO[regionFilter]?.name || regionFilter}` 
            : 'No products with 5+ mentions yet'}
          description={regionFilter 
            ? 'Try a different region or check the Topics page'
            : 'Pipeline is processing... Check the Topics page to see what\'s being captured.'}
          action={regionFilter ? { 
            label: 'Clear region filter', 
            onClick: () => setRegionFilter('') 
          } : undefined}
          secondaryAction={{ 
            label: 'Show all clusters anyway', 
            onClick: () => setShowAll(true) 
          }}
        />
      )}

      {/* Cluster Distribution */}
      {stats && stats.clusters > 0 && (
        <Card padding="md">
          <h3 className="text-sm font-semibold text-gray-300 mb-3">Cluster Distribution</h3>
          <div className="flex items-center gap-4 text-sm flex-wrap">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-green-500"></div>
              <span className="text-gray-400">5+ mentions: <strong className="text-white">{stats.qualifying_clusters}</strong></span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-yellow-400"></div>
              <span className="text-gray-400">2-4 mentions: <strong className="text-white">{stats.clusters - stats.qualifying_clusters}</strong></span>
            </div>
            <div className="text-dark-500">|</div>
            <span className="text-gray-500">
              Average: <strong className="text-gray-300">{stats.avg_cluster_size || '?'}</strong> per cluster
            </span>
            {stats.geo_tagged && stats.geo_tagged > 0 && (
              <>
                <div className="text-dark-500">|</div>
                <span className="text-gray-500">
                  🌏 Geo-tagged: <strong className="text-gray-300">{stats.geo_tagged.toLocaleString()}</strong>
                </span>
              </>
            )}
          </div>
        </Card>
      )}

      {/* Footer note */}
      <div className="text-center text-xs text-gray-500">
        Data from Reddit + HackerNews • v24 uses embeddings for semantic similarity clustering + geographic analysis
      </div>
    </div>
  );
}
