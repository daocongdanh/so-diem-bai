(() => {
  "use strict";

  const STORAGE_KEY = "so-bai-simple-v1";
  const OLD_STORAGE_KEY = "so-bai-v1";
  const list = document.getElementById("players");
  const dialog = document.getElementById("player-dialog");
  const form = document.getElementById("player-form");
  const nameInput = document.getElementById("player-name");
  const nameError = document.getElementById("name-error");
  const status = document.getElementById("save-status");
  const formatter = new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 });
  let players = [];
  let storageWarning = "";

  function validPlayers(value) {
    return Array.isArray(value) && value.every((person) =>
      person && typeof person.id === "string" &&
      typeof person.name === "string" && person.name.trim() &&
      person.name.length <= 40 && Number.isSafeInteger(person.score)
    ) && new Set(value.map((person) => person.id)).size === value.length;
  }

  // Đọc localStorage ngay khi mở trang; giữ cả dữ liệu từ phiên bản trước.
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      const data = JSON.parse(saved);
      if (!validPlayers(data)) throw new Error("Invalid saved data");
      players = data.map(({ id, name, score }) => ({ id, name, score }));
    } else {
      const old = JSON.parse(localStorage.getItem(OLD_STORAGE_KEY) || "null");
      if (old && Array.isArray(old.players) && Array.isArray(old.rounds)) {
        const migrated = old.players.map((person) => ({
          id: person.id,
          name: person.name,
          score: old.rounds.reduce((sum, round) => sum + (round.scores?.[person.id] ?? 0), 0),
        }));
        if (!validPlayers(migrated)) throw new Error("Invalid old data");
        players = migrated;
      }
    }
  } catch {
    storageWarning = "Chưa đọc được dữ liệu đã lưu";
  }

  function showStatus(message, warning = false) {
    status.textContent = message;
    status.classList.toggle("warning", warning);
  }

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(players));
      storageWarning = "";
      showStatus("Đã lưu trên thiết bị");
    } catch {
      storageWarning = "Chưa lưu được, đừng đóng trang";
      showStatus(storageWarning, true);
    }
  }

  function clearAll() {
    if (!window.confirm("Xóa tất cả người chơi và điểm đã lưu? Thao tác này không thể hoàn tác.")) return;
    try {
      // Xóa cả khóa cũ để dữ liệu cũ không được khôi phục khi tải lại trang.
      localStorage.removeItem(OLD_STORAGE_KEY);
      localStorage.removeItem(STORAGE_KEY);
      players = [];
      storageWarning = "";
      render();
      showStatus("Đã xóa dữ liệu đã lưu");
    } catch {
      showStatus("Chưa xóa được dữ liệu đã lưu. Hãy thử lại.", true);
    }
  }

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function scoreText(score) {
    return (score > 0 ? "+" : "") + formatter.format(score / 100);
  }

  function updateScore(output, person) {
    output.textContent = scoreText(person.score);
    output.className = "player-score" + (person.score > 0 ? " positive" : person.score < 0 ? " negative" : "");
    output.setAttribute("aria-label", person.name + ": " + formatter.format(person.score / 100) + " điểm");
  }

  function changeScore(person, output, change) {
    const next = person.score + change;
    if (!Number.isSafeInteger(next)) return;
    person.score = next;
    updateScore(output, person);
    save();
  }

  function render() {
    const fragment = document.createDocumentFragment();
    for (const person of players) {
      const row = element("article", "player-row");
      const avatar = element("span", "avatar", Array.from(person.name.trim())[0].toLocaleUpperCase("vi"));
      avatar.setAttribute("aria-hidden", "true");
      const name = element("span", "player-name", person.name);
      const controls = element("div", "score-controls");
      const output = element("output", "player-score");
      output.setAttribute("aria-live", "polite");
      updateScore(output, person);

      const minus = element("button", "score-button minus", "−2");
      minus.type = "button";
      minus.setAttribute("aria-label", "Trừ 2 điểm cho " + person.name);
      minus.addEventListener("click", () => changeScore(person, output, -200));

      const plus = element("button", "score-button plus", "+2");
      plus.type = "button";
      plus.setAttribute("aria-label", "Cộng 2 điểm cho " + person.name);
      plus.addEventListener("click", () => changeScore(person, output, 200));

      const remove = element("button", "remove-button", "×");
      remove.type = "button";
      remove.title = "Xóa người chơi";
      remove.setAttribute("aria-label", "Xóa " + person.name);
      remove.addEventListener("click", () => {
        if (!window.confirm("Xóa " + person.name + " và điểm của người này?")) return;
        players = players.filter((item) => item.id !== person.id);
        save();
        render();
      });

      controls.append(minus, output, plus);
      row.append(avatar, name, controls, remove);
      fragment.append(row);
    }
    list.replaceChildren(fragment);
    document.getElementById("player-count").textContent = players.length;
    document.getElementById("empty-state").hidden = players.length > 0;
  }

  document.getElementById("add-player").addEventListener("click", () => {
    form.reset();
    nameError.textContent = "";
    dialog.showModal();
    nameInput.focus();
  });
  document.getElementById("close-dialog").addEventListener("click", () => dialog.close());
  document.getElementById("clear-all").addEventListener("click", clearAll);
  nameInput.addEventListener("input", () => { nameError.textContent = ""; });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const name = nameInput.value.trim().replace(/\s+/g, " ");
    if (!name) {
      nameError.textContent = "Bạn chưa nhập tên.";
      nameInput.focus();
      return;
    }
    if (players.some((person) => person.name.toLocaleLowerCase("vi") === name.toLocaleLowerCase("vi"))) {
      nameError.textContent = "Tên này đã có. Thêm biệt danh để phân biệt nhé.";
      nameInput.focus();
      return;
    }
    const id = globalThis.crypto?.randomUUID?.() || Date.now().toString(36) + Math.random().toString(36).slice(2);
    players.push({ id, name, score: 0 });
    save();
    render();
    dialog.close();
  });

  render();
  if (storageWarning) showStatus(storageWarning, true);
})();
