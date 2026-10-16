const socket = io();
const qr = document.querySelector("#qr");
const roomCode = document.querySelector("#roomCode");
const players = document.querySelector("#players");
const gameStatus = document.querySelector("#gameStatus");

async function loadGameCatalog() {
  try {
    const response = await fetch("/games/manifest.json");
    if (!response.ok) return [];
    const data = await response.json();
    return Array.isArray(data.games) ? data.games : [];
  } catch {
    return [];
  }
}

async function checkGameAvailability(gamePath) {
  try {
    const response = await fetch(gamePath, { method: "HEAD" });
    return response.ok;
  } catch {
    return false;
  }
}

let games = [];
loadGameCatalog().then((items) => {
  games = items;

  document.querySelectorAll("[data-game]").forEach((button) => {
    const gameId = button.dataset.game;
    const game = games.find((entry) => entry.id === gameId || entry.slug === gameId);

    if (!game) {
      button.disabled = true;
      button.title = "غير مفعّل في هذا النشر";
      return;
    }

    button.disabled = false;
    button.title = game.name || gameId;
  });

  if (!games.length) {
    gameStatus.textContent = "لا توجد ألعاب مفعلة في هذا النشر. أضف manifest + ROMs قبل التشغيل.";
  }
});

socket.on("connect", () => {
  socket.emit("room:create", async (result) => {
    if (!result?.ok) {
      gameStatus.textContent = "تعذر إنشاء الغرفة";
      return;
    }

    roomCode.textContent = result.code;

    try {
      const response = await fetch(`/api/rooms/${result.code}/qr`);
      if (!response.ok) throw new Error("QR request failed");

      const data = await response.json();
      qr.src = data.qr;
    } catch {
      gameStatus.textContent = "تعذر إنشاء QR؛ تحقق من إعداد عنوان الخادم.";
    }
  });
});

socket.on("room:state", (state) => {
  players.replaceChildren();

  for (const player of state.players) {
    const item = document.createElement("span");
    item.className = "player";
    item.textContent = `P${player.player} · ${player.name}${player.connected ? "" : " (غير متصل - بانتظار)"}`;
    players.append(item);
  }
});

socket.on("game:input", (event) => {
  window.dispatchEvent(new CustomEvent("remote-game-input", { detail: event }));
});

socket.on("room:closed", () => {
  gameStatus.textContent = "أُغلقت الغرفة";
});

document.querySelectorAll("[data-game]").forEach((button) => {
  button.addEventListener("click", async () => {
    const gameId = button.dataset.game;
    const game = games.find((entry) => entry.id === gameId || entry.slug === gameId);

    if (!game || !game.path) {
      gameStatus.textContent = "هذه اللعبة غير مفعّلة في هذا النشر.";
      return;
    }

    const exists = await checkGameAvailability(game.path);
    if (!exists) {
      gameStatus.textContent = `ملف اللعبة غير موجود: ${game.path}. أضف الملف أو حدّث manifest.`;
      return;
    }

    const params = new URLSearchParams({
      core: game.core || "psx",
      game: game.path
    });

    window.location.href = `/emulator/index.html?${params.toString()}`;
  });
});
