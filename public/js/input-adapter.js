// بسيط: يحتفظ بحالة الأزرار لكل لاعب ويعرض واجهة poll للمحاكي
const MAX_PLAYERS = 4;
const BUTTONS = ["up","down","left","right","a","b","x","y","start","select","l1","r1","l2","r2","l3","r3"];

const playerState = new Map();
for (let i = 1; i <= MAX_PLAYERS; i++) playerState.set(i, new Set());

function makeEmptyMask() {
  const mask = {};
  for (const b of BUTTONS) mask[b] = false;
  return mask;
}

window.addEventListener("remote-game-input", e => {
  const ev = e.detail;
  const p = Number(ev.player);
  if (!playerState.has(p)) return;
  const set = playerState.get(p);
  if (ev.pressed) set.add(ev.button);
  else set.delete(ev.button);
});

export function getControllerState(player) {
  const set = playerState.get(player);
  if (!set) return makeEmptyMask();
  const mask = makeEmptyMask();
  for (const b of set) {
    if (b in mask) mask[b] = true;
  }
  return mask;
}

export function releaseAll() {
  for (const s of playerState.values()) s.clear();
}

let pollInterval = null;
export function startAutoPoll(sendToCoreWithState, fps = 60) {
  stopAutoPoll();
  const ms = Math.round(1000 / fps);
  pollInterval = setInterval(() => {
    for (let p = 1; p <= MAX_PLAYERS; p++) {
      const state = getControllerState(p);
      sendToCoreWithState(p, state);
    }
  }, ms);
}
export function stopAutoPoll() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}
