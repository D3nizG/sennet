import './EgyptianTabs.css';
import { withClickSound } from '../../audio/clickSound';

interface Tab {
  id: string;
  label: string;
  /** Show a small red alert dot on the tab (e.g. unread messages). */
  dot?: boolean;
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
          onClick={withClickSound('ui-secondary', () => onTabChange(tab.id))}
        >
          {tab.label}
          {tab.dot && <span className="egypt-tab__dot" aria-label="unread" />}
        </button>
      ))}
    </div>
  );
}
