function v2TodayDateOnly() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 10);
}

function prepareV2CycleStart(cycles = [], { force = false } = {}) {
  const input = document.querySelector("#v2CycleStart");
  if (!input) return;
  const today = v2TodayDateOnly();
  input.min = today;
  const openCycles = (Array.isArray(cycles) ? cycles : []).filter((item) => !["completed", "superseded", "blocked"].includes(item.status));
  const nextStart = openCycles.map((item) => item.cycleEnd).filter(Boolean).sort().at(-1) || today;
  if (force || !input.value || input.value < today) input.value = nextStart < today ? today : nextStart;
}
