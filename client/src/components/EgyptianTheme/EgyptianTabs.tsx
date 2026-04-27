import './EgyptianTabs.css';

interface Tab {
  id: string;
  label: string;
}

interface EgyptianTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (id: string) => void;
  className?: string;
}

export function EgyptianTabs({ tabs, activeTab, onTabChange, className }: EgyptianTabsProps) {
  return (
    <div className={`egypt-tabs ${className ?? ''}`} role="tablist">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          role="tab"
          aria-selected={activeTab === tab.id}
          className={`egypt-tab ${activeTab === tab.id ? 'egypt-tab--active' : ''}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
