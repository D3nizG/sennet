import React, { useRef, useEffect } from 'react';
import type { MoveLogEntry } from '@sennet/game-engine';
import { EgyptianPanel, EgyptianTabs, EgyptianButton } from '../EgyptianTheme';
import { BEAR_OFF_POSITION } from '@sennet/game-engine';
import './BottomGamePanel.css';

type PanelTab = 'log' | 'chat' | 'help';

interface ChatMessage {
  senderId: string;
  senderName: string;
  message: string;
}

interface BottomGamePanelProps {
  activeTab: PanelTab;
  onTabChange: (tab: PanelTab) => void;
  moveLog: MoveLogEntry[];
  yourPlayerId: string;
  chatMessages: ChatMessage[];
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onSendChat: () => void;
  currentUserId: string;
  showResign: boolean;
  onResignRequest: () => void;
  chatHasUnread?: boolean;
}

const TABS = [
  { id: 'log',  label: 'Move Log' },
  { id: 'chat', label: 'Chat'     },
  { id: 'help', label: 'Help'     },
] as const;

export function BottomGamePanel({
  activeTab,
  onTabChange,
  moveLog,
  yourPlayerId,
  chatMessages,
  chatInput,
  onChatInputChange,
  onSendChat,
  currentUserId,
  showResign,
  onResignRequest,
  chatHasUnread,
}: BottomGamePanelProps) {
  const chatEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  return (
    <EgyptianPanel deep className="bottom-game-panel">
      <div className="bottom-panel-header">
        <EgyptianTabs
          tabs={TABS.map(t => ({
            id: t.id,
            label: t.id === 'log' ? `Move Log (${moveLog.length})` : t.label,
            dot: t.id === 'chat' ? chatHasUnread : false,
          }))}
          activeTab={activeTab}
          onTabChange={id => onTabChange(id as PanelTab)}
        />

        {showResign && (
          <EgyptianButton danger className="panel-resign-btn" onClick={onResignRequest}>
            Resign
          </EgyptianButton>
        )}
      </div>

      <div className="bottom-panel-body egypt-scrollbar">
        {activeTab === 'log' && (
          <div className="panel-move-log egypt-scrollbar" role="tabpanel">
            {[...moveLog].reverse().slice(0, 30).map((entry, i) => (
              <div key={i} className="log-entry">
                <span className="log-turn">T{entry.turnNumber}</span>
                <span className={`log-player ${entry.player}`}>
                  {entry.player === yourPlayerId ? 'You' : 'Opp'}
                </span>
                <span className="log-roll">🎲{entry.rollValue}</span>
                <span className="log-action">
                  {entry.move != null
                    ? `${entry.move.from}→${entry.move.to === BEAR_OFF_POSITION ? 'OFF' : entry.move.to}`
                    : entry.event ?? 'skip'}
                </span>
                {entry.event && <span className="log-event">{entry.event}</span>}
              </div>
            ))}
          </div>
        )}

        {activeTab === 'chat' && (
          <div className="panel-chat" role="tabpanel">
            <div className="chat-messages egypt-scrollbar">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`chat-msg ${msg.senderId === currentUserId ? 'chat-msg--mine' : 'chat-msg--theirs'}`}
                >
                  <span className="chat-msg__sender egypt-label">
                    {msg.senderId === currentUserId ? 'You' : msg.senderName}
                  </span>
                  <span className="chat-msg__text">{msg.message}</span>
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            <form
              className="chat-input-row"
              onSubmit={e => {
                e.preventDefault();
                onSendChat();
              }}
            >
              <input
                className="chat-input"
                value={chatInput}
                onChange={e => onChatInputChange(e.target.value)}
                placeholder="Message…"
                maxLength={500}
              />
              <EgyptianButton
                type="submit"
                className="chat-send"
                disabled={!chatInput.trim()}
              >
                Send
              </EgyptianButton>
            </form>
          </div>
        )}

        {activeTab === 'help' && (
          <div className="panel-help" role="tabpanel">
            <div className="help-grid">
              <div className="help-row">
                <span className="sq-sample sq-sample--plain">0</span>
                <span className="help-text egypt-muted">Rebirth — pieces return here from Waters of Chaos</span>
              </div>
              <div className="help-row">
                <span className="sq-sample sq-sample--danger">13</span>
                <span className="help-text egypt-muted">House of Netting — trap! Turn ends immediately</span>
              </div>
              <div className="help-row">
                <span className="sq-sample sq-sample--bonus">14</span>
                <span className="help-text egypt-muted">House of Happiness — gain +1 extra roll (𓋹)</span>
              </div>
              <div className="help-row">
                <span className="sq-sample sq-sample--bonus">25</span>
                <span className="help-text egypt-muted">House of Water — gain +1 extra roll (not safe)</span>
              </div>
              <div className="help-row">
                <span className="sq-sample sq-sample--danger">26</span>
                <span className="help-text egypt-muted">Waters of Chaos — piece washed back to sq 13</span>
              </div>
              <div className="help-row">
                <span className="sq-sample sq-sample--safe">27–29</span>
                <span className="help-text egypt-muted">Safe squares — cannot be captured</span>
              </div>
              <div className="help-row">
                <span className="help-tip egypt-muted">
                  Roll a 1 in the faceoff to go first. Roll 6 to get an extra turn.
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </EgyptianPanel>
  );
}
