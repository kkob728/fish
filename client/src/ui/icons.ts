// 손그림 느낌의 SVG 아이콘 — 짙은 갈색 외곽선 + 단색 면. 이모지를 쓰지 않는다.
const L = '#3b2614';
const G = `stroke="${L}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"`;
const wrap = (inner) => `<svg viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">${inner}</svg>`;
// 굵은 외곽선이 있는 선(지렁이, 해초 등): 아래에 두꺼운 갈색, 위에 색
const line = (d, color, w = 4) => `<path d="${d}" fill="none" stroke="${L}" stroke-width="${w + 3}" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const shine = (x, y, r = 1.6) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity=".75"/>`;
const hookBadge = `<g transform="translate(19 17) scale(.42)"><circle cx="16" cy="16" r="14" fill="#f7ecd0" ${G}/>${line('M18 6v12a5 5 0 0 1-10 0v-2', '#9aa3ab', 3)}</g>`;

const ICONS = {
  // ---------- UI ----------
  coin: `<circle cx="16" cy="16" r="12" fill="#f2c14e" ${G}/><circle cx="16" cy="16" r="7.5" fill="none" stroke="#c8932a" stroke-width="2"/><path d="M16 11v10M13.5 13.5h4a1.8 1.8 0 0 1 0 3.5h-3a1.8 1.8 0 0 0 0 3.5h4" fill="none" stroke="#9a6a14" stroke-width="1.8" stroke-linecap="round"/>${shine(11, 10)}`,
  bag: `<path d="M11 11V8a5 5 0 0 1 10 0v3" fill="none" ${G}/><rect x="5" y="11" width="22" height="16" rx="4" fill="#c8803e" ${G}/><path d="M5 17h22" ${G}/><rect x="13" y="15" width="6" height="5" rx="1.5" fill="#f2c14e" ${G}/>`,
  hammer: `<path d="M8 26l11-11" fill="none" stroke="${L}" stroke-width="6" stroke-linecap="round"/><path d="M8 26l11-11" fill="none" stroke="#c08a52" stroke-width="3" stroke-linecap="round"/><path d="M15 9l5-5 8 8-5 5z" fill="#9aa3ab" ${G}/>${shine(19, 7, 1.2)}`,
  book: `<path d="M6 7a2 2 0 0 1 2-2h17v20H8a2 2 0 0 0-2 2z" fill="#4a86c5" ${G}/><path d="M6 27a2 2 0 0 1 2-2h17v2H8a2 2 0 0 1-2 0z" fill="#f7ecd0" ${G}/><path d="M12 11h8M12 15h6" stroke="#f7ecd0" stroke-width="2" stroke-linecap="round"/>`,
  trophy: `<path d="M10 5h12v6a6 6 0 0 1-12 0z" fill="#f2c14e" ${G}/><path d="M10 8H6a4 4 0 0 0 4 5M22 8h4a4 4 0 0 1-4 5" fill="none" ${G}/><path d="M16 17v5" ${G}/><rect x="10" y="22" width="12" height="5" rx="1.5" fill="#9a6232" ${G}/>${shine(13, 8)}`,
  help: `<circle cx="16" cy="16" r="12" fill="#7cbf55" ${G}/><path d="M12.5 12.5a3.5 3.5 0 1 1 5 3.2c-1 .5-1.5 1.2-1.5 2.3v.5" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round"/><circle cx="16" cy="22.5" r="1.6" fill="#fff"/>`,
  people: `<circle cx="11" cy="11" r="4" fill="#f2c79a" ${G}/><path d="M3 26a8 8 0 0 1 16 0z" fill="#4a86c5" ${G}/><circle cx="22" cy="12" r="3.5" fill="#f2c79a" ${G}/><path d="M17 26a6 7 0 0 1 12 0z" fill="#c8553d" ${G}/>`,
  sound: `<path d="M5 12h5l7-6v20l-7-6H5z" fill="#f7ecd0" ${G}/><path d="M21 11a6 6 0 0 1 0 10M24 7a11 11 0 0 1 0 18" fill="none" ${G}/>`,
  mute: `<path d="M5 12h5l7-6v20l-7-6H5z" fill="#d6bf8e" ${G}/><path d="M21 12l7 8M28 12l-7 8" fill="none" ${G}/>`,
  pin: `<path d="M16 29s9-9 9-16a9 9 0 0 0-18 0c0 7 9 16 9 16z" fill="#c8553d" ${G}/><circle cx="16" cy="13" r="3.5" fill="#f7ecd0" ${G}/>`,
  lock: `<path d="M11 14v-4a5 5 0 0 1 10 0v4" fill="none" ${G}/><rect x="7" y="14" width="18" height="13" rx="3" fill="#f2c14e" ${G}/><circle cx="16" cy="20" r="2" fill="${L}"/>`,
  star: `<path d="M16 4l3.6 7.4 8.1 1.1-5.9 5.7 1.4 8.1L16 22.5l-7.2 3.8 1.4-8.1-5.9-5.7 8.1-1.1z" fill="#f2c14e" ${G}/>`,
  starEmpty: `<path d="M16 4l3.6 7.4 8.1 1.1-5.9 5.7 1.4 8.1L16 22.5l-7.2 3.8 1.4-8.1-5.9-5.7 8.1-1.1z" fill="#e2d2a8" ${G}/>`,
  fish: `<path d="M4 16c4-6 12-8 18-4l5-4v16l-5-4c-6 4-14 2-18-4z" fill="#4a86c5" ${G}/><circle cx="10" cy="15" r="1.6" fill="${L}"/>${shine(14, 12)}`,
  rod: `${line('M5 27C12 18 20 10 28 4', '#c08a52', 3)}<circle cx="10" cy="22" r="3.2" fill="#9aa3ab" ${G}/><path d="M28 4v16" stroke="#7a8a96" stroke-width="1.4"/><circle cx="28" cy="21" r="2" fill="#c8553d" ${G}/>`,
  knife: `<path d="M5 25l14-14 4 4c-4 6-10 10-18 10z" fill="#d8dfe4" ${G}/><path d="M19 11l5-5a2.8 2.8 0 0 1 4 4l-5 5z" fill="#9a6232" ${G}/>`,
  trade: `<path d="M6 11h17l-4-4M26 21H9l4 4" fill="none" stroke="${L}" stroke-width="5.5" stroke-linecap="round" stroke-linejoin="round"/><path d="M6 11h17l-4-4M26 21H9l4 4" fill="none" stroke="#7cbf55" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/>`,
  close: `<path d="M9 9l14 14M23 9L9 23" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/>`,
  hook: `${line('M19 4v14a6 6 0 0 1-12 0v-3', '#9aa3ab', 3.2)}<path d="M7 15l3 2" stroke="${L}" stroke-width="2" stroke-linecap="round"/><circle cx="19" cy="4.5" r="2.4" fill="#f7ecd0" ${G}/>`,
  sparkle: `<path d="M16 3l2.5 9.5L28 16l-9.5 2.5L16 29l-2.5-10.5L3 16l10.5-3.5z" fill="#f2c14e" ${G}/>`,
  shop: `<path d="M5 13h22v14H5z" fill="#f7ecd0" ${G}/><path d="M3 13l3-7h20l3 7z" fill="#c8553d" ${G}/><path d="M9 6l-1 7M16 6v7M23 6l1 7" stroke="${L}" stroke-width="1.6"/><rect x="12" y="18" width="8" height="9" fill="#9a6232" ${G}/>`,
  // ---------- 시간/날씨 ----------
  sun: `<g ${G}><path d="M16 2v4M16 26v4M2 16h4M26 16h4M6 6l3 3M23 23l3 3M6 26l3-3M23 9l3-3" fill="none"/></g><circle cx="16" cy="16" r="7" fill="#f2c14e" ${G}/>`,
  moon: `<path d="M21 4a12 12 0 1 0 7 19A10 10 0 0 1 21 4z" fill="#e8e2c4" ${G}/><circle cx="14" cy="17" r="1.6" fill="#cfc6a0"/><circle cx="18" cy="23" r="1.2" fill="#cfc6a0"/>`,
  dawn: `<path d="M6 21a10 10 0 0 1 20 0z" fill="#f2a05a" ${G}/><path d="M3 21h26M16 5v4M7 10l2.5 2.5M25 10l-2.5 2.5" fill="none" ${G}/><path d="M8 26h16" ${G}/>`,
  cloud: `<path d="M9 24a5 5 0 0 1-.5-10 7 7 0 0 1 13.5-2 5.5 5.5 0 0 1 1 12z" fill="#f1f1ec" ${G}/>`,
  rain: `<path d="M9 19a5 5 0 0 1-.5-10 7 7 0 0 1 13.5-2 5.5 5.5 0 0 1 1 12z" fill="#c9d3dc" ${G}/><path d="M11 23l-1.5 4M17 23l-1.5 4M23 23l-1.5 4" fill="none" stroke="#4a86c5" stroke-width="2.4" stroke-linecap="round"/>`,
  fog: `<path d="M5 10c3-2 5 2 8 0s5 2 8 0 5 2 6 0M5 16c3-2 5 2 8 0s5 2 8 0 5 2 6 0M5 22c3-2 5 2 8 0s5 2 8 0 5 2 6 0" fill="none" stroke="${L}" stroke-width="5" stroke-linecap="round"/><path d="M5 10c3-2 5 2 8 0s5 2 8 0 5 2 6 0M5 16c3-2 5 2 8 0s5 2 8 0 5 2 6 0M5 22c3-2 5 2 8 0s5 2 8 0 5 2 6 0" fill="none" stroke="#dfe3e6" stroke-width="2.4" stroke-linecap="round"/>`,
  storm: `<path d="M9 18a5 5 0 0 1-.5-10 7 7 0 0 1 13.5-2 5.5 5.5 0 0 1 1 12z" fill="#8d97a3" ${G}/><path d="M17 15l-5 8h5l-3 7 8-10h-5l3-5z" fill="#f2d24e" ${G}/>`,
  // ---------- 버프 ----------
  leaf: `<path d="M6 26C6 13 13 6 27 5c0 13-7 21-21 21z" fill="#7cbf55" ${G}/><path d="M6 26L19 13" fill="none" ${G}/>`,
  flame: `<path d="M16 3c2 6 9 8 9 16a9 9 0 0 1-18 0c0-5 3-7 4-11 1 3 2 4 3 4 0-4 0-6 2-9z" fill="#f07a2a" ${G}/><path d="M16 17c2 3 4 4 4 7a4 4 0 0 1-8 0c0-2 2-4 4-7z" fill="#f2d24e"/>`,
  bolt: `<path d="M18 2L7 18h7l-3 12 13-17h-7l3-11z" fill="#f2d24e" ${G}/>`,
  gem: `<path d="M9 5h14l5 7-12 15L4 12z" fill="#7fd6f0" ${G}/><path d="M4 12h24M12 5l-2 7 6 15 6-15-2-7" fill="none" stroke="${L}" stroke-width="1.4"/>`,
  vase: `<path d="M12 4h8v3c0 2 5 5 5 11a9 9 0 0 1-18 0c0-6 5-9 5-11z" fill="#7ec8a8" ${G}/><path d="M10 17c2-2 4 2 6 0s4 2 6 0" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/>`,
  galaxy: `<circle cx="16" cy="16" r="12" fill="#5a3a9a" ${G}/><path d="M9 13c3-5 13-4 14 2s-10 7-12 2 6-6 8-2" fill="none" stroke="#e0b8ff" stroke-width="2" stroke-linecap="round"/><circle cx="23" cy="9" r="1.2" fill="#fff"/><circle cx="9" cy="22" r="1" fill="#fff"/>`,
  // ---------- 재료 ----------
  worm: line('M5 22c3-6 6 2 9-4s6 2 9-4 3-2 4-1', '#e88a9a', 4.5),
  grub: `<path d="M22 8a9 9 0 1 0 2 12" fill="none" stroke="${L}" stroke-width="10" stroke-linecap="round"/><path d="M22 8a9 9 0 1 0 2 12" fill="none" stroke="#f3e2c0" stroke-width="7" stroke-linecap="round"/><path d="M12 10l2 3M9 15l3 1M10 21l3-1M15 24l1-3" stroke="#c9a874" stroke-width="1.6"/><circle cx="23" cy="8" r="3.6" fill="#c8803e" ${G}/>`,
  cricket: `<path d="M7 20c2-6 10-9 17-6 2 1 3 4 1 5-5 3-13 4-18 1z" fill="#7a9a3a" ${G}/><circle cx="24" cy="15" r="3" fill="#5a7a2a" ${G}/><path d="M12 20l-4 6M15 21l1 6M10 15L5 9M24 13l3-8M26 13l4-6" fill="none" ${G}/>`,
  berry: `<g ${G} fill="#d8354a"><circle cx="12" cy="16" r="4.5"/><circle cx="20" cy="16" r="4.5"/><circle cx="16" cy="22" r="4.5"/><circle cx="16" cy="11" r="4"/></g><path d="M16 7c-2-3-5-3-6-2M16 7c2-3 5-3 6-2" fill="#5a9a3a" ${G}/>${shine(14, 14, 1.2)}`,
  clam: `<path d="M4 20a12 12 0 0 1 24 0l-3 4H7z" fill="#f0d8c0" ${G}/><path d="M16 9v15M10 11l3 13M22 11l-3 13M6 16l4 8M26 16l-4 8" fill="none" stroke="#c8a080" stroke-width="1.5"/>`,
  shrimp: `<path d="M24 8c-9-2-17 4-17 12 0 4 3 6 6 6 1-4 4-5 7-5 4 0 7-4 4-13z" fill="#f08a5a" ${G}/><path d="M7 20l-4 4 5 0M13 12c2 2 3 5 2 8M18 10c2 2 3 5 2 8" fill="none" ${G}/><path d="M24 8c3-2 5-2 6-1M24 9c2 0 4 1 5 3" fill="none" stroke="${L}" stroke-width="1.4"/><circle cx="21" cy="11" r="1.2" fill="${L}"/>`,
  seaweed: `${line('M10 28c-3-5 3-8 0-13s2-8 0-11', '#3f8a4a', 4)}${line('M18 28c3-5-3-9 1-14s-1-7 2-10', '#5aa85a', 4)}${line('M24 28c-2-4 2-6 0-10', '#3f8a4a', 3.5)}`,
  mushroom: `<path d="M13 17h6l1 10h-8z" fill="#f3e8d2" ${G}/><path d="M4 17a12 10 0 0 1 24 0z" fill="#a04a8a" ${G}/><circle cx="11" cy="12" r="1.8" fill="#f7ecd0"/><circle cx="19" cy="10" r="1.4" fill="#f7ecd0"/><circle cx="22" cy="14" r="1.2" fill="#f7ecd0"/>`,
  firefly: `<circle cx="18" cy="17" r="9" fill="#f6f08a" opacity=".55"/><ellipse cx="14" cy="14" rx="6" ry="3.5" fill="#5a4a3a" ${G} transform="rotate(-30 14 14)"/><circle cx="19" cy="18" r="4" fill="#d8f05a" ${G}/><path d="M9 9l-3-3M12 8l-1-4" fill="none" ${G}/>`,
  moss: `<path d="M4 24c0-6 5-10 12-10s12 4 12 10z" fill="#9a958a" ${G}/><path d="M6 17c1-4 4-5 6-4 1-3 5-4 7-2 2-1 6 0 7 4-2 2-6 1-10 2s-8 2-10 0z" fill="#6aa84f" ${G}/>`,
  sulfur: `<path d="M8 26l3-12 4 12zM14 26l4-17 5 17zM21 26l3-9 3 9z" fill="#f2d84a" ${G}/><path d="M5 26h24" ${G}/>`,
  flour: `<path d="M9 9c-3 5-4 12-2 17h18c2-5 1-12-2-17z" fill="#f3ead6" ${G}/><path d="M9 9c3-2 11-2 14 0l-2-4H11z" fill="#d8c8a0" ${G}/><path d="M16 14v8M13 16c1 1 2 2 3 2M19 16c-1 1-2 2-3 2" fill="none" stroke="#c8a85a" stroke-width="1.6" stroke-linecap="round"/>`,
  corn: `<path d="M16 3c5 3 6 11 4 19l-4 3-4-3c-2-8-1-16 4-19z" fill="#f2c94e" ${G}/><path d="M16 6v17M13 9h6M12.5 13h7M12.5 17h7" stroke="#c8932a" stroke-width="1.3"/><path d="M10 28c-2-6-1-11 4-14M22 28c2-6 1-11-4-14" fill="#7cbf55" ${G}/>`,
  crumbs: `<path d="M5 18c0-5 5-9 11-9s11 4 11 9v6H5z" fill="#d89a52" ${G}/><path d="M10 13l2 4M16 11l1 5M22 13l-1 4" fill="none" stroke="#a86a32" stroke-width="1.6" stroke-linecap="round"/><circle cx="8" cy="27" r="1.4" fill="#d89a52" ${G}/><circle cx="24" cy="27" r="1.2" fill="#d89a52" ${G}/>`,
  fishmeat: `<path d="M5 14c3-6 15-8 22-3 2 4 0 11-6 13-7 2-15 0-16-10z" fill="#f08a8a" ${G}/><path d="M9 15c4-2 9-2 14 1M10 19c4-1 8-1 11 1" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round" opacity=".85"/>`,
  scale: `<path d="M16 4C9 9 6 15 6 20a10 8 0 0 0 20 0c0-5-3-11-10-16z" fill="#a8c8d8" ${G}/><path d="M11 18a5 5 0 0 1 10 0" fill="none" stroke="#7aa0b8" stroke-width="1.6"/>${shine(13, 12)}`,
  guts: `<path d="M8 12c2-6 10-7 13-3 5-1 8 4 6 8 2 4-2 9-7 7-3 4-10 3-11-2-5 0-6-7-1-10z" fill="#a8364a" ${G}/><path d="M13 14c2 2 5 2 7 0M12 20c3 1 6 1 8-1" fill="none" stroke="#7a2032" stroke-width="1.6" stroke-linecap="round"/>`,
  shinyscale: `<path d="M16 4C9 9 6 15 6 20a10 8 0 0 0 20 0c0-5-3-11-10-16z" fill="#7fe8f0" ${G}/><path d="M24 3l1 3 3 1-3 1-1 3-1-3-3-1 3-1z" fill="#fff" ${G}/>${shine(12, 13, 2)}`,
  // ---------- 미끼 ----------
  paste: `<circle cx="15" cy="17" r="10" fill="#a87442" ${G}/><circle cx="11" cy="14" r="1.4" fill="#d8a870"/><circle cx="18" cy="20" r="1.2" fill="#d8a870"/><circle cx="19" cy="13" r="1" fill="#d8a870"/>${shine(11, 11, 1.8)}`,
  berryball: `<circle cx="15" cy="17" r="10" fill="#e87a9a" ${G}/><circle cx="12" cy="15" r="1.2" fill="#fff"/><circle cx="18" cy="19" r="1.2" fill="#fff"/><circle cx="17" cy="13" r="1" fill="#fff"/>`,
  chum: `<circle cx="15" cy="19" r="9" fill="#6a5a3a" ${G}/><path d="M10 7c1-2-1-3 0-5M15 8c1-2-1-3 0-5M20 7c1-2-1-3 0-5" fill="none" stroke="#8a9a3a" stroke-width="2" stroke-linecap="round"/><path d="M11 18l3 2M17 21l2-3" stroke="#a8986a" stroke-width="1.6" stroke-linecap="round"/>`,
  lure: `<path d="M5 16c5-6 13-7 19-3l4-3v12l-4-3c-6 4-14 3-19-3z" fill="#f2d24e" ${G}/><circle cx="10" cy="15" r="1.6" fill="${L}"/><circle cx="17" cy="16" r="6" fill="#fff6a0" opacity=".45"/>`,
  spore: `<circle cx="15" cy="17" r="10" fill="#8a5aa8" ${G}/><circle cx="11" cy="14" r="1.6" fill="#e0c8f0"/><circle cx="18" cy="20" r="1.4" fill="#e0c8f0"/><circle cx="19" cy="12" r="1.2" fill="#e0c8f0"/>`,
  sulfurball: `<circle cx="15" cy="17" r="10" fill="#e8c83a" ${G}/><path d="M10 15l3 2M16 20l3-1M17 12l2 1" stroke="#a8862a" stroke-width="1.6" stroke-linecap="round"/>${shine(11, 12, 1.8)}`,
  spoon: `<path d="M8 10c2-6 10-6 12 0 2 6-2 13-6 13s-8-7-6-13z" fill="#d8dfe4" ${G} transform="rotate(-25 14 14)"/><path d="M18 22l7 4" ${G}/>${shine(11, 10, 2)}`,
  drumstick: `<path d="M17 6c6-2 11 3 9 9-1 4-6 6-10 4l-5 5a3 3 0 1 1-3-3 3 3 0 1 1 1-3l5-5c-2-3 0-6 3-7z" fill="#c87a3a" ${G}/>${shine(21, 10, 1.8)}`,
  bulb: `<path d="M8 28c0-8 2-14 8-18" fill="none" ${G}/><circle cx="20" cy="9" r="8" fill="#60ffd0" opacity=".35"/><circle cx="20" cy="9" r="4.5" fill="#a8fff0" ${G}/>`,
  swirl: `<circle cx="15" cy="17" r="10" fill="#6a3a9a" ${G}/><path d="M15 17a2 2 0 1 1 2 2 4 4 0 1 1-4-4 6 6 0 1 1 6 6" fill="none" stroke="#e0b8ff" stroke-width="1.8" stroke-linecap="round"/>`,
  net: `${line('M20 18L29 29', '#c08a52', 3)}<ellipse cx="13" cy="12" rx="9" ry="8" fill="#e8f2f4" ${G}/><path d="M6 9l14 7M8 15l12-8M10 5l6 14M16 4l-4 15" stroke="#7aa0b8" stroke-width="1.2"/><ellipse cx="13" cy="12" rx="9" ry="8" fill="none" ${G}/>`,
  calmbait: `<circle cx="15" cy="18" r="9" fill="#a8d888" ${G}/><path d="M15 9c0-4 3-6 7-6-1 4-3 6-7 6z" fill="#5a9a3a" ${G}/><path d="M11 17h0M18 20h0" stroke="#5a8a3a" stroke-width="3" stroke-linecap="round"/>`,
  bigfloat: `<path d="M16 3v6" ${G}/><path d="M8 16a8 8 0 0 1 16 0z" fill="#e8352a" ${G}/><path d="M8 16a8 8 0 0 0 16 0z" fill="#f7f2ea" ${G}/><path d="M16 24v5" ${G}/>${shine(12, 12, 1.6)}`,
  spool: `<rect x="7" y="5" width="18" height="4" rx="1.5" fill="#9a6232" ${G}/><rect x="7" y="23" width="18" height="4" rx="1.5" fill="#9a6232" ${G}/><rect x="10" y="9" width="12" height="14" fill="#7fd6f0" ${G}/><path d="M10 12h12M10 15h12M10 18h12M10 21h12" stroke="#4a9ab8" stroke-width="1.3"/>`,
  // ---------- 요리 ----------
  board: `<rect x="4" y="9" width="24" height="15" rx="3" fill="#d8a868" ${G}/><circle cx="24" cy="13" r="1.6" fill="${L}"/><path d="M8 19h12" stroke="#b8884a" stroke-width="1.6" stroke-linecap="round"/><path d="M14 4l8 10-2 1.5-8-10z" fill="#d8dfe4" ${G}/>`,
  grill: `<rect x="5" y="12" width="22" height="12" rx="2" fill="#4a4040" ${G}/><path d="M9 12v12M14 12v12M19 12v12M24 12v12" stroke="#8a8080" stroke-width="1.6"/><path d="M9 28l2-4M23 28l-2-4" ${G}/><path d="M11 9c1-2-1-3 0-5M17 9c1-2-1-3 0-5M23 9c1-2-1-3 0-5" fill="none" stroke="#aab" stroke-width="1.6" stroke-linecap="round"/>`,
  pot: `<path d="M5 13h22v9a6 6 0 0 1-6 6H11a6 6 0 0 1-6-6z" fill="#9aa3ab" ${G}/><path d="M3 13h26" ${G}/><path d="M12 8c1-2-1-3 0-5M17 8c1-2-1-3 0-5M22 8c1-2-1-3 0-5" fill="none" stroke="#aab" stroke-width="1.6" stroke-linecap="round"/><path d="M8 18h16" stroke="#c8d0d8" stroke-width="1.6"/>`,
  fryer: `<path d="M6 12h20l-2 14H8z" fill="#5a5a60" ${G}/><path d="M7 15h18" stroke="#f2c14e" stroke-width="3"/><circle cx="12" cy="10" r="1.6" fill="#f2c14e"/><circle cx="18" cy="8" r="1.3" fill="#f2c14e"/><path d="M26 14l4-3" ${G}/>`,
  dishBoard: `<ellipse cx="16" cy="20" rx="13" ry="6" fill="#f4f1e8" ${G}/><path d="M8 17c3-3 6-3 8 0M13 15c3-3 6-3 8 0M18 17c2-2 4-2 6 0" fill="#f08a7a" ${G}/><circle cx="9" cy="21" r="1.6" fill="#7cbf55"/>`,
  dishGrill: `<ellipse cx="16" cy="21" rx="13" ry="6" fill="#f4f1e8" ${G}/><path d="M6 18c4-5 12-6 17-3l4-3v10l-4-3c-5 3-13 2-17-1z" fill="#c8823a" ${G}/><path d="M11 15l2 4M15 14l2 4M19 14l2 4" stroke="#7a4a1a" stroke-width="1.5"/>`,
  dishPot: `<path d="M4 15h24a12 9 0 0 1-24 0z" fill="#e8743a" ${G}/><ellipse cx="16" cy="15" rx="12" ry="3" fill="#f2a05a" ${G}/><path d="M11 10c1-2-1-3 0-5M17 10c1-2-1-3 0-5M22 10c1-2-1-3 0-5" fill="none" stroke="#aab" stroke-width="1.6" stroke-linecap="round"/><circle cx="12" cy="15" r="1.4" fill="#7cbf55"/>`,
  dishFryer: `<ellipse cx="16" cy="22" rx="13" ry="5" fill="#f4f1e8" ${G}/><path d="M7 19c0-5 5-7 8-5 2-3 8-2 9 2 2 1 2 4 0 5H8c-1 0-1-1-1-2z" fill="#e8b84a" ${G}/><path d="M11 16l1 2M16 15l1 2M20 16l1 2" stroke="#b8862a" stroke-width="1.4"/>`,
  station: `<rect x="4" y="14" width="24" height="4" rx="1" fill="#c08a52" ${G}/><path d="M7 18v9M25 18v9" ${G}/><path d="M9 14V9h8v5" fill="#9aa3ab" ${G}/><path d="M19 14v-3h7v3" fill="#4a4040" ${G}/><path d="M11 6c1-2-1-3 0-4" fill="none" stroke="#aab" stroke-width="1.6" stroke-linecap="round"/>`,
  lantern: `<path d="M13 4h6M16 4v3" ${G}/><rect x="9" y="7" width="14" height="20" rx="6" fill="#d8354a" ${G}/><path d="M9 12h14M9 22h14" stroke="#f2c14e" stroke-width="2"/><rect x="13" y="13" width="6" height="8" rx="2" fill="#f6f08a"/>`,
};

