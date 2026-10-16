const socket = io();
const qr = document.querySelector("#qr");
const roomCode = document.querySelector("#roomCode");
const players = document.querySelector("#players");
const gameStatus = document.querySelector("#gameStatus");

socket.on("connect", () => {
  socket.emit("room:create", async result => {
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
      gameStatus.textContent =
        "تعذر إنشاء QR؛ تحقق من إعداد عنوان الخادم.";
    }
  });
});

socket.on("room:state", state => {
  players.replaceChildren();

  for (const player of state.players) {
    const item = document.createElement("span");
    item.className = "player";
    item.textContent = `P${player.player} · ${player.name} ${player.connected ? "" : " (غير متصل - بانتظار)"} `;
    players.append(item);
  }
});

socket.on("game:input", event => {
  window.dispatchEvent(
    new CustomEvent("remote-game-input", { detail: event })
  );
});

socket.on("room:closed", () => {
  gameStatus.textContent = "أُغلقت الغرفة";
});

document.querySelectorAll("[data-game]").forEach(button => {
  button.addEventListener("click", () => {
    gameStatus.textContent =
      `تم اختيار ${button.dataset.game}؛ اربط الاختيار بملف اللعبة المصرح به.`;
  });
});
