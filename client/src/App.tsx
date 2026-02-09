import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Layout } from './components/Layout/Layout';
import { AuthForm } from './components/Auth/AuthForm';
import { LobbyView } from './components/Lobby/LobbyView';
import { GameView } from './components/Game/GameView';
import { ProfileView } from './components/Profile/ProfileView';
import './App.css';

export default function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  if (!user) {
    return <AuthForm />;
  }

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<LobbyView />} />
        <Route path="/game" element={<GameView />} />
        <Route path="/profile" element={<ProfileView />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
