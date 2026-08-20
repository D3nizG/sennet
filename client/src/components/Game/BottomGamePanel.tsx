import React, { useRef, useEffect } from 'react';
import type { MoveLogEntry, Move } from '@sennet/game-engine';
import { EgyptianPanel, EgyptianTabs, EgyptianButton } from '../EgyptianTheme';
import { BEAR_OFF_POSITION } from '@sennet/game-engine';
import './BottomGamePanel.css';

type PanelTab = 'log' | 'chat' | 'help';

// ── Move-log humanisation ────────────────────────────────────────────────────
// Engine positions are 0-based; the board (and these labels) are 1-based.
// Bearing off lands on BEAR_OFF_POSITION (30), shown as "home".

/** Describe a completed move in board (1-based) coordinates. */
function describeMove(move: Move): string {
  const from = move.from + 1;
  if (move.to === BEAR_OFF_POSITION) return `${from} → home`;
  return `${from} → ${move.to + 1}`;
}

/** Describe a turn with no move (blocked). */
function describeNoMove(event?: string): string {
  if (event === 'blocked') return 'no legal move — turn skipped';
  return 'no move';
}

/** Friendly tag for a notable move outcome, or null if unremarkable. */
function moveEventLabel(event?: string): string | null {
  switch (event) {
    case 'capture':         return 'Capture!';
    case 'bear_off':        return 'Borne off';
    case 'house_of_netting':return 'Trapped — turn ends';
    case 'waters_of_chaos': return 'Washed back to 14';
    default:
      return event?.startsWith('bonus_square_') ? 'Extra roll' : null;
  }
}

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
            {[...moveLog].reverse().slice(0, 30).map((entry, i) => {
              const tag = entry.move != null ? moveEventLabel(entry.event) : null;
              return (
                <div key={i} className="log-entry">
                  <span className="log-turn">T{entry.turnNumber}</span>
                  <span className={`log-player ${entry.player}`}>
                    {entry.player === yourPlayerId ? 'You' : 'Opp'}
                  </span>
                  <span className="log-roll">🎲{entry.rollValue}</span>
                  <span className="log-action">
                    {entry.move != null
                      ? describeMove(entry.move)
                      : describeNoMove(entry.event)}
                  </span>
                  {tag && <span className="log-event">{tag}</span>}
                </div>
              );
            })}
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
                <span className="sq-sample sq-sample--danger">14</span>
                <span className="help-text egypt-muted">House of Netting — trap! Turn ends immediately</span>
              </div>
              <div className="help-row">
                <span className="sq-sample sq-sample--bonus">15</span>
                <span className="help-text egypt-muted">House of Happiness — gain +1 extra roll</span>
              </div>
              <div className="help-row">
                <span className="sq-sample sq-sample--bonus">26</span>
                <span className="help-text egypt-muted">House of Rebirth — gain +1 extra roll</span>
              </div>
              <div className="help-row">
                <span className="sq-sample sq-sample--chaos">27</span>
                <span className="help-text egypt-muted">Waters of Chaos — piece washed back to square 14</span>
              </div>
              <div className="help-row">
                <span className="sq-sample sq-sample--safe">28–30</span>
                <span className="help-text egypt-muted">Safe squares — cannot be captured</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </EgyptianPanel>
  );
}
