import { useEffect, useRef } from 'react';
import { io, Socket } from 'socket.io-client';
import { SOCKET_URL } from '../constants/config';
import { useAuthStore } from '../store/authStore';

export function useRecruitmentSocket(onUpdate: () => void) {
  const token = useAuthStore((s) => s.token);
  const ref = useRef(onUpdate);
  ref.current = onUpdate;

  useEffect(() => {
    if (!token) return;
    const socket: Socket = io(SOCKET_URL, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    const handler = () => ref.current();
    socket.on('request:updated', handler);
    return () => {
      socket.off('request:updated', handler);
      socket.disconnect();
    };
  }, [token]);
}
