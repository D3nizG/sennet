import React, { useState, useEffect } from 'react';
import { useAuth } from '../../context/AuthContext';
import { api } from '../../services/api';
import './ProfileView.css';

export function ProfileView() {
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [houseColor, setHouseColor] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api.getProfile().then(data => {
      setProfile(data);
      setDisplayName(data.displayName);
      setHouseColor(data.houseColor);
    }).catch(console.error);
  }, []);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await api.updateProfile({ displayName, houseColor });
      updateUser({ displayName: res.displayName, houseColor: res.houseColor });
      setProfile((prev: any) => ({ ...prev, displayName: res.displayName, houseColor: res.houseColor }));
      setEditing(false);
    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  if (!profile) return <div className="loading-screen">Loading profile...</div>;

  const s = profile.stats;

  return (
    <div className="profile-view">
      <div className="profile-header card">
        <div className="profile-avatar" style={{ background: profile.houseColor }}>
          <span>𓁹</span>
        </div>
        <div className="profile-info">
          {editing ? (
            <div className="edit-fields">
              <input value={displayName} onChange={e => setDisplayName(e.target.value)} placeholder="Display Name" />
              <div className="color-picker">
                <label>House Color:</label>
                <input type="color" value={houseColor} onChange={e => setHouseColor(e.target.value)} />
              </div>
              <div className="edit-actions">
                <button className="btn-primary" onClick={handleSave} disabled={saving}>
                  {saving ? 'Saving...' : 'Save'}
                </button>
                <button className="btn-secondary" onClick={() => setEditing(false)}>Cancel</button>
              </div>
            </div>
          ) : (
            <>
              <h2>{profile.displayName}</h2>
              <p className="username">@{profile.username}</p>
              <button className="btn-secondary" onClick={() => setEditing(true)}>Edit Profile</button>
            </>
          )}
        </div>
      </div>

      <div className="stats-grid">
        <StatCard label="Games Played" value={s.gamesPlayed} />
        <StatCard label="Wins" value={s.wins} accent />
        <StatCard label="Losses" value={s.losses} />
        <StatCard label="Win Rate" value={`${s.winRate}%`} accent />
        <StatCard label="Current Streak" value={s.currentStreak} />
        <StatCard label="Best Streak" value={s.bestStreak} accent />
        <StatCard label="Avg Borne Off" value={s.avgBorneOff} />
        <StatCard label="Avg Turns" value={s.avgTurns} />
        <StatCard label="Captures/Game" value={s.capturesPerGame} />
        <StatCard label="Resign Rate" value={`${s.resignRate}%`} />
        {/* <StatCard label="Disconnects" value={s.disconnects} /> */}
      </div>

      <div className="card recent-games">
        <h3>Recent Games</h3>
        {profile.recentGames.length === 0 ? (
          <p className="no-games">No games played yet</p>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Opponent</th>
                <th>Result</th>
                <th>Turns</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {profile.recentGames.map((g: any) => (
                <tr key={g.id}>
                  <td>{g.opponent} {g.isAiGame && <span className="ai-badge">AI</span>}</td>
                  <td className={g.won ? 'win' : 'loss'}>{g.won ? 'W' : 'L'}</td>
                  <td>{g.turns}</td>
                  <td>{new Date(g.date).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, accent }: { label: string; value: any; accent?: boolean }) {
  return (
    <div className={`stat-card card ${accent ? 'accent' : ''}`}>
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
