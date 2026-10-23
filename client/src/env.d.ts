/// <reference types="vite/client" />

// 개발용 디버그 핸들
interface Window {
  __game?: any;
  __timeShift?: number;
  webkitAudioContext?: typeof AudioContext;
}
