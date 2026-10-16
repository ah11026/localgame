const socket = io();
const params = new URLSearchParams(location.search);
const code = params.get("room");

const status = document.querySelector("#status");
const pad = document.querySelector("#pad");
const join = document.querySelector("#join");
const pressed = new Set();

let joined = false;
let currentToken = null;

function storageKeyFor(roomCode) {
  return `airplay:room:${roomCode}:token`;
}

function saveToken(code, token) {
  try {
    localStorage.setItem(storageKeyFor(code), token);
  } catch (e) { /* ignore */ }
}

function loadToken(code) {
  try {
    return localStorage.getItem(storageKeyFor(code));
  } catch (e) { return null; }
}

function clearToken(code) {
  try { localStorage.removeItem(storageKeyFor(code)); } catch (e) {}
}

function send(button, down) {
  if (!joined) return;

  if (down) pressed.add(button);
  else pressed.delete(button);

  socket.emit("input", { button, pressed: down });
}

function releaseAll() {
  for (const button of [...pressed]) send(button, false);
}

async function attemptJoin(name, tokenArg, isAuto = false) {
  if (!code) {
    status.textContent = "رابط الغرفة غير صالح";
    return;
  }

  if (!socket.connected) {
    status.textContent = "جارٍ الاتصال بالخادم...";
    return;
  }

  status.textContent = isAuto ? "محاول إعادة الربط..." : "جارٍ الانضمام...";
  socket.emit("room:join", {
    code,
    name,
    token: tokenArg
  }, result => {
    if (!result?.ok) {
      status.textContent = result?.error ?? "تعذر الانضمام";
      if (isAuto) {
        clearToken(code);
      }
      return;
    }

    joined = true;
    currentToken = result.token;
    saveToken(code, currentToken);

    join.style.display = "none";
    pad.style.display = "flex";
    document.querySelector("#playerLabel").textContent =
      `اللاعب ${result.player}`;

    status.textContent = result.reconnected ? "تمت إعادة الربط تلقائياً" : "تم الانضمام";
  });
}

document.querySelector("#joinButton").addEventListener("click", () => {
  if (!code) {
    status.textContent = "رابط الغرفة غير صالح";
    return;
  }

  const nameInput = document.querySelector("#name").value;
  const stored = loadToken(code);
  const tokenToSend = stored ?? undefined;
  attemptJoin(nameInput, tokenToSend, !!stored);
});

document.querySelectorAll("[data-button]").forEach(button => {
  const name = button.dataset.button;

  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    send(name, true);
  });

  const release = event => {
    event.preventDefault();
    send(name, false);
  };

  button.addEventListener("pointerup", release);
  button.addEventListener("pointercancel", release);
  button.addEventListener("lostpointercapture", () => send(name, false));
});

window.addEventListener("blur", releaseAll);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) releaseAll();
});

socket.on("connect", () => {
  status.textContent = "متصل بالخادم";
  if (!joined && code) {
    const stored = loadToken(code);
    if (stored) {
      attemptJoin(document.querySelector("#name").value, stored, true);
    }
  }
});

socket.on("disconnect", () => {
  releaseAll();
  joined = false;
  pad.style.display = "none";
  join.style.display = "block";
  status.textContent = "انقطع الاتصال؛ أعد الاتصال تلقائياً عند توفر الشبكة.";
});

socket.on("room:closed", () => {
  releaseAll();
  joined = false;
  pad.style.display = "none";
  join.style.display = "block";
  status.textContent = "أغلق المضيف الغرفة.";
  if (code) clearToken(code);
});
