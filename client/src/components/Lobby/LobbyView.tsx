import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { useGame } from '../../hooks/useGame';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type { LobbyUpdatePayload, LobbyInvitePayload, AIDifficulty } from '@sennet/game-engine';
import './LobbyView.css';

export function LobbyView() {
  const navigate = useNavigate();
  const { socket, connected } = useSocket();
  const { inGame } = useGame();
  const { user } = useAuth();
  const hasNavigated = useRef(false);

  const [queuing, setQueuing] = useState(false);
  const [lobby, setLobby] = useState<LobbyUpdatePayload | null>(null);
  const [joinCode, setJoinCode] = useState('');
  const [friends, setFriends] = useState<any[]>([]);
  const [pendingRequests, setPendingRequests] = useState<any[]>([]);
  const [friendUsername, setFriendUsername] = useState('');
  const [aiDifficulty, setAiDifficulty] = useState<AIDifficulty>('medium');
  const [error, setError] = useState('');
  const [invite, setInvite] = useState<LobbyInvitePayload | null>(null);

  // Navigate to /game when GameProvider sets inGame (via QUEUE_MATCHED)
  useEffect(() => {
    if (inGame && !hasNavigated.current) {
      hasNavigated.current = true;
      console.log('[LobbyView] inGame=true → navigating to /game'); // TODO: remove
      navigate('/game');
    }
  }, [inGame, navigate]);

  // Load friends
  useEffect(() => {
    api.getFriends().then(d => setFriends(d.friends)).catch(() => {});
    api.getPendingRequests().then(d => setPendingRequests(d.requests)).catch(() => {});
  }, []);

  // Socket event listeners (lobby-specific only; game events handled by GameProvider)
  useEffect(() => {
    if (!socket) return;

    const onLobbyUpdate = (data: LobbyUpdatePayload) => {
      setLobby(data);
    };

    const onInvite = (data: LobbyInvitePayload) => {
      setInvite(data);
    };

    const onError = (data: { code: string; message: string }) => {
      setError(data.message);
      setTimeout(() => setError(''), 4000);
    };

    socket.on('LOBBY_UPDATE', onLobbyUpdate);
    socket.on('LOBBY_INVITE_RECEIVED', onInvite);
    socket.on('GAME_ERROR', onError);

    return () => {
      socket.off('LOBBY_UPDATE', onLobbyUpdate);
      socket.off('LOBBY_INVITE_RECEIVED', onInvite);
      socket.off('GAME_ERROR', onError);
    };
  }, [socket]);

  const handleQuickMatch = useCallback(() => {
    if (queuing) {
      socket?.emit('QUEUE_LEAVE');
      setQueuing(false);
    } else {
      socket?.emit('QUEUE_JOIN');
      setQueuing(true);
    }
  }, [socket, queuing]);

  const handleCreateLobby = useCallback(() => {
    socket?.emit('LOBBY_CREATE');
  }, [socket]);

  const handleJoinLobby = useCallback(() => {
    if (joinCode.trim()) {
      socket?.emit('LOBBY_JOIN', { lobbyCode: joinCode.trim().toUpperCase() });
    }
  }, [socket, joinCode]);

  const handleStartLobby = useCallback(() => {
    socket?.emit('LOBBY_START');
  }, [socket]);

  const handleInviteFriend = useCallback((friendId: string) => {
    socket?.emit('LOBBY_INVITE', { friendId });
  }, [socket]);

  const handleAcceptInvite = useCallback(() => {
    if (invite) {
      socket?.emit('LOBBY_JOIN', { lobbyCode: invite.lobbyCode });
      setInvite(null);
    }
  }, [socket, invite]);

  const handleStartAI = useCallback(() => {
    socket?.emit('START_AI_GAME', { difficulty: aiDifficulty });
  }, [socket, aiDifficulty]);

  const handleAddFriend = useCallback(async () => {
    try {
      await api.addFriend(friendUsername.trim());
      setFriendUsername('');
      setError('');
    } catch (err: any) {
      setError(err.message);
    }
  }, [friendUsername]);

  const handleRespondFriend = useCallback(async (friendshipId: string, accept: boolean) => {
    try {
      await api.respondFriend(friendshipId, accept);
      setPendingRequests(prev => prev.filter(p => p.friendshipId !== friendshipId));
      if (accept) {
        const res = await api.getFriends();
        setFriends(res.friends);
      }
    } catch (err: any) {
      setError(err.message);
    }
  }, []);

  return (
    <div className="lobby-view">
      {error && <div className="error-toast">{error}</div>}

      {/* Invite notification */}
      {invite && (
        <div className="invite-banner card">
          <p><strong>{invite.fromUsername}</strong> invited you to play!</p>
          <div className="invite-actions">
            <button className="btn-primary" onClick={handleAcceptInvite}>Join</button>
            <button className="btn-secondary" onClick={() => setInvite(null)}>Dismiss</button>
          </div>
        </div>
      )}

      <div className="lobby-grid">
        {/* Quick Match */}
        <div className="card lobby-section">
          <h2>Quick Match</h2>
          <p className="section-desc">Find an opponent automatically</p>
          <button
            className={queuing ? 'btn-danger' : 'btn-primary'}
            onClick={handleQuickMatch}
            disabled={!connected}
          >
            {queuing ? 'Cancel Search...' : 'Find Match'}
          </button>
          {queuing && <p className="searching">Searching for opponent...</p>}
        </div>

        {/* AI Game */}
        <div className="card lobby-section">
          <h2>vs Pharaoh AI</h2>
          <p className="section-desc">Practice against the computer</p>
          <div className="ai-options">
            {(['easy', 'medium', 'hard'] as AIDifficulty[]).map(d => (
              <button
                key={d}
                className={`btn-secondary ${aiDifficulty === d ? 'active' : ''}`}
                onClick={() => setAiDifficulty(d)}
              >
                {d.charAt(0).toUpperCase() + d.slice(1)}
              </button>
            ))}
          </div>
          <button className="btn-primary" onClick={handleStartAI} disabled={!connected}>
            Play AI ({aiDifficulty})
          </button>
        </div>

        {/* Private Lobby */}
        <div className="card lobby-section">
          <h2>Private Match</h2>
          {lobby ? (
            <div className="lobby-info">
              <p>Lobby Code:</p>
              <div className="lobby-code">{lobby.lobbyCode}</div>
              <p className="lobby-status">
                {lobby.guestName
                  ? `${lobby.guestName} joined!`
                  : 'Waiting for opponent...'}
              </p>
              {lobby.guestId && lobby.hostId === user?.id && (
                <button className="btn-primary" onClick={handleStartLobby}>Start Game</button>
              )}
              {friends.length > 0 && !lobby.guestId && (
                <div className="invite-friends">
                  <p className="small">Invite a friend:</p>
                  {friends.map((f: any) => (
                    <button
                      key={f.id}
                      className="btn-secondary friend-invite-btn"
                      onClick={() => handleInviteFriend(f.id)}
                    >
                      {f.displayName}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <div className="lobby-actions">
              <button className="btn-primary" onClick={handleCreateLobby} disabled={!connected}>
                Create Lobby
              </button>
              <div className="join-group">
                <input
                  value={joinCode}
                  onChange={e => setJoinCode(e.target.value)}
                  placeholder="Enter code"
                  maxLength={10}
                />
                <button className="btn-secondary" onClick={handleJoinLobby} disabled={!connected || !joinCode}>
                  Join
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Friends */}
        <div className="card lobby-section">
          <h2>Friends</h2>
          <div className="add-friend-group">
            <input
              value={friendUsername}
              onChange={e => setFriendUsername(e.target.value)}
              placeholder="Username to add"
            />
            <button className="btn-secondary" onClick={handleAddFriend} disabled={!friendUsername.trim()}>
              Add
            </button>
          </div>

          {pendingRequests.length > 0 && (
            <div className="pending-requests">
              <h4>Pending Requests</h4>
              {pendingRequests.map((r: any) => (
                <div key={r.friendshipId} className="pending-item">
                  <span>{r.from.displayName}</span>
                  <button className="btn-primary small" onClick={() => handleRespondFriend(r.friendshipId, true)}>Accept</button>
                  <button className="btn-secondary small" onClick={() => handleRespondFriend(r.friendshipId, false)}>Reject</button>
                </div>
              ))}
            </div>
          )}

          {friends.length > 0 ? (
            <ul className="friend-list">
              {friends.map((f: any) => (
                <li key={f.id}>{f.displayName} <span className="friend-tag">@{f.username}</span></li>
              ))}
            </ul>
          ) : (
            <p className="no-friends">No friends yet — add someone!</p>
          )}
        </div>
      </div>

      {!connected && (
        <div className="connection-status">Connecting to server...</div>
      )}
    </div>
  );
}
