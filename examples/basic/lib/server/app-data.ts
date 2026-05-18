export type ServiceStatus = {
  ok: true;
  ts: string;
};

export type UserPublicRecord = {
  id: string;
};

export function getServiceStatus(): ServiceStatus {
  return { ok: true, ts: new Date().toISOString() };
}

export function getUserPublicRecord(userId: string): UserPublicRecord {
  const id = userId.trim();

  return { id: id.length > 0 ? id : "anonymous" };
}