// 아이템 id → 아이콘 이름 (미끼는 낚싯바늘 배지)
const ITEM_ICON = {
  worm: 'worm', grub: 'grub', cricket: 'cricket', berry: 'berry', clam: 'clam', shrimp: 'shrimp', seaweed: 'seaweed',
  mushroom: 'mushroom', firefly: 'firefly', moss: 'moss', sulfur: 'sulfur', flour: 'flour', corn: 'corn', crumbs: 'crumbs',
  fishmeat: 'fishmeat', scale: 'scale', guts: 'guts', shinyscale: 'shinyscale',
  worm_bait: ['worm', 1], paste: ['paste', 1], insect_bait: ['cricket', 1], berry_ball: ['berryball', 1], shrimp_bait: ['shrimp', 1],
  shell_bait: ['clam', 1], cut_bait: ['fishmeat', 1], chum: ['chum', 0], firefly_lure: ['lure', 0], spore_bait: ['spore', 1],
  sulfur_bait: ['sulfurball', 1], silver_spoon: ['spoon', 0], big_meat: ['drumstick', 1], abyss_lure: ['bulb', 0],
  odd_bait: ['swirl', 1], myth_lure: ['lantern', 0],
  landing_net: 'net', calm_bait: 'calmbait', big_float: 'bigfloat', tough_line: 'spool',
};
export const DISH_ICON = { board: 'dishBoard', grill: 'dishGrill', pot: 'dishPot', fryer: 'dishFryer' };
const FOOD_ICON_COLOR = {
  rice: '#f4f1e8', radish: '#f0f0e0', greenonion: '#7cbf55', garlic: '#f0e8d8', chili: '#d8354a', soy: '#4a2a1a', doenjang: '#a8742a',
  oil: '#f2d24e', lemon: '#f2e04e', vinegar: '#e8d8b8', gim: '#2a3a2a', potato: '#c8a060', tofu: '#f8f4ea', egg: '#f8f0e0', sugar: '#ffffff',
};
// 식재료 아이콘: 이름 첫 글자를 넣은 둥근 라벨 (색은 재료별)
function foodSvg(id, label) {
  const c = FOOD_ICON_COLOR[id] || '#e8d8b0';
  const dark = ['soy', 'gim', 'chili', 'doenjang'].includes(id);
  return `<rect x="5" y="5" width="22" height="22" rx="8" fill="${c}" ${G}/><text x="16" y="21" text-anchor="middle" font-family="Jua, sans-serif" font-size="12" fill="${dark ? '#fff6dc' : L}">${label}</text>`;
}
export const BUFF_ICON = { food: 'dishPot', gather: 'leaf', moonblessing: 'moon', fire: 'flame', calm: 'fog', thrill: 'bolt', clearwater: 'gem', artisan: 'vase', starblessing: 'galaxy' };
export const WEATHER_ICON = { clear: 'sun', cloudy: 'cloud', rain: 'rain', fog: 'fog', storm: 'storm' };
export const PHASE_ICON = { dawn: 'dawn', day: 'sun', dusk: 'dawn', night: 'moon' };

