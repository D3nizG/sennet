import { Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
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
  const location = useLocation();

  if (!user) return null;

  // While viewing any profile page, ProfileView shows its own back button —
  // hide the redundant nameplate in the header.
  const onProfilePage = location.pathname.startsWith('/profile');

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
              hideProfile={onProfilePage}
              onBack={() => navigate(-1)}
            />
            <Routes>
              <Route path="/" element={<LobbyView />} />
              <Route path="/profile" element={<ProfileView />} />
              <Route path="/profile/:id" element={<ProfileView />} />
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
