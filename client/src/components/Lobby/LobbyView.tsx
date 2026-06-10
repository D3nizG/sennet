import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useSocket } from '../../context/SocketContext';
import { useGame } from '../../hooks/useGame';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import type {
  LobbyUpdatePayload,
  LobbyInvitePayload,
  AIDifficulty,
} from '@sennet/game-engine';
import {
  EgyptianPanel,
  ParchmentButton,
  EgyptianButton,
  EgyptianIconButton,
  EgyptianInput,
  MedallionIcon,
} from '../EgyptianTheme';
import './LobbyView.css';

export function LobbyView() {
  const navigate = useNavigate();
  const location = useLocation();
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
  const [friendsOpen, setFriendsOpen] = useState(false);

  const loadFriends = useCallback(async () => {
    try {
      const [friendsRes, pendingRes] = await Promise.all([
        api.getFriends(),
        api.getPendingRequests(),
      ]);
      setFriends(friendsRes.friends);
      setPendingRequests(pendingRes.requests);
    } catch {
      // Keep current UI state when refresh fails.
    }
  }, []);

  useEffect(() => {
    if (inGame && !hasNavigated.current) {
      hasNavigated.current = true;
      console.log('[LobbyView] inGame=true → navigating to /game'); // TODO: remove
      navigate('/game');
    }
  }, [inGame, navigate]);

  useEffect(() => {
    const state = location.state as { autoQueue?: boolean } | null;
    if (state?.autoQueue && connected && socket) {
      socket.emit('QUEUE_JOIN');
      setQueuing(true);
      navigate(location.pathname, { replace: true, state: {} });
    }
  }, [location.state, connected, socket, navigate, location.pathname]);

  useEffect(() => {
    void loadFriends();
  }, [loadFriends]);

  useEffect(() => {
    if (!socket) return;

    const onLobbyUpdate = (data: LobbyUpdatePayload) => setLobby(data);
    const onLobbyCancelled = (data: { reason: string }) => {
      setLobby(null);
      setError(data.reason || 'Lobby was cancelled');
      setTimeout(() => setError(''), 4000);
    };
    const onInvite = (data: LobbyInvitePayload) => setInvite(data);
    const onFriendsUpdated = () => { void loadFriends(); };
    const onError = (data: { code: string; message: string }) => {
      setError(data.message);
      setTimeout(() => setError(''), 4000);
    };

    socket.on('LOBBY_UPDATE', onLobbyUpdate);
    socket.on('LOBBY_CANCELLED', onLobbyCancelled);
    socket.on('LOBBY_INVITE_RECEIVED', onInvite);
    socket.on('FRIENDS_UPDATED', onFriendsUpdated);
    socket.on('GAME_ERROR', onError);

    return () => {
      socket.off('LOBBY_UPDATE', onLobbyUpdate);
      socket.off('LOBBY_CANCELLED', onLobbyCancelled);
      socket.off('LOBBY_INVITE_RECEIVED', onInvite);
      socket.off('FRIENDS_UPDATED', onFriendsUpdated);
      socket.off('GAME_ERROR', onError);
    };
  }, [socket, loadFriends]);

  // Restore any in-progress private lobby after navigating back to the lobby
  // (the socket persists across SPA navigation, but local lobby state is lost).
  useEffect(() => {
    if (connected && socket) socket.emit('LOBBY_SYNC');
  }, [connected, socket]);

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

  const handleCancelLobby = useCallback(() => {
    socket?.emit('LOBBY_CANCEL');
    setLobby(null);
  }, [socket]);

  const handleViewFriendProfile = useCallback((friendId: string) => {
    navigate(`/profile/${friendId}`);
  }, [navigate]);

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
      await loadFriends();
    } catch (err: any) {
      setError(err.message);
    }
  }, [friendUsername, loadFriends]);

  const handleRespondFriend = useCallback(async (friendshipId: string, accept: boolean) => {
    try {
      await api.respondFriend(friendshipId, accept);
      await loadFriends();
    } catch (err: any) {
      setError(err.message);
    }
  }, [loadFriends]);

  const handleRemoveFriend = useCallback(async (friendshipId: string) => {
    try {
      await api.removeFriend(friendshipId);
      await loadFriends();
    } catch (err: any) {
      setError(err.message);
    }
  }, [loadFriends]);

  const handleInviteFriendToGame = useCallback((friendId: string) => {
    if (!lobby) socket?.emit('LOBBY_CREATE');
    socket?.emit('LOBBY_INVITE', { friendId });
  }, [socket, lobby]);

  return (
    <div className="lobby-view">
      {error && <div className="lobby-error-toast">{error}</div>}

      {invite && (
        <div className="lobby-invite-banner">
          <EgyptianPanel ornament className="lobby-invite-panel">
            <p className="lobby-invite-text egypt-body">
              <span className="egypt-display">{invite.fromUsername}</span> invites you to play!
            </p>
            <div className="lobby-invite-actions">
              <ParchmentButton onClick={handleAcceptInvite}>Join Game</ParchmentButton>
              <EgyptianButton onClick={() => setInvite(null)}>Dismiss</EgyptianButton>
            </div>
          </EgyptianPanel>
        </div>
      )}

      <EgyptianPanel ornament className="lobby-frame">
        <span className="lobby-corner lobby-corner--tl" aria-hidden="true" />
        <span className="lobby-corner lobby-corner--tr" aria-hidden="true" />
        <span className="lobby-corner lobby-corner--bl" aria-hidden="true" />
        <span className="lobby-corner lobby-corner--br" aria-hidden="true" />
        <div className="lobby-compartments">

          {/* ── Quick Match ── */}
          <div className="lobby-compartment">
            <div className="lobby-sec-header">
              <MedallionIcon size="lg">⚔</MedallionIcon>
              <div className="lobby-sec-title-wrap">
                <h2 className="egypt-display lobby-sec-title">Quick Match</h2>
                <div className="gold-divider" />
              </div>
            </div>
            <p className="egypt-body lobby-desc">Find an opponent automatically.</p>
            <div className="lobby-sec-footer">
              {queuing ? (
                <>
                  <p className="lobby-searching">Searching for opponent…</p>
                  <EgyptianButton fullWidth onClick={handleQuickMatch} className="lobby-cancel-btn">
                    Cancel Search
                  </EgyptianButton>
                </>
              ) : (
                <ParchmentButton fullWidth onClick={handleQuickMatch} disabled={!connected}>
                  Find Match
                </ParchmentButton>
              )}
            </div>
          </div>

          {/* ── Vs Pharaoh AI ── */}
          <div className="lobby-compartment">
            <div className="lobby-sec-header">
              <MedallionIcon size="lg">𓂀</MedallionIcon>
              <div className="lobby-sec-title-wrap">
                <h2 className="egypt-display lobby-sec-title">Vs Pharaoh AI</h2>
                <div className="gold-divider" />
              </div>
            </div>
            <p className="egypt-body lobby-desc">Practice against the computer.</p>
            <div className="lobby-difficulty">
              {(['easy', 'medium', 'hard'] as AIDifficulty[]).map(d => (
                <EgyptianButton
                  key={d}
                  className={aiDifficulty === d ? 'lobby-diff-btn lobby-diff-btn--active' : 'lobby-diff-btn'}
                  onClick={() => setAiDifficulty(d)}
                >
                  {d.charAt(0).toUpperCase() + d.slice(1)}
                </EgyptianButton>
              ))}
            </div>
            <div className="lobby-sec-footer">
              <ParchmentButton fullWidth onClick={handleStartAI} disabled={!connected}>
                Play AI
              </ParchmentButton>
            </div>
          </div>

          {/* ── Private Match ── */}
          <div className="lobby-compartment">
            <div className="lobby-sec-header">
              <MedallionIcon size="lg">𓋹</MedallionIcon>
              <div className="lobby-sec-title-wrap">
                <h2 className="egypt-display lobby-sec-title">Private Match</h2>
                <div className="gold-divider" />
              </div>
            </div>
            <p className="egypt-body lobby-desc">Create a lobby and invite others.</p>

            {lobby ? (
              <div className="lobby-private-info">
                <p className="egypt-label">Lobby Code</p>
                <div className="lobby-code egypt-display">{lobby.lobbyCode}</div>
                <p className="lobby-status egypt-muted">
                  {lobby.guestName ? `${lobby.guestName} has joined!` : 'Waiting for opponent…'}
                </p>
                {lobby.guestId && lobby.hostId === user?.id && (
                  <ParchmentButton fullWidth onClick={handleStartLobby}>
                    Start Game
                  </ParchmentButton>
                )}
                <EgyptianButton fullWidth className="lobby-cancel-btn" onClick={handleCancelLobby}>
                  Cancel Lobby
                </EgyptianButton>
                {friends.length > 0 && !lobby.guestId && (
                  <div className="lobby-invite-friends">
                    <p className="egypt-label lobby-invite-label">Invite a Friend</p>
                    <div className="lobby-friend-invite-list">
                      {friends.map((f: any) => (
                        <EgyptianButton
                          key={f.id}
                          className="lobby-friend-invite-btn"
                          onClick={() => handleInviteFriend(f.id)}
                        >
                          {f.displayName}
                        </EgyptianButton>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="lobby-private-actions">
                <ParchmentButton fullWidth onClick={handleCreateLobby} disabled={!connected}>
                  Create Lobby
                </ParchmentButton>
                <div className="lobby-join-group">
                  <EgyptianInput
                    value={joinCode}
                    onChange={e => setJoinCode(e.target.value)}
                    placeholder="Enter lobby code"
                    maxLength={10}
                    className="lobby-code-input"
                  />
                  <EgyptianButton
                    onClick={handleJoinLobby}
                    disabled={!connected || !joinCode}
                    className="lobby-join-btn"
                  >
                    Join
                  </EgyptianButton>
                </div>
              </div>
            )}
          </div>

        </div>
      </EgyptianPanel>

      {!connected && (
        <p className="lobby-connection-status egypt-muted">Connecting to server…</p>
      )}

      {/* ── Friends toggle tab ── */}
      <button
        className="lobby-friends-tab"
        onClick={() => setFriendsOpen(o => !o)}
        aria-label="Toggle friends panel"
      >
        <span className="lobby-friends-tab__icon">𓁹</span>
        <span className="lobby-friends-tab__label">Friends</span>
        {pendingRequests.length > 0 && (
          <span className="lobby-friends-tab__badge">{pendingRequests.length}</span>
        )}
      </button>

      {/* ── Friends slide-in drawer ── */}
      {friendsOpen && (
        <div className="lobby-friends-overlay" onClick={() => setFriendsOpen(false)} />
      )}
      <aside className={`lobby-friends-drawer${friendsOpen ? ' lobby-friends-drawer--open' : ''}`}>
        <div className="lobby-friends-drawer__header">
          <h2 className="egypt-display lobby-friends-drawer__title">Friends</h2>
          <EgyptianIconButton size="sm" title="Close" onClick={() => setFriendsOpen(false)}>
            ✕
          </EgyptianIconButton>
        </div>

        <div className="lobby-friends-drawer__body">
          <div className="lobby-add-friend">
            <EgyptianInput
              value={friendUsername}
              onChange={e => setFriendUsername(e.target.value)}
              placeholder="Username to add"
            />
            <EgyptianButton
              onClick={handleAddFriend}
              disabled={!friendUsername.trim()}
              className="lobby-add-btn"
            >
              Add
            </EgyptianButton>
          </div>

          {pendingRequests.length > 0 && (
            <div className="lobby-pending">
              <p className="egypt-label lobby-pending-label">Pending Requests</p>
              {pendingRequests.map((r: any) => (
                <div key={r.friendshipId} className="lobby-pending-item">
                  <span className="egypt-body lobby-pending-name">{r.from.displayName}</span>
                  <div className="lobby-pending-actions">
                    <EgyptianIconButton
                      size="sm"
                      title="Accept"
                      onClick={() => handleRespondFriend(r.friendshipId, true)}
                    >
                      ✓
                    </EgyptianIconButton>
                    <EgyptianIconButton
                      size="sm"
                      danger
                      title="Reject"
                      onClick={() => handleRespondFriend(r.friendshipId, false)}
                    >
                      ✕
                    </EgyptianIconButton>
                  </div>
                </div>
              ))}
            </div>
          )}

          {friends.length > 0 ? (
            <ul className="lobby-friend-list egypt-scrollbar">
              {friends.map((f: any) => (
                <li key={f.friendshipId ?? f.id} className="lobby-friend-item">
                  <MedallionIcon size="sm" className="lobby-friend-avatar">
                    {f.displayName?.[0]?.toUpperCase() ?? '?'}
                  </MedallionIcon>
                  <div className="lobby-friend-info">
                    <span className="egypt-body lobby-friend-name">{f.displayName}</span>
                    <span className="egypt-muted">@{f.username}</span>
                  </div>
                  <div className="lobby-friend-btns">
                    <EgyptianIconButton
                      size="sm"
                      title="View profile"
                      onClick={() => handleViewFriendProfile(f.id)}
                    >
                      𓂀
                    </EgyptianIconButton>
                    <EgyptianIconButton
                      size="sm"
                      title="Invite to game"
                      onClick={() => handleInviteFriendToGame(f.id)}
                    >
                      ⚔
                    </EgyptianIconButton>
                    <EgyptianIconButton
                      size="sm"
                      danger
                      title="Remove friend"
                      onClick={() => handleRemoveFriend(f.friendshipId ?? f.id)}
                    >
                      ✕
                    </EgyptianIconButton>
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="egypt-muted lobby-no-friends">
              No companions yet — send an invitation!
            </p>
          )}
        </div>
      </aside>
    </div>
  );
}
