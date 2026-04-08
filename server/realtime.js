let ioSingleton;

export function setIo(io) {
  ioSingleton = io;
}

export function getIo() {
  return ioSingleton;
}

export function emitToUsers(userIds, event, payload) {
  const io = ioSingleton;
  if (!io || !userIds?.length) return;
  const set = new Set(userIds.filter(Boolean));
  set.forEach((id) => {
    io.to(`user:${id}`).emit(event, payload);
  });
}
