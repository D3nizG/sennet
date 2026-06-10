import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import { api } from '../../services/api';
import {
  EgyptianPanel,
  EgyptianButton,
  ParchmentButton,
  EgyptianInput,
  StatCard,
  SectionTitle,
  MedallionIcon,
} from '../EgyptianTheme';
import './ProfileView.css';

const HOUSE_COLORS = [
  { name: 'Red',    hex: '#e53e3e' },
  { name: 'Orange', hex: '#dd6b20' },
  { name: 'Yellow', hex: '#d69e2e' },
  { name: 'Green',  hex: '#38a169' },
  { name: 'Blue',   hex: '#3182ce' },
  { name: 'Purple', hex: '#805ad5' },
  { name: 'Cyan',   hex: '#00b5d8' },
  { name: 'Black',  hex: '#1a1a1a' },
  { name: 'White',  hex: '#f0ece3' },
  { name: 'Silver', hex: '#a0aec0' },
];

export function ProfileView() {
  const { updateUser, logout } = useAuth();
  const { socket } = useSocket();
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [houseColor, setHouseColor] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getProfile()
      .then(data => {
        setProfile(data);
        setDisplayName(data.displayName);
        setHouseColor(data.houseColor);
      })
      .catch(err => {
        console.error(err);
        setError('Failed to load profile.');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.updateProfile({ displayName, houseColor });
      updateUser({ displayName: res.displayName, houseColor: res.houseColor });
      setProfile((prev: any) => ({ ...prev, displayName: res.displayName, houseColor: res.houseColor }));
      if (socket) {
        socket.disconnect();
        socket.connect();
      }
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  // ── Custom scroll rail ──────────────────────────────────────────────────
  const scrollRef = useRef<HTMLDivElement>(null);
  const [thumbStyle, setThumbStyle] = useState<React.CSSProperties>({ height: '30%', top: '0%' });

  const updateThumb = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const { scrollTop, scrollHeight, clientHeight } = el;
    if (scrollHeight <= clientHeight) {
      setThumbStyle({ height: '100%', top: '0%', opacity: 0.25 });
      return;
    }
    const thumbPct = Math.max(15, (clientHeight / scrollHeight) * 100);
    const topPct   = (scrollTop / (scrollHeight - clientHeight)) * (100 - thumbPct);
    setThumbStyle({ height: `${thumbPct}%`, top: `${topPct}%` });
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    updateThumb();
    el.addEventListener('scroll', updateThumb, { passive: true });
    return () => el.removeEventListener('scroll', updateThumb);
  }, [profile, updateThumb]);

  const scrollStep = (delta: number) => {
    scrollRef.current?.scrollBy({ top: delta, behavior: 'smooth' });
  };
  // ────────────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="profile-page profile-page--state">
        <EgyptianPanel className="profile-state-panel">
          <p className="egypt-muted profile-state-text">Loading profile…</p>
        </EgyptianPanel>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="profile-page profile-page--state">
        <EgyptianPanel className="profile-state-panel">
          <p className="egypt-muted profile-state-text">{error ?? 'Profile not found.'}</p>
        </EgyptianPanel>
      </div>
    );
  }

  const s = profile.stats;
  const initials = (profile.displayName || profile.username || '?')[0].toUpperCase();

  return (
    <div className="profile-page">
      <EgyptianPanel ornament className="profile-main-panel">

        {/* ── Hero ── */}
        <div className={`profile-hero${editing ? ' profile-hero--editing' : ''}`}>
          <div className="profile-hero__avatar-wrap">
            <MedallionIcon
              size="lg"
              className="profile-avatar-medallion"
              accentColor={profile.houseColor}
            >
              <span className="profile-avatar-initial">{initials}</span>
            </MedallionIcon>
          </div>

          {editing ? (
            <div className="profile-hero__identity">
              <div className="profile-edit-fields">
                <EgyptianInput
                  label="Display Name"
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Display Name"
                  id="profile-display-name"
                />
                <div className="profile-color-picker">
                  <span className="egypt-label">House Color</span>
                  <div className="profile-color-swatches">
                    {HOUSE_COLORS.map(({ name, hex }) => (
                      <button
                        key={hex}
                        type="button"
                        title={name}
                        className={`profile-color-swatch${houseColor === hex ? ' profile-color-swatch--active' : ''}`}
                        style={{ background: hex }}
                        onClick={() => setHouseColor(hex)}
                      />
                    ))}
                  </div>
                </div>
                <div className="profile-edit-actions">
                  <ParchmentButton onClick={handleSave} disabled={saving}>
                    {saving ? 'Saving…' : 'Save Changes'}
                  </ParchmentButton>
                  <EgyptianButton onClick={() => setEditing(false)}>
                    Cancel
                  </EgyptianButton>
                </div>
              </div>
            </div>
          ) : (
            <>
              <div className="profile-hero__identity">
                <h1 className="profile-display-name egypt-display">{profile.displayName}</h1>
                <p className="profile-handle egypt-muted">@{profile.username}</p>
              </div>
              <div className="profile-hero__actions">
                <EgyptianButton onClick={() => setEditing(true)}>
                  Edit Profile
                </EgyptianButton>
                <EgyptianButton className="profile-signout-btn" onClick={logout}>
                  Sign Out
                </EgyptianButton>
              </div>
            </>
          )}
        </div>

        {/* ── Stats ── */}
        <div className="profile-section">
          <SectionTitle align="left">Statistics</SectionTitle>
          <div className="profile-stats-grid">
            <StatCard label="Games Played"   value={s.gamesPlayed} />
            <StatCard label="Wins"           value={s.wins}           highlight />
            <StatCard label="Losses"         value={s.losses} />
            <StatCard label="Win Rate"       value={`${s.winRate}%`}  highlight />
            <StatCard label="Current Streak" value={s.currentStreak} />
            <StatCard label="Best Streak"    value={s.bestStreak}     highlight />
            <StatCard label="Avg Borne Off"  value={s.avgBorneOff} />
            <StatCard label="Avg Turns"      value={s.avgTurns} />
            <StatCard label="Captures/Game"  value={s.capturesPerGame} />
            <StatCard label="Resign Rate"    value={`${s.resignRate}%`} />
          </div>
        </div>

        {/* ── Recent Games ── */}
        <div className="profile-section profile-section--games">
          <SectionTitle align="left">Recent Games</SectionTitle>

          {/* Simple single-border frame — no EgyptianPanel to avoid double-border ::before */}
          <div className="profile-games-frame">
            {profile.recentGames.length === 0 ? (
              <p className="egypt-muted profile-no-games">No recent games yet.</p>
            ) : (
              <>
                {/* Header row — rail spacer keeps column widths aligned with body */}
                <div className="profile-games-header-row">
                  <table className="profile-games-table">
                    <colgroup><col /><col /><col /><col /></colgroup>
                    <thead>
                      <tr>
                        <th>Opponent</th>
                        <th>Result</th>
                        <th>Turns</th>
                        <th>Date</th>
                      </tr>
                    </thead>
                  </table>
                  <div className="profile-rail-spacer" aria-hidden="true" />
                </div>

                {/* Body row — scroll area + custom rail */}
                <div className="profile-games-body-row">
                  <div className="profile-games-scroll" ref={scrollRef}>
                    <table className="profile-games-table profile-games-table--body">
                      <colgroup><col /><col /><col /><col /></colgroup>
                      <tbody>
                        {profile.recentGames.map((g: any) => (
                          <tr key={g.id}>
                            <td>
                              {g.opponent}
                              {g.isAiGame && <span className="profile-ai-badge">AI</span>}
                            </td>
                            <td className={g.won ? 'profile-result--win' : 'profile-result--loss'}>
                              {g.won ? 'W' : 'L'}
                            </td>
                            <td>{g.turns}</td>
                            <td>{new Date(g.date).toLocaleDateString()}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Custom scroll rail */}
                  <div className="profile-scroll-rail">
                    <button
                      className="profile-scroll-btn"
                      onClick={() => scrollStep(-72)}
                      aria-label="Scroll up"
                    >▲</button>
                    <div className="profile-scroll-track">
                      <div className="profile-scroll-thumb" style={thumbStyle} />
                    </div>
                    <button
                      className="profile-scroll-btn"
                      onClick={() => scrollStep(72)}
                      aria-label="Scroll down"
                    >▼</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

      </EgyptianPanel>
    </div>
  );
}
