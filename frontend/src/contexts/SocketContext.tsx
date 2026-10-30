import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Socket } from 'socket.io-client';
import { useAuth } from './AuthContext';
import { getSocket, connectSocket, disconnectSocket } from '@/services/socket';

interface SocketContextValue {
  socket: Socket | null;
  isConnected: boolean;
  reconnect: () => void;
}

const SocketContext = createContext<SocketContextValue>({
  socket: null,
  isConnected: false,
  reconnect: () => {},
});

export function SocketProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated, token } = useAuth();
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [activeSocket, setActiveSocket] = useState<Socket | null>(null);

  useEffect(() => {
    if (isAuthenticated && token) {
      const s = connectSocket(token);
      setActiveSocket(s);
      setIsConnected(s.connected);

      const handleConnect = () => setIsConnected(true);
      const handleDisconnect = () => setIsConnected(false);

      s.on('connect', handleConnect);
      s.on('disconnect', handleDisconnect);

      return () => {
        s.off('connect', handleConnect);
        s.off('disconnect', handleDisconnect);
      };
    } else {
      disconnectSocket();
      setActiveSocket(null);
      setIsConnected(false);
    }
  }, [isAuthenticated, token]);

  const reconnect = () => {
    if (token) {
      const s = connectSocket(token);
      setActiveSocket(s);
      setIsConnected(s.connected);
    }
  };

  return (
    <SocketContext.Provider value={{ socket: activeSocket, isConnected, reconnect }}>
      {children}
    </SocketContext.Provider>
  );
}

export function useSocket(): SocketContextValue {
  return useContext(SocketContext);
}
