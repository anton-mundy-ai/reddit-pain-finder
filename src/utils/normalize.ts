// v7: Topic normalization and fuzzy matching utilities
// Reduces topic fragmentation by normalizing synonyms and word forms

/**
 * Common synonyms to map to canonical forms
 */
const SYNONYM_MAP: Record<string, string> = {
  // People terms
  'client': 'customer',
  'clients': 'customer',
  'customers': 'customer',
  'user': 'customer',
  'users': 'customer',
  'buyer': 'customer',
  'buyers': 'customer',
  'consumer': 'customer',
  'consumers': 'customer',
  
  // Money terms
  'money': 'payment',
  'cash': 'payment',
  'payments': 'payment',
  'paying': 'payment',
  'pay': 'payment',
  'billing': 'payment',
  'invoicing': 'payment',
  'invoices': 'invoice',
  
  // Work terms
  'job': 'work',
  'jobs': 'work',
  'employment': 'work',
  'career': 'work',
  'working': 'work',
  'freelance': 'freelancing',
  'freelancer': 'freelancing',
  
  // Communication
  'communicate': 'communication',
  'communicating': 'communication',
  'messaging': 'communication',
  'message': 'communication',
  'email': 'communication',
  'emails': 'communication',
  
  // Time terms
  'scheduling': 'schedule',
  'appointment': 'schedule',
  'appointments': 'schedule',
  'booking': 'schedule',
  'bookings': 'schedule',
  'calendar': 'schedule',
  
  // Tech terms
  'app': 'application',
  'apps': 'application',
  'applications': 'application',
  'software': 'application',
  'tool': 'application',
  'tools': 'application',
  'platform': 'application',
  'platforms': 'application',
  
  // Business terms
  'company': 'business',
  'companies': 'business',
  'businesses': 'business',
  'enterprise': 'business',
  'startup': 'business',
  'startups': 'business',
  
  // Process terms
  'manage': 'management',
  'managing': 'management',
  'automate': 'automation',
  'automating': 'automation',
  'track': 'tracking',
  'tracking': 'tracking',
  
  // Document terms
  'document': 'documentation',
  'documents': 'documentation',
  'documenting': 'documentation',
  'doc': 'documentation',
  'docs': 'documentation',
  
  // Common variations
  'issue': 'problem',
  'issues': 'problem',
  'problems': 'problem',
  'difficult': 'difficulty',
  'difficulties': 'difficulty',
  'hard': 'difficulty',
  'challenge': 'difficulty',
  'challenges': 'difficulty',
  
  // Location
  'remote': 'remote work',
  'wfh': 'remote work',
  'work from home': 'remote work',
  
  // Team
  'team': 'collaboration',
  'teams': 'collaboration',
  'collaborate': 'collaboration',
  'collaborating': 'collaboration',
  'teamwork': 'collaboration',
};

/**
 * Simple word stemming - removes common suffixes
 */
function stemWord(word: string): string {
  // Remove common suffixes
  const suffixes = [
    'ization', 'isation', 'ation', 'ition',
    'ment', 'ness', 'ship', 'ling',
    'ing', 'ful', 'less', 'able', 'ible',
    'ive', 'ous', 'ious', 'eous',
    'er', 'or', 'ist', 'ism',
    'ly', 'al', 'ty', 'ity',
    's', 'es', 'ed'
  ];
  
  for (const suffix of suffixes) {
    if (word.length > suffix.length + 2 && word.endsWith(suffix)) {
      return word.slice(0, -suffix.length);
    }
  }
  
  return word;
}

/**
 * Normalize a topic string for consistent comparison
 */
