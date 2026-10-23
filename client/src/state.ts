// 클라이언트 공용 상태
import type { PublicProfile, Buff } from '../../shared/types.ts';

export interface ClientState {
  me: PublicProfile | null;
  myId: string | null;
  players: Map<string, { id: string; name: string; color: string; rod: string }>;
  records: Record<string, any>;
  buffs: Pick<Buff, 'id' | 'name' | 'icon' | 'desc' | 'until' | 'global' | 'food'>[];
  weather: { id: string; until: number };
  panelOpen: string | null;
  nearShop: boolean;
  pos: { x: number; y: number; z: number };
  stations: Map<string, any>;
  farms: Map<number, any>;
  cooking: boolean;
  tradeOpen?: boolean;
}

export const S: ClientState = {
  me: null, // 서버가 보낸 내 프로필
  myId: null,
  players: new Map(), // id -> meta {id,name,color,rod}
  records: {},
  buffs: [],
  weather: { id: 'clear', until: 0 },
  panelOpen: null, // 열린 패널 이름
  nearShop: false,
  pos: { x: 0, y: 0, z: 0 },
  stations: new Map(), // owner -> 조리대 데이터
  farms: new Map(), // 밭 번호 -> 텃밭 데이터
  cooking: false, // 요리 미니게임 중
};

export function itemCount(id) {
  return S.me?.items?.[id] || 0;
}
