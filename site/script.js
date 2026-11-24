const demo = document.querySelector('#demo');
const video = demo.querySelector('video');
document.querySelector('#watch').addEventListener('click', () => {
  demo.showModal();
  video.play().catch(() => {});
});
document.querySelector('#close').addEventListener('click', () => demo.close());
demo.addEventListener('close', () => video.pause());
demo.addEventListener('click', event => {
  if (event.target !== demo) return;
  const box = demo.getBoundingClientRect();
  if (event.clientX < box.left || event.clientX > box.right || event.clientY < box.top || event.clientY > box.bottom) demo.close();
});

const views = {
  match: ['active-match', 'A LAN match with clocks and move history', 'Follow the clocks, queue a premove and replay the action while the match continues.'],
  focus: ['focus-mode', 'An expanded chessboard with the sidebar tucked away', 'Give the board more room. Keep the clocks in view and open the side panel whenever you need it.'],
  engine: ['play-vs-computer', 'The offline play against Stockfish screen', 'Choose a difficulty and play Stockfish on your own device, even without an internet connection.']
};
const choices = document.querySelectorAll('[data-view]');
for (const choice of choices) {
  choice.addEventListener('click', () => {
    const [file, alt, caption] = views[choice.dataset.view];
    const screen = document.querySelector('#screen');
    screen.src = 'assets/' + file + '.png';
    screen.alt = alt;
    document.querySelector('#caption').textContent = caption;
    for (const button of choices) button.setAttribute('aria-pressed', String(button === choice));
  });
}

const practiceLink = document.querySelector('[data-target-view]');
practiceLink.addEventListener('click', () => document.querySelector('[data-view="engine"]').click());
document.querySelector('a[href="#offline-ai"]').addEventListener('click', () => {
  document.querySelector('#offline-ai').open = true;
});
let swapAnimation;
for (const choice of choices) {
  choice.addEventListener('click', () => {
    if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    swapAnimation?.cancel();
    swapAnimation = document.querySelector('#screen').animate(
      [{opacity:.66, transform:'translateY(3px)'}, {opacity:1, transform:'translateY(0)'}],
      {duration:240, easing:'ease-out'}
    );
  });
}

const split = document.querySelector('#finish-split');
split.addEventListener('input', () => {
  split.parentElement.style.setProperty('--split', split.value + '%');
  split.setAttribute('aria-valuetext', split.value + ' percent Sea Glass');
});
