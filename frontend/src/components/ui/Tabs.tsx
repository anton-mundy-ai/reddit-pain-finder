// Tabs component
import { ReactNode, createContext, useContext, useState } from 'react';

interface TabsContextValue {
  activeTab: string;
  setActiveTab: (id: string) => void;
}

const TabsContext = createContext<TabsContextValue | null>(null);

interface TabsProps {
  defaultValue: string;
  value?: string;
  onChange?: (value: string) => void;
  children: ReactNode;
  className?: string;
}

export function Tabs({ 
  defaultValue, 
  value, 
  onChange, 
  children, 
  className = '' 
}: TabsProps) {
  const [internalValue, setInternalValue] = useState(defaultValue);
  const activeTab = value ?? internalValue;
  
  const setActiveTab = (id: string) => {
    if (onChange) {
      onChange(id);
    } else {
      setInternalValue(id);
    }
  };

  return (
    <TabsContext.Provider value={{ activeTab, setActiveTab }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

interface TabsListProps {
  children: ReactNode;
  className?: string;
}

export function TabsList({ children, className = '' }: TabsListProps) {
  return (
    <div className={`tab-group ${className}`}>
      {children}
    </div>
  );
}

interface TabProps {
  value: string;
  children: ReactNode;
  icon?: ReactNode;
  className?: string;
}

export function Tab({ value, children, icon, className = '' }: TabProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('Tab must be used within Tabs');
  
  const isActive = context.activeTab === value;
  
  return (
    <button
      onClick={() => context.setActiveTab(value)}
      className={`
        tab
        ${isActive ? 'tab-active' : ''}
        ${className}
      `}
    >
      {icon && <span className="mr-1.5">{icon}</span>}
      {children}
    </button>
  );
}

interface TabsContentProps {
  value: string;
  children: ReactNode;
  className?: string;
}

export function TabsContent({ value, children, className = '' }: TabsContentProps) {
  const context = useContext(TabsContext);
  if (!context) throw new Error('TabsContent must be used within Tabs');
  
  if (context.activeTab !== value) return null;
  
  return (
    <div 
      className={`${className}`}
      style={{ animation: 'fadeIn 0.3s ease-out' }}
    >
      {children}
    </div>
  );
}

// Simple button-style tabs for inline use
interface SimpleTabsProps {
  tabs: Array<{ id: string; label: string; icon?: string }>;
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

export function SimpleTabs({ tabs, value, onChange, className = '' }: SimpleTabsProps) {
  return (
    <div className={`tab-group ${className}`}>
      {tabs.map(tab => (
        <button
          key={tab.id}
          onClick={() => onChange(tab.id)}
          className={`tab ${value === tab.id ? 'tab-active' : ''}`}
        >
          {tab.icon && <span className="mr-1.5">{tab.icon}</span>}
          {tab.label}
        </button>
      ))}
    </div>
  );
}

export default Tabs;
