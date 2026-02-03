// v17: Competitors page with professional design
import { useState, useEffect } from 'react';
import { API_BASE } from '../api';
import {
  Card, CardHeader, CardTitle,
  Badge, CategoryBadge,
  StatCard, StatGrid,
  Button, ButtonLink,
  EmptyState,
  SimpleTabs,
  SkeletonCard, SkeletonRow
} from '../components/ui';

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

// Sentiment Badge
function SentimentBadge({ sentiment }: { sentiment: string }) {
  const variants: Record<string, 'red' | 'orange' | 'gray'> = {
    negative: 'red',
    frustrated: 'orange',
    neutral: 'gray'
  };
  return (
    <Badge variant={variants[sentiment] || 'gray'} size="sm">
      {sentiment}
    </Badge>
  );
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

  const totalComplaints = competitors.reduce((sum, c) => sum + c.complaint_count, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            🎯 Competitor Gaps
          </h1>
          <p className="text-gray-400 mt-1">
            People complaining about products = validated pain + proven willingness to pay
          </p>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span>{competitors.length} products tracked</span>
          <span>{totalComplaints} complaints mined</span>
        </div>
      </div>

      {/* Tab Navigation */}
      <SimpleTabs
        tabs={[
          { id: 'products', label: `Products (${competitors.length})`, icon: '📦' },
          { id: 'gaps', label: `Feature Gaps (${featureGaps.length})`, icon: '💡' },
          { id: 'categories', label: `Categories (${categories.length})`, icon: '📊' },
        ]}
        value={activeTab}
        onChange={(v) => setActiveTab(v as typeof activeTab)}
      />

      {/* Loading State */}
      {loading && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="space-y-2">
            {[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}
          </div>
          <div className="lg:col-span-2">
            <SkeletonCard />
          </div>
        </div>
      )}

      {/* Products Tab */}
      {!loading && activeTab === 'products' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Product List */}
          <div className="space-y-2">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Products by Complaints</h3>
            {competitors.length === 0 ? (
              <EmptyState
                icon="📦"
                title="No complaints yet"
                description="Trigger mining to start collecting competitor complaints."
              />
            ) : (
              competitors.map(comp => (
                <Card
                  key={comp.product_name}
                  hover
                  padding="sm"
                  className={selectedProduct === comp.product_name ? 'border-brand-500/50 bg-brand-500/5' : ''}
                  onClick={() => setSelectedProduct(comp.product_name)}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-white">{comp.product_name}</div>
                      <CategoryBadge category={comp.category} size="sm" />
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-white">{comp.complaint_count}</div>
                      <div className="text-2xs text-gray-500">complaints</div>
                    </div>
                  </div>
                  <div className="flex gap-3 mt-2 text-xs">
                    {comp.negative_count > 0 && (
                      <span className="text-red-400">🔴 {comp.negative_count} negative</span>
                    )}
                    {comp.feature_gap_count > 0 && (
                      <span className="text-yellow-400">💡 {comp.feature_gap_count} gaps</span>
                    )}
                  </div>
                </Card>
              ))
            )}
          </div>

          {/* Complaint Detail */}
          <div className="lg:col-span-2">
            {selectedProduct ? (
              <Card padding="lg">
                <CardHeader
                  action={
                    productStats && (
                      <div className="flex gap-4 text-sm">
                        <span className="text-gray-400">
                          Total: <span className="text-white font-medium">{productStats.total}</span>
                        </span>
                        <span className="text-red-400">
                          Negative: {productStats.negative}
                        </span>
                        <span className="text-yellow-400">
                          With gaps: {productStats.with_feature_gap}
                        </span>
                      </div>
                    )
                  }
                >
                  <CardTitle>{selectedProduct} Complaints</CardTitle>
                </CardHeader>
                
                <div className="space-y-4 max-h-[600px] overflow-y-auto">
                  {productComplaints.length === 0 ? (
                    <EmptyState
                      icon="💬"
                      title="No complaints"
                      description="No complaints found for this product yet."
                    />
                  ) : (
                    productComplaints.map(complaint => (
                      <Card key={complaint.id} variant="bordered" padding="md">
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1">
                            <p className="text-gray-300 text-sm leading-relaxed">
                              {complaint.complaint_text.slice(0, 500)}
                              {complaint.complaint_text.length > 500 && '...'}
                            </p>
                            {complaint.feature_gap && (
                              <div className="mt-3 p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                                <span className="text-yellow-400 text-xs font-semibold">💡 Feature Gap: </span>
                                <span className="text-yellow-200 text-sm">{complaint.feature_gap}</span>
                              </div>
                            )}
                          </div>
                          <SentimentBadge sentiment={complaint.sentiment || 'neutral'} />
                        </div>
                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-dark-600 text-xs text-gray-500">
                          <div className="flex items-center gap-3">
                            <span>by u/{complaint.author}</span>
                            <span>⬆️ {complaint.score}</span>
                            <Badge variant="gray" size="sm">
                              {complaint.source_type.replace('_', ' ')}
                            </Badge>
                          </div>
                          <a 
                            href={complaint.source_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-brand-400 hover:text-brand-300 transition-colors"
                          >
                            View source →
                          </a>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              </Card>
            ) : (
              <div className="flex items-center justify-center h-64 card">
                <div className="text-center text-gray-500">
                  <span className="text-4xl mb-4 block">👈</span>
                  <p>Select a product to see complaints</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Feature Gaps Tab */}
      {!loading && activeTab === 'gaps' && (
        <div className="space-y-4">
          <h3 className="text-sm font-medium text-gray-400">Top Feature Gaps Mentioned</h3>
          {featureGaps.length === 0 ? (
            <EmptyState
              icon="💡"
              title="No feature gaps yet"
              description="Feature gaps will be extracted from competitor complaints."
            />
          ) : (
            <div className="grid gap-3">
              {featureGaps.map((gap, idx) => (
                <Card key={idx} padding="md">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-white font-medium">{gap.product_name}</span>
                        <CategoryBadge category={gap.category} size="sm" />
                      </div>
                      <div className="p-3 bg-yellow-500/10 rounded-lg border border-yellow-500/30">
                        <span className="text-yellow-400 text-sm">💡 {gap.feature_gap}</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-brand-400">{gap.mention_count}×</div>
                      <div className="text-2xs text-gray-500">mentioned</div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Categories Tab */}
      {!loading && activeTab === 'categories' && (
        categories.length === 0 ? (
          <EmptyState
            icon="📊"
            title="No category data"
            description="Category statistics will appear once complaints are mined."
          />
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {categories.map(cat => (
              <Card key={cat.category} padding="md">
                <div className="flex items-center justify-between mb-4">
                  <CategoryBadge category={cat.category} size="lg" />
                  <span className="text-xs text-gray-500">{cat.products_tracked} products</span>
                </div>
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Total Complaints</span>
                    <span className="text-white font-semibold">{cat.total_complaints}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-400 text-sm">Feature Gaps</span>
                    <span className="text-yellow-400 font-semibold">{cat.feature_gaps}</span>
                  </div>
                  <div className="h-2 bg-dark-600 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-gradient-to-r from-brand-600 to-brand-400 rounded-full"
                      style={{ width: `${Math.min((cat.feature_gaps / cat.total_complaints) * 100, 100)}%` }}
                    />
                  </div>
                  <div className="text-2xs text-gray-500 text-right">
                    {cat.total_complaints > 0 
                      ? `${((cat.feature_gaps / cat.total_complaints) * 100).toFixed(0)}% have feature gaps`
                      : 'No complaints yet'}
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )
      )}
    </div>
  );
}
