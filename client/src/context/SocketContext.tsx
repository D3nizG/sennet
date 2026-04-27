import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { connectSocket, disconnectSocket, TypedSocket } from '../services/socket';
import { useAuth } from './AuthContext';

interface SocketContextValue {
  socket: TypedSocket | null;
  connected: boolean;
}

const SocketContext = createContext<SocketContextValue>({ socket: null, connected: false });

export function SocketProvider({ children }: { children: React.ReactNode }) {
  const { token, logout } = useAuth();
  const [socket, setSocket] = useState<TypedSocket | null>(null);
  const [connected, setConnected] = useState(false);
  // Keep logout ref stable so the effect doesn't re-run when logout identity changes
  const logoutRef = useRef(logout);
  logoutRef.current = logout;

  useEffect(() => {
    if (!token) {
      disconnectSocket();
      setSocket(null);
      setConnected(false);
      return;
    }

    const s = connectSocket();
    setSocket(s);

    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    const onConnectError = (err: Error) => {
      if (err.message === 'Authentication required' || err.message === 'Invalid token') {
        logoutRef.current();
      }
    };

    s.on('connect', onConnect);
    s.on('disconnect', onDisconnect);
    s.on('connect_error', onConnectError);
    if (s.connected) setConnected(true);

    return () => {
      s.off('connect', onConnect);
      s.off('disconnect', onDisconnect);
      s.off('connect_error', onConnectError);
    };
  }, [token]);

  return (
    <SocketContext.Provider value={{ socket, connected }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}
