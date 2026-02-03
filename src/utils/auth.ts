// Cloudflare Access Authentication Utilities
// v18: JWT verification and user management
// ==========================================

/**
 * User type from database
 */
export interface User {
  id: number;
  email: string;
  first_seen: number;
  last_seen: number;
  plan: 'free' | 'pro';
  preferences: Record<string, any>;
  created_at: number;
}

/**
 * Auth context passed to handlers
 */
export interface AuthContext {
  isAuthenticated: boolean;
  user: User | null;
  email: string | null;
}

/**
 * Cloudflare Access JWT payload structure
 */
interface CFAccessJWTPayload {
  aud: string[];        // Application audience tag
  email: string;        // User's email
  exp: number;          // Expiration timestamp
  iat: number;          // Issued at timestamp
  iss: string;          // Issuer (your team domain)
  sub: string;          // Subject (user ID)
  type: string;         // "app"
  country?: string;     // User's country (optional)
}

/**
 * Public routes that don't require authentication
 * NOTE: Cloudflare Access handles the actual protection - this is just for API behavior
 */
const PUBLIC_ROUTES = [
  '/',
  '/health',
  '/api/stats',  // Limited public stats
];

/**
 * Check if a route is public (doesn't require auth)
 */
export function isPublicRoute(path: string): boolean {
  // Exact matches
  if (PUBLIC_ROUTES.includes(path)) return true;
  
  // All routes are protected by default (CF Access)
  return false;
}

/**
 * Parse and verify Cloudflare Access JWT
 * 
 * The CF-Access-JWT-Assertion header contains a signed JWT that's been
 * verified by Cloudflare Access. We can trust it without re-verification
 * since it only reaches us after passing Access.
 * 
 * For extra security in production, you CAN verify the JWT signature using
 * the team's public key from https://<team>.cloudflareaccess.com/cdn-cgi/access/certs
 */
export async function parseAccessJWT(request: Request): Promise<{ email: string; payload: CFAccessJWTPayload } | null> {
  const jwtHeader = request.headers.get('CF-Access-JWT-Assertion');
  
  if (!jwtHeader) {
    return null;
  }
  
  try {
    // Parse the JWT (without verification - CF Access already verified it)
    const parts = jwtHeader.split('.');
    if (parts.length !== 3) {
      console.error('Invalid JWT format');
      return null;
    }
    
    // Decode the payload (base64url)
    const payloadBase64 = parts[1]
      .replace(/-/g, '+')
      .replace(/_/g, '/');
    
    const payloadJson = atob(payloadBase64);
    const payload = JSON.parse(payloadJson) as CFAccessJWTPayload;
    
    // Basic validation
    if (!payload.email || !payload.exp) {
      console.error('JWT missing required fields');
      return null;
    }
    
    // Check expiration
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp < now) {
      console.error('JWT expired');
      return null;
    }
    
    return {
      email: payload.email,
      payload
    };
  } catch (error) {
    console.error('Failed to parse Access JWT:', error);
    return null;
  }
}

/**
 * Get or create user from email
 */
export async function getOrCreateUser(db: D1Database, email: string): Promise<User> {
  const now = Date.now();
  
  // Try to get existing user
  const existing = await db.prepare(
    'SELECT * FROM users WHERE email = ?'
  ).bind(email).first<User>();
  
  if (existing) {
    // Update last_seen
    await db.prepare(
      'UPDATE users SET last_seen = ? WHERE id = ?'
    ).bind(now, existing.id).run();
    
    return {
      ...existing,
      last_seen: now,
      preferences: safeParseJSON(existing.preferences as any, {})
    };
  }
  
  // Create new user
  const result = await db.prepare(`
    INSERT INTO users (email, first_seen, last_seen, plan, preferences, created_at)
    VALUES (?, ?, ?, 'free', '{}', ?)
  `).bind(email, now, now, now).run();
  
  return {
    id: result.meta.last_row_id as number,
    email,
    first_seen: now,
    last_seen: now,
    plan: 'free',
    preferences: {},
    created_at: now
  };
}

/**
 * Extract auth context from request
 */
export async function getAuthContext(request: Request, db: D1Database): Promise<AuthContext> {
  const jwtData = await parseAccessJWT(request);
  
  if (!jwtData) {
    return {
      isAuthenticated: false,
      user: null,
      email: null
    };
  }
  
  try {
    const user = await getOrCreateUser(db, jwtData.email);
    
    return {
      isAuthenticated: true,
      user,
      email: jwtData.email
    };
  } catch (error) {
    console.error('Failed to get/create user:', error);
    return {
      isAuthenticated: true,  // They passed CF Access
      user: null,
      email: jwtData.email
    };
  }
}

/**
 * Log user activity (optional analytics)
 */
export async function logActivity(
  db: D1Database, 
  userId: number, 
  action: string, 
  resourceId?: number,
  metadata?: Record<string, any>
): Promise<void> {
  try {
    await db.prepare(`
      INSERT INTO user_activity (user_id, action, resource_id, metadata, created_at)
      VALUES (?, ?, ?, ?, ?)
    `).bind(
      userId,
      action,
      resourceId || null,
      metadata ? JSON.stringify(metadata) : null,
      Date.now()
    ).run();
  } catch (error) {
    // Don't fail the request if logging fails
    console.error('Failed to log activity:', error);
  }
}

/**
 * Safe JSON parse helper
 */
function safeParseJSON(str: string | null, defaultValue: any): any {
  if (!str) return defaultValue;
  try { return JSON.parse(str); } catch { return defaultValue; }
}

/**
 * Get user stats for admin endpoint
 */
export async function getUserStats(db: D1Database): Promise<{
  total_users: number;
  active_today: number;
  active_week: number;
  by_plan: Record<string, number>;
}> {
  const now = Date.now();
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const weekAgo = now - 7 * 24 * 60 * 60 * 1000;
  
  const [total, activeToday, activeWeek, byPlan] = await Promise.all([
    db.prepare('SELECT COUNT(*) as count FROM users').first<{ count: number }>(),
    db.prepare('SELECT COUNT(*) as count FROM users WHERE last_seen > ?').bind(dayAgo).first<{ count: number }>(),
    db.prepare('SELECT COUNT(*) as count FROM users WHERE last_seen > ?').bind(weekAgo).first<{ count: number }>(),
    db.prepare('SELECT plan, COUNT(*) as count FROM users GROUP BY plan').all()
  ]);
  
  const planCounts: Record<string, number> = {};
  for (const row of byPlan.results || []) {
    const r = row as any;
    planCounts[r.plan] = r.count;
  }
  
  return {
    total_users: total?.count || 0,
    active_today: activeToday?.count || 0,
    active_week: activeWeek?.count || 0,
    by_plan: planCounts
  };
}
