import { useNavigate } from 'react-router-dom';
import { withClickSound } from '../../audio/clickSound';
import './GameHeader.css';

interface GameHeaderProps {
  username: string;
  handle?: string;
  avatarColor?: string;
  onProfileClick?: () => void;
  className?: string;
  /** Hide the profile nameplate (e.g. while already viewing a profile page). */
  hideProfile?: boolean;
  /** When set, a Back button is shown in the top-right slot instead of the nameplate. */
  onBack?: () => void;
}

export function BrandMark() {
  const navigate = useNavigate();
  return (
    <button
      className="brand-mark"
      onClick={withClickSound('ui-secondary', () => navigate('/'))}
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
    <button className="user-nameplate" onClick={withClickSound('ui-secondary', onProfileClick)} aria-label="View profile">
      <div className="user-nameplate__text">
        <span className="user-nameplate__name egypt-body">{username}</span>
        {handle && <span className="user-nameplate__handle egypt-muted">{handle}</span>}
      </div>
      <AvatarMedallion color={avatarColor} initials={initials} />
    </button>
  );
}

export function GameHeader({ username, handle, avatarColor, onProfileClick, className, hideProfile, onBack }: GameHeaderProps) {
  const navigate = useNavigate();
  return (
    <header className={`egypt-site-header ${className ?? ''}`}>
      <BrandMark />
      {hideProfile ? (
        <button
          className="header-back-btn egypt-label"
          onClick={withClickSound('ui-secondary', onBack ?? (() => navigate(-1)))}
          aria-label="Go back"
        >
          ← Back
        </button>
      ) : (
        <UserNameplate
          username={username}
          handle={handle}
          avatarColor={avatarColor}
          onProfileClick={onProfileClick ?? (() => navigate('/profile'))}
        />
      )}
    </header>
  );
}
