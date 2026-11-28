import liquidHover from "./assets/moments/liquid-hover/moment.js";
import { clamp } from "./assets/moments/lib.js";

const motion = matchMedia("(prefers-reduced-motion: reduce)");
const coarse = matchMedia("(pointer: coarse)");
const liquid = document.querySelector("#liquid");
let water;

function syncWater() {
  water?.destroy?.();
  delete liquid.dataset.momentFallback;
  if (motion.matches) return;
  water = liquidHover(liquid, { strength: .93, radius: .17, manual: true }, {
    reduced: () => motion.matches,
    coarse: () => coarse.matches,
    clamp,
  });
}

const lens = document.createElement("div");
lens.className = "water-lens";
liquid.append(lens);
let lensFade;
function showLens(x, y) {
  const source = liquid.querySelector("img").currentSrc;
  lens.style.backgroundImage = `url("${source}")`;
  lens.style.setProperty("--x", x * 100 + "%");
  lens.style.setProperty("--y", y * 100 + "%");
  lensFade?.cancel();
  lensFade = lens.animate([{opacity: .96}, {opacity: .76, offset: .35}, {opacity: 0}], {duration: 580});
}
function showPointerLens(event) {
  const bounds = liquid.getBoundingClientRect();
  showLens((event.clientX - bounds.left) / bounds.width, (event.clientY - bounds.top) / bounds.height);
}
liquid.addEventListener("pointermove", event => {
  if (!motion.matches && event.pointerType !== "touch" && liquid.dataset.momentFallback) showPointerLens(event);
});
liquid.addEventListener("pointerdown", event => {
  if (motion.matches || event.pointerType !== "touch" || !event.isPrimary) return;
  const bounds = liquid.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width;
  const y = (event.clientY - bounds.top) / bounds.height;
  if (!water?.pulse?.(x, y)) showLens(x, y);
}, { passive: true });
syncWater();

const tabs = [...document.querySelectorAll('[role="tab"]')];
const panels = tabs.map(tab => document.getElementById(tab.getAttribute("aria-controls")));
let modeAnimation;

function selectMode(index, animate) {
  tabs.forEach((tab, i) => {
    tab.setAttribute("aria-selected", String(index === i));
    tab.tabIndex = index === i ? 0 : -1;
    panels[i].hidden = index !== i;
  });
  modeAnimation?.cancel();
  if (animate && !motion.matches) {
    modeAnimation = panels[index].animate([
      {opacity: .55, transform: "translateY(5px)"}, {opacity: 1, transform: "none"}
    ], {duration: 200, easing: "cubic-bezier(.22,1,.36,1)"});
  }
}
tabs.forEach((tab, index) => {
  const panel = panels[index];
  panel.setAttribute("role", "tabpanel");
  panel.setAttribute("aria-labelledby", tab.id);
  tab.addEventListener("click", event => {
    if (tab.getAttribute("aria-selected") !== "true") selectMode(index, event.detail > 0);
  });
  tab.addEventListener("keydown", event => {
    const destinations = {
      ArrowRight: (index + 1) % tabs.length,
      ArrowLeft: (index + tabs.length - 1) % tabs.length,
      Home: 0, End: tabs.length - 1,
    };
    if (Object.hasOwn(destinations, event.key)) {
      event.preventDefault();
      tabs[destinations[event.key]].focus();
    }
  });
});
selectMode(0, false);
document.querySelector(".mode-tabs").hidden = false;

const dialog = document.querySelector("dialog");
const enlarged = document.querySelector("#enlarged");
let opener;
document.querySelectorAll("[data-zoom]").forEach(link => {
  link.addEventListener("click", event => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || !dialog.showModal) return;
    event.preventDefault();
    opener = link;
    document.querySelector("#zoom-title").textContent = link.dataset.zoom;
    enlarged.src = link.href;
    enlarged.alt = link.dataset.alt || link.closest(".mode-panel").querySelector(".screen img").alt;
    dialog.showModal();
  });
});
document.querySelector("#close").addEventListener("click", () => dialog.close());
dialog.addEventListener("close", () => opener?.focus({preventScroll:true}));

motion.addEventListener("change", () => {
  lensFade?.cancel();
  modeAnimation?.cancel();
  syncWater();
});