const FOOD_LABEL = { rice: '쌀', radish: '무', greenonion: '파', garlic: '늘', chili: '고', soy: '간', doenjang: '된', oil: '유', lemon: '레', vinegar: '초', gim: '김', potato: '감', tofu: '두', egg: '란', sugar: '당' };

function gemSvg(color) {
  return `<path d="M9 5h14l5 7-12 15L4 12z" fill="${color}" ${G}/><path d="M4 12h24M12 5l-2 7 6 15 6-15-2-7" fill="none" stroke="${L}" stroke-width="1.4"/>${shine(12, 9, 1.4)}`;
}

export function svg(name) {
  return wrap(ICONS[name] || ICONS.sparkle);
}

export function itemSvg(id: string | null, essenceColor?: string) {
  if (!id) return svg('hook');
  if (id.startsWith('ess_')) return wrap(gemSvg(essenceColor || '#c78bff'));
  if (FOOD_ICON_COLOR[id]) return wrap(foodSvg(id, FOOD_LABEL[id]));
  const m = ITEM_ICON[id];
  if (!m) return svg('sparkle');
  if (Array.isArray(m)) return wrap(ICONS[m[0]] + (m[1] ? hookBadge : ''));
  return svg(m);
}

// DOM 요소로
export function ic(name, cls = '') {
  const s = document.createElement('span');
  s.className = `ico ${cls}`;
  s.innerHTML = svg(name);
  return s;
}
export function itemIc(id: string | null, cls = "", essenceColor?: string) {
  const s = document.createElement('span');
  s.className = `ico ${cls}`;
  s.innerHTML = itemSvg(id, essenceColor);
  return s;
}