export function normalizeTopic(topic: string): string {
  // Lowercase
  let normalized = topic.toLowerCase();
  
  // Replace underscores and hyphens with spaces
  normalized = normalized.replace(/[_-]/g, ' ');
  
  // Remove extra whitespace
  normalized = normalized.replace(/\s+/g, ' ').trim();
  
  // Split into words
  const words = normalized.split(' ');
  
  // Process each word
  const processedWords = words.map(word => {
    // Check synonym map first
    if (SYNONYM_MAP[word]) {
      return SYNONYM_MAP[word];
    }
    
    // Apply stemming
    const stemmed = stemWord(word);
    
    // Check synonym map for stemmed form
    if (SYNONYM_MAP[stemmed]) {
      return SYNONYM_MAP[stemmed];
    }
    
    return stemmed;
  });
  
  // Deduplicate consecutive identical words
  const deduped: string[] = [];
  for (const word of processedWords) {
    if (deduped[deduped.length - 1] !== word) {
      deduped.push(word);
    }
  }
  
  return deduped.join(' ');
}

/**
 * Check if two topics are semantically similar
 */
export function topicsMatch(topic1: string, topic2: string): boolean {
  const norm1 = normalizeTopic(topic1);
  const norm2 = normalizeTopic(topic2);
  
  // Exact match after normalization
  if (norm1 === norm2) return true;
  
  // One contains the other
  if (norm1.includes(norm2) || norm2.includes(norm1)) return true;
  
  // Check word overlap (Jaccard similarity)
  const words1 = new Set(norm1.split(' '));
  const words2 = new Set(norm2.split(' '));
  
  const intersection = new Set([...words1].filter(w => words2.has(w)));
  const union = new Set([...words1, ...words2]);
  
  const jaccard = intersection.size / union.size;
  
  // Consider match if >60% word overlap
  return jaccard > 0.6;
}

/**
 * Get canonical topic from a list of similar topics
 * Uses the shortest normalized form
 */
export function getCanonicalTopic(topics: string[]): string {
  if (topics.length === 0) return '';
  if (topics.length === 1) return normalizeTopic(topics[0]);
  
  const normalized = topics.map(t => ({
    original: t,
    normalized: normalizeTopic(t)
  }));
  
  // Sort by normalized length (shorter is more canonical)
  normalized.sort((a, b) => a.normalized.length - b.normalized.length);
  
  return normalized[0].normalized;
}

/**
 * Group topics by similarity
 */
export function groupSimilarTopics(topics: string[]): Map<string, string[]> {
  const groups = new Map<string, string[]>();
  const assigned = new Set<string>();
  
  for (const topic of topics) {
    if (assigned.has(topic)) continue;
    
    // Find all similar topics
    const similar = topics.filter(t => 
      !assigned.has(t) && topicsMatch(topic, t)
    );
    
    if (similar.length > 0) {
      const canonical = getCanonicalTopic(similar);
      groups.set(canonical, similar);
      
      for (const t of similar) {
        assigned.add(t);
      }
    }
  }
  
  return groups;
}

/**
 * Broad category extraction from topic
 */
export function extractBroadCategory(topic: string): string {
  const normalized = normalizeTopic(topic);
  
  // Common broad categories
  const categories: Record<string, string[]> = {
    'payment': ['payment', 'invoice', 'billing', 'price', 'cost', 'money', 'fee'],
    'customer': ['customer', 'client', 'support', 'service', 'feedback'],
    'time': ['time', 'schedule', 'deadline', 'late', 'slow', 'fast', 'delay'],
    'communication': ['communication', 'email', 'message', 'meeting', 'call'],
    'automation': ['automation', 'manual', 'repetitive', 'workflow'],
    'data': ['data', 'analytics', 'report', 'dashboard', 'metric'],
    'integration': ['integration', 'api', 'sync', 'connect', 'import', 'export'],
    'security': ['security', 'privacy', 'access', 'permission', 'auth'],
    'documentation': ['documentation', 'doc', 'knowledge', 'wiki', 'guide'],
    'collaboration': ['collaboration', 'team', 'share', 'collaborate'],
  };
  
  for (const [category, keywords] of Object.entries(categories)) {
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        return category;
      }
    }
  }
  
  return 'general';
}
