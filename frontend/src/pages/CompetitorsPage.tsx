import { useState, useEffect } from 'react';
import { API_BASE } from '../api';

interface Competitor {
  product_name: string;
  category: string;
  complaint_count: number;
  negative_count: number;
  frustrated_count: number;
  feature_gap_count: number;
  avg_score: number;
}

interface CategoryStats {
  category: string;
  products_tracked: number;
  total_complaints: number;
  feature_gaps: number;
}

interface FeatureGap {
  product_name: string;
  category: string;
  feature_gap: string;
  mention_count: number;
  authors: string;
}

interface Complaint {
  id: number;
  product_name: string;
  complaint_text: string;
  source_type: string;
  source_url: string;
  author: string;
  score: number;
  sentiment: string;
  feature_gap: string | null;
  created_at: number;
}

export default function CompetitorsPage() {
  const [competitors, setCompetitors] = useState<Competitor[]>([]);
  const [categories, setCategories] = useState<CategoryStats[]>([]);
  const [featureGaps, setFeatureGaps] = useState<FeatureGap[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [productComplaints, setProductComplaints] = useState<Complaint[]>([]);
  const [productStats, setProductStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'products' | 'gaps' | 'categories'>('products');

  // Fetch competitor data
  useEffect(() => {
    async function fetchData() {
      try {
        const [compRes, gapsRes] = await Promise.all([
          fetch(`${API_BASE}/api/competitors`),
          fetch(`${API_BASE}/api/feature-gaps?limit=100`)
        ]);
        
        if (compRes.ok) {
          const data = await compRes.json();
          setCompetitors(data.competitors || []);
          setCategories(data.categories || []);
        }
        
        if (gapsRes.ok) {
          const data = await gapsRes.json();
          setFeatureGaps(data.feature_gaps || []);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  // Fetch complaints for selected product
  useEffect(() => {
    if (!selectedProduct) {
      setProductComplaints([]);
      setProductStats(null);
      return;
    }
    
    async function fetchProductData() {
      if (!selectedProduct) return;
      try {
        const res = await fetch(`${API_BASE}/api/competitors/${encodeURIComponent(selectedProduct)}`);
        if (res.ok) {
          const data = await res.json();
          setProductComplaints(data.complaints || []);
          setProductStats(data.stats);
        }
      } catch (error) {
        console.error('Error fetching product data:', error);
      }
    }
    fetchProductData();
  }, [selectedProduct]);

  // Sentiment badge
  const SentimentBadge = ({ sentiment }: { sentiment: string }) => {
    const colors = {
      negative: 'bg-red-500/20 text-red-400 border-red-500/30',
      frustrated: 'bg-orange-500/20 text-orange-400 border-orange-500/30',
      neutral: 'bg-gray-500/20 text-gray-400 border-gray-500/30'
    };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs border ${colors[sentiment as keyof typeof colors] || colors.neutral}`}>
        {sentiment}
      </span>
    );
  };

  // Category badge
  const CategoryBadge = ({ category }: { category: string }) => {
    const colors: Record<string, string> = {
      productivity: 'bg-blue-500/20 text-blue-400',
      finance: 'bg-green-500/20 text-green-400',
      crm: 'bg-purple-500/20 text-purple-400',
      email: 'bg-yellow-500/20 text-yellow-400',
      dev: 'bg-pink-500/20 text-pink-400',
      design: 'bg-cyan-500/20 text-cyan-400',
      scheduling: 'bg-orange-500/20 text-orange-400',
      forms: 'bg-indigo-500/20 text-indigo-400',
      analytics: 'bg-red-500/20 text-red-400'
    };
    return (
      <span className={`px-2 py-0.5 rounded text-xs ${colors[category] || 'bg-gray-500/20 text-gray-400'}`}>
        {category}
      </span>
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-gray-400">Loading competitor data...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <span>🎯</span> Competitor Gaps
          </h1>
          <p className="text-gray-400 mt-1">
            People complaining about products = validated pain + proven willingness to pay
          </p>
        </div>
        <div className="text-right text-sm text-gray-500">
          <div>{competitors.length} products tracked</div>
          <div>{competitors.reduce((sum, c) => sum + c.complaint_count, 0)} complaints mined</div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-dark-600 pb-2">
        {(['products', 'gaps', 'categories'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 rounded-t-lg transition-colors ${
              activeTab === tab 
                ? 'bg-accent-500/20 text-accent-400 border-b-2 border-accent-500' 
                : 'text-gray-400 hover:text-white hover:bg-dark-700'
            }`}
          >
            {tab === 'products' && '📦 Products'}
            {tab === 'gaps' && '💡 Feature Gaps'}
            {tab === 'categories' && '📊 Categories'}
          </button>
        ))}
      </div>

      {/* Products Tab */}
      {activeTab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product List */}
          <div className="lg:col-span-1 space-y-2">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Products by Complaints</h3>
            {competitors.length === 0 ? (
              <div className="text-gray-500 text-center py-8">
                No complaints mined yet. Trigger mining to start!
              </div>
            ) : (
              competitors.map(comp => (
                <div
                  key={comp.product_name}
                  onClick={() => setSelectedProduct(comp.product_name)}
                  className={`p-3 rounded-lg border cursor-pointer transition-all ${
                    selectedProduct === comp.product_name
                      ? 'bg-accent-500/10 border-accent-500/50'
                      : 'bg-dark-800 border-dark-600 hover:border-dark-500'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">{comp.product_name}</div>
                      <CategoryBadge category={comp.category} />
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-white">{comp.complaint_count}</div>
                      <div className="text-xs text-gray-500">complaints</div>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-2 text-xs">
                    {comp.negative_count > 0 && (
                      <span className="text-red-400">🔴 {comp.negative_count} negative</span>
                    )}
                    {comp.feature_gap_count > 0 && (
                      <span className="text-yellow-400">💡 {comp.feature_gap_count} gaps</span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Complaint Detail */}
          <div className="lg:col-span-2">
            {selectedProduct ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-medium text-white">{selectedProduct} Complaints</h3>
                  {productStats && (
                    <div className="flex gap-4 text-sm">
                      <span className="text-gray-400">
                        Total: <span className="text-white">{productStats.total}</span>
                      </span>
                      <span className="text-red-400">
                        Negative: {productStats.negative}
                      </span>
                      <span className="text-yellow-400">
                        With gaps: {productStats.with_feature_gap}
                      </span>
                    </div>
                  )}
                </div>
                
                <div className="space-y-3 max-h-[600px] overflow-y-auto">
                  {productComplaints.map(complaint => (
                    <div key={complaint.id} className="bg-dark-800 rounded-lg p-4 border border-dark-600">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <p className="text-gray-200 text-sm leading-relaxed">
                            {complaint.complaint_text.slice(0, 500)}
                            {complaint.complaint_text.length > 500 && '...'}
                          </p>
                          {complaint.feature_gap && (
                            <div className="mt-2 p-2 bg-yellow-500/10 rounded border border-yellow-500/30">
                              <span className="text-yellow-400 text-xs font-medium">💡 Feature Gap: </span>
                              <span className="text-yellow-200 text-sm">{complaint.feature_gap}</span>
                            </div>
                          )}
                        </div>
                        <SentimentBadge sentiment={complaint.sentiment || 'neutral'} />
                      </div>
                      <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
                        <div className="flex items-center gap-3">
                          <span>by u/{complaint.author}</span>
                          <span>⬆️ {complaint.score}</span>
                          <span className="capitalize">{complaint.source_type.replace('_', ' ')}</span>
                        </div>
                        <a 
                          href={complaint.source_url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-accent-400 hover:underline"
                        >
                          View source →
                        </a>
                      </div>
                    </div>
                  ))}
                  {productComplaints.length === 0 && (
                    <div className="text-gray-500 text-center py-8">
                      No complaints found for this product yet.
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-64 text-gray-500">
                ← Select a product to see complaints
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feature Gaps Tab */}
      {activeTab === 'gaps' && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-400">Top Feature Gaps Mentioned</h3>
          {featureGaps.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              No feature gaps extracted yet. Mine more complaints!
            </div>
          ) : (
            <div className="grid gap-3">
              {featureGaps.map((gap, idx) => (
                <div key={idx} className="bg-dark-800 rounded-lg p-4 border border-dark-600">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-white font-medium">{gap.product_name}</span>
                        <CategoryBadge category={gap.category} />
                      </div>
                      <p className="text-yellow-200 text-sm bg-yellow-500/10 p-2 rounded border border-yellow-500/30">
                        💡 {gap.feature_gap}
                      </p>
                    </div>
                    <div className="text-right">
                      <div className="text-lg font-bold text-accent-400">{gap.mention_count}x</div>
                      <div className="text-xs text-gray-500">mentioned</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {categories.map(cat => (
            <div key={cat.category} className="bg-dark-800 rounded-lg p-4 border border-dark-600">
              <div className="flex items-center justify-between mb-3">
                <CategoryBadge category={cat.category} />
                <span className="text-xs text-gray-500">{cat.products_tracked} products</span>
              </div>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Total Complaints</span>
                  <span className="text-white font-medium">{cat.total_complaints}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400 text-sm">Feature Gaps</span>
                  <span className="text-yellow-400 font-medium">{cat.feature_gaps}</span>
                </div>
              </div>
            </div>
          ))}
          {categories.length === 0 && (
            <div className="col-span-full text-gray-500 text-center py-8">
              No category data yet. Start mining competitors!
            </div>
          )}
        </div>
      )}
    </div>
  );
}
