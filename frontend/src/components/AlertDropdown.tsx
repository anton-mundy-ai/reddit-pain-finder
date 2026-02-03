import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Alert, AlertType, AlertSeverity } from '../types';
import { fetchAlerts, fetchUnreadCount, markAlertRead, markAllAlertsRead } from '../api';

const ALERT_TYPE_ICONS: Record<AlertType, string> = {
  new_cluster: '💡',
  trend_spike: '🔥',
  competitor_gap: '🎯',
  high_severity: '⚠️'
};

const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  new_cluster: 'New Opportunity',
  trend_spike: 'Trend Spike',
  competitor_gap: 'Feature Gap',
  high_severity: 'High Severity'
};

const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  info: 'bg-blue-500/20 text-blue-400 border-blue-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  critical: 'bg-red-500/20 text-red-400 border-red-500/30'
};

const SEVERITY_DOT_COLORS: Record<AlertSeverity, string> = {
  info: 'bg-blue-400',
  warning: 'bg-yellow-400',
  critical: 'bg-red-400'
};

function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  
  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

export default function AlertDropdown() {
  const [isOpen, setIsOpen] = useState(false);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  
  // Fetch unread count on mount and periodically
  useEffect(() => {
    const fetchCount = async () => {
      try {
        const { unread } = await fetchUnreadCount();
        setUnreadCount(unread);
      } catch (error) {
        console.error('Failed to fetch unread count:', error);
      }
    };
    
    fetchCount();
    const interval = setInterval(fetchCount, 60000); // Poll every minute
    
    return () => clearInterval(interval);
  }, []);
  
  // Fetch alerts when dropdown opens
  useEffect(() => {
    if (isOpen) {
      const loadAlerts = async () => {
        setLoading(true);
        try {
          const { alerts: data } = await fetchAlerts({ limit: 20 });
          setAlerts(data);
        } catch (error) {
          console.error('Failed to fetch alerts:', error);
        } finally {
          setLoading(false);
        }
      };
      loadAlerts();
    }
  }, [isOpen]);
  
  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);
  
  const handleMarkRead = async (alertId: number) => {
    try {
      await markAlertRead(alertId);
      setAlerts(alerts.map(a => 
        a.id === alertId ? { ...a, read_at: Date.now() } : a
      ));
      setUnreadCount(Math.max(0, unreadCount - 1));
    } catch (error) {
      console.error('Failed to mark alert read:', error);
    }
  };
  
  const handleMarkAllRead = async () => {
    try {
      const { marked } = await markAllAlertsRead();
      setAlerts(alerts.map(a => ({ ...a, read_at: a.read_at || Date.now() })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Failed to mark all read:', error);
    }
  };
  
  const getAlertLink = (alert: Alert): string | null => {
    if (alert.opportunity_id) {
      return `/opportunity/${alert.opportunity_id}`;
    }
    if (alert.alert_type === 'trend_spike' && alert.topic_canonical) {
      return `/trends`;
    }
    if (alert.alert_type === 'competitor_gap') {
      return `/competitors`;
    }
    return null;
  };
  
  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-gray-400 hover:text-white hover:bg-dark-700 transition-colors"
        aria-label="Alerts"
      >
        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} 
            d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" 
          />
        </svg>
        
        {/* Unread Badge */}
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 flex items-center justify-center min-w-[20px] h-5 px-1.5 text-xs font-bold text-white bg-red-500 rounded-full">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>
      
      {/* Dropdown */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-96 bg-dark-800 border border-dark-600 rounded-xl shadow-2xl overflow-hidden z-50">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-dark-600 bg-dark-750">
            <div className="flex items-center gap-2">
              <span className="text-lg">🔔</span>
              <h3 className="font-semibold text-white">Alerts</h3>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 text-xs font-medium bg-red-500/20 text-red-400 rounded-full">
                  {unreadCount} new
                </span>
              )}
            </div>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs text-accent-400 hover:text-accent-300 transition-colors"
              >
                Mark all read
              </button>
            )}
          </div>
          
          {/* Alert List */}
          <div className="max-h-[400px] overflow-y-auto">
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-accent-400"></div>
              </div>
            ) : alerts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-gray-500">
                <span className="text-3xl mb-2">🔕</span>
                <p>No alerts yet</p>
              </div>
            ) : (
              <div className="divide-y divide-dark-600">
                {alerts.map(alert => {
                  const link = getAlertLink(alert);
                  const isUnread = !alert.read_at;
                  
                  const content = (
                    <div 
                      className={`px-4 py-3 hover:bg-dark-700 transition-colors cursor-pointer ${
                        isUnread ? 'bg-dark-750' : ''
                      }`}
                      onClick={() => {
                        if (isUnread) handleMarkRead(alert.id);
                        if (!link) setIsOpen(false);
                      }}
                    >
                      <div className="flex items-start gap-3">
                        {/* Icon & Unread Dot */}
                        <div className="relative flex-shrink-0">
                          <span className="text-xl">{ALERT_TYPE_ICONS[alert.alert_type]}</span>
                          {isUnread && (
                            <span className={`absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full ${SEVERITY_DOT_COLORS[alert.severity]}`}></span>
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className={`text-sm font-medium ${isUnread ? 'text-white' : 'text-gray-300'}`}>
                              {alert.title}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 line-clamp-2 mb-1">
                            {alert.description}
                          </p>
                          <div className="flex items-center gap-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded border ${SEVERITY_COLORS[alert.severity]}`}>
                              {alert.severity}
                            </span>
                            <span className="text-[10px] text-gray-500">
                              {timeAgo(alert.created_at)}
                            </span>
                          </div>
                        </div>
                        
                        {/* Arrow if linkable */}
                        {link && (
                          <span className="text-gray-500 flex-shrink-0">→</span>
                        )}
                      </div>
                    </div>
                  );
                  
                  if (link) {
                    return (
                      <Link 
                        key={alert.id} 
                        to={link} 
                        onClick={() => {
                          if (isUnread) handleMarkRead(alert.id);
                          setIsOpen(false);
                        }}
                      >
                        {content}
                      </Link>
                    );
                  }
                  
                  return <div key={alert.id}>{content}</div>;
                })}
              </div>
            )}
          </div>
          
          {/* Footer */}
          {alerts.length > 0 && (
            <div className="px-4 py-2 border-t border-dark-600 bg-dark-750">
              <p className="text-xs text-center text-gray-500">
                Showing {alerts.length} most recent alerts
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
