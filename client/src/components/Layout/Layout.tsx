import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSocket } from '../../context/SocketContext';
import './Layout.css';

export function Layout({ children }: { children: React.ReactNode }) {
  const { user, logout } = useAuth();
  const { connected } = useSocket();
  const location = useLocation();

  return (
    <div className="app-layout">
      <header className="app-header">
        <Link to="/" className="brand">
          <span className="brand-icon">𓁹</span>
          <span className="brand-name">Sennet</span>
        </Link>

        <nav className="nav-links">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Play</Link>
          <Link to="/game" className={location.pathname === '/game' ? 'active' : ''}>Game</Link>
          <Link to="/profile" className={location.pathname === '/profile' ? 'active' : ''}>Profile</Link>
        </nav>

        <div className="header-right">
          <span className={`connection-dot ${connected ? 'online' : 'offline'}`} />
          {user && (
            <div className="user-badge">
              <div className="user-dot" style={{ background: user.houseColor }} />
              <span>{user.displayName}</span>
            </div>
          )}
          <button className="btn-secondary logout-btn" onClick={logout}>
            Sign Out
          </button>
        </div>
      </header>

      <main className="app-main">
        {children}
      </main>
    </div>
  );
}
