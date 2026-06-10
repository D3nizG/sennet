import { Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { AuthForm } from './components/Auth/AuthForm';
import { LobbyView } from './components/Lobby/LobbyView';
import { GameView } from './components/Game/GameView';
import { ProfileView } from './components/Profile/ProfileView';
import { EgyptianPageShell, GameHeader } from './components/EgyptianTheme';
import './App.css';

function AuthedApp() {
  const { user } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;

  return (
    <Routes>
      {/* Game page manages its own full-screen shell (no global navbar) */}
      <Route path="/game" element={<GameView />} />

      {/* All other pages share the global shell + header */}
      <Route
        path="/*"
        element={
          <EgyptianPageShell>
            <GameHeader
              username={user.displayName || user.username}
              avatarColor={user.houseColor}
              onProfileClick={() => navigate('/profile')}
            />
            <Routes>
              <Route path="/" element={<LobbyView />} />
              <Route path="/profile" element={<ProfileView />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </EgyptianPageShell>
        }
      />
    </Routes>
  );
}

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!user) {
    return <AuthForm />;
  }

  return <AuthedApp />;
}
