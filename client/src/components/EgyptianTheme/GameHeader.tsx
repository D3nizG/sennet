import { useNavigate } from 'react-router-dom';
import './GameHeader.css';

interface GameHeaderProps {
  username: string;
  handle?: string;
  avatarColor?: string;
  onProfileClick?: () => void;
  className?: string;
}

export function BrandMark() {
  const navigate = useNavigate();
  return (
    <button
      className="brand-mark"
      onClick={() => navigate('/')}
      aria-label="Go to lobby"
    >
      <span className="brand-mark__icon">𓁹</span>
      <span className="brand-mark__name egypt-display">Sennet</span>
    </button>
  );
}

interface AvatarMedallionProps {
  color?: string;
  initials?: string;
}

export function AvatarMedallion({ color = '#d8a93a', initials = '?' }: AvatarMedallionProps) {
  return (
    <div
      className="avatar-medallion"
      style={{ '--avatar-color': color } as React.CSSProperties}
    >
      <span className="avatar-medallion__initial">{initials}</span>
    </div>
  );
}

interface UserNameplateProps {
  username: string;
  handle?: string;
  avatarColor?: string;
  onProfileClick?: () => void;
}

export function UserNameplate({ username, handle, avatarColor, onProfileClick }: UserNameplateProps) {
  const initials = username ? username[0].toUpperCase() : '?';
  return (
    <button className="user-nameplate" onClick={onProfileClick} aria-label="View profile">
      <div className="user-nameplate__text">
        <span className="user-nameplate__name egypt-body">{username}</span>
        {handle && <span className="user-nameplate__handle egypt-muted">{handle}</span>}
      </div>
      <AvatarMedallion color={avatarColor} initials={initials} />
    </button>
  );
}

export function GameHeader({ username, handle, avatarColor, onProfileClick, className }: GameHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className={`egypt-site-header ${className ?? ''}`}>
      <BrandMark />
      <UserNameplate
        username={username}
        handle={handle}
        avatarColor={avatarColor}
        onProfileClick={onProfileClick ?? (() => navigate('/profile'))}
      />
    </header>
  );
}
