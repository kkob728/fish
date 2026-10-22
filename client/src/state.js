// 클라이언트 공용 상태
export const S = {
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
  cooking: false, // 요리 미니게임 중
};

export function itemCount(id) {
  return S.me?.items?.[id] || 0;
}
