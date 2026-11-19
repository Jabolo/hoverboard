// Adapted from this repository’s Y2K Scratch Lab concepts.
const make = (tag, className, text) => {
  const element = document.createElement(tag);
  if (className) element.className = className;
  if (text !== undefined) element.textContent = text;
  return element;
};

const intro = (root, heading, copy) => {
  const section = make('section', 'games-stage');
  const header = make('div', 'games-intro');
  header.append(make('h2', '', heading), make('p', '', copy));
  section.append(header);
  root.append(section);
  return section;
};

function renderBoss(root, kit) {
  const section = intro(
    root,
    'Scratch the Final Boss',
    'A sentient pop-up has stolen the Arcade. Scratch through three shields to defeat it.',
  );
  const arena = make('div', 'games-boss-arena');
  const screen = make('div', 'games-boss-screen');
  const portrait = make('div', 'games-boss-face');
  portrait.setAttribute('aria-hidden', 'true');
  portrait.textContent = '> : )';
  const taunt = make('p', 'games-boss-taunt');
  const health = make('p', 'games-readout');
  health.setAttribute('aria-live', 'polite');
  screen.append(make('span', 'games-window-title', 'POP-UP.EXE'), portrait, taunt, health);
  const controls = make('div', 'games-action-area');
  const panel = make('div', 'games-panel');
  const next = kit.button('Next shield', () => {
    round += 1;
    drawRound();
  });
  const restart = kit.button('Play again', () => {
    round = 0;
    kit.resetReward();
    drawRound();
  });
  next.hidden = true;
  restart.hidden = true;
  controls.append(panel, next, restart);
  arena.append(screen, controls);
  section.append(arena);
  let round = 0;
  const rounds = [
    [
      'You are visitor 1,000,000. Unfortunately, I am the prize.',
      'SHIELD 01: Remove the fake download button',
    ],
    ['My final form is a 17-toolbar browser.', 'SHIELD 02: Uninstall the cursed toolbar'],
    ['You cannot defeat me. I have seven backup pop-ups.', 'SHIELD 03: Close the last pop-up'],
  ];
  function drawRound() {
    panel.replaceChildren();
    next.hidden = true;
    restart.hidden = true;
    if (round === rounds.length) {
      portrait.textContent = 'x _ x';
      taunt.textContent = 'You win! The Arcade is safe. For now.';
      health.textContent = 'BOSS STATUS: CLOSED';
      panel.append(make('p', 'games-win', 'Achievement unlocked: professional pop-up closer.'));
      restart.hidden = false;
      kit.complete();
      return;
    }
    portrait.textContent = '> : )';
    taunt.textContent = rounds[round][0];
    health.textContent = `SHIELDS LEFT: ${rounds.length - round} / ${rounds.length}`;
    panel.append(
      kit.scratch({
        label: `Scratch shield ${round + 1} of ${rounds.length}`,
        content: rounds[round][1],
        onReveal: () => {
          next.textContent = round === rounds.length - 1 ? 'Deliver final blow' : 'Next shield';
          next.hidden = false;
          health.textContent = 'SHIELD DOWN! Continue to the next round.';
        },
      }),
    );
  }
  drawRound();
}

function renderQuarantine(root, kit) {
  const section = intro(
    root,
    'Bug Quarantine',
    'Identify the artifact before you break containment. Reveal one or two clues, then make your call.',
  );
  const consoleBox = make('div', 'games-console');
  const status = make('p', 'games-readout', 'CONTAINMENT: STABLE · CLUES REVEALED: 0 / 2');
  status.setAttribute('aria-live', 'polite');
  const instructions = make(
    'p',
    'games-console-copy',
    'Warning: revealing the third clue causes a containment breach.',
  );
  const grid = make('div', 'games-clue-grid');
  const choicesTitle = make('h3', '', 'What is trapped inside?');
  const choices = make('div', 'games-choices');
  const result = make('p', 'games-result');
  result.setAttribute('aria-live', 'polite');
  const reset = kit.button('Reset quarantine', resetGame);
  consoleBox.append(status, instructions, grid, choicesTitle, choices, result, reset);
  section.append(consoleBox);
  const clues = [
    'It bounced around office screens.',
    'It offered advice nobody asked for.',
    'It is made of bent metal and questionable enthusiasm.',
  ];
  let opened;
  let over;
  function resetGame() {
    opened = 0;
    over = false;
    kit.resetReward();
    status.textContent = 'CONTAINMENT: STABLE · CLUES REVEALED: 0 / 2';
    result.textContent = '';
    grid.replaceChildren();
    choices.replaceChildren();
    clues.forEach((clue, index) => {
      grid.append(
        kit.scratch({
          label: `Reveal quarantine clue ${index + 1}`,
          content: clue,
          onReveal: () => {
            if (over) return;
            opened += 1;
            if (opened >= 3) {
              over = true;
              status.textContent = 'CONTAINMENT BREACH';
              result.textContent = 'You freed the rogue paperclip! Reset quarantine to try again.';
              disableChoices();
            } else {
              status.textContent = `CONTAINMENT: STABLE · CLUES REVEALED: ${opened} / 2`;
            }
          },
        }),
      );
    });
    ['A rogue paperclip', 'A dancing hamster', 'A dial-up modem'].forEach((answer) => {
      const button = kit.button(answer, () => {
        if (over) return;
        if (opened === 0) {
          result.textContent = 'Reveal at least one clue before making your call.';
          return;
        }
        over = true;
        const won = answer === 'A rogue paperclip';
        status.textContent = won ? 'CONTAINMENT: SUCCESS' : 'CONTAINMENT: FAILED';
        result.textContent = won
          ? 'Correct. The rogue paperclip remains safely contained.'
          : 'Not quite. It was a rogue paperclip. Reset to investigate again.';
        if (won) kit.complete();
        disableChoices();
      });
      choices.append(button);
    });
  }
  function disableChoices() {
    choices.querySelectorAll('button').forEach((button) => {
      button.disabled = true;
    });
  }
  resetGame();
}

function renderCd(root, kit) {
  const section = intro(
    root,
    'The Corrupted CD-ROM',
    'A website from 2002 is trapped on a damaged disc. Recover three fragments, then boot the weird web.',
  );
  const windowEl = make('div', 'games-window');
  const titleBar = make('div', 'games-window-title', 'RECOVERY WIZARD 2002');
  const message = make('p', 'games-console-copy', 'Your download is 99% complete. Since 2002.');
  const fragments = make('div', 'games-clue-grid');
  const status = make('p', 'games-readout', 'FRAGMENTS RECOVERED: 0 / 3');
  status.setAttribute('aria-live', 'polite');
  const outcome = make('div', 'games-cd-result');
  outcome.setAttribute('aria-live', 'polite');
  const actions = make('div', 'games-choices');
  const boot = kit.button('Boot recovered website', () => {
    outcome.replaceChildren(
      make('h3', '', 'Welcome to the World Wide Weird!'),
      make(
        'p',
        '',
        'The glitter cursor is loose, the guestbook is open, and the mystery button insists it is perfectly normal.',
      ),
      make('p', 'games-readout', 'RECOVERY COMPLETE · YOU ARE VISITOR 000001'),
    );
    boot.disabled = true;
    kit.complete();
  });
  const reset = kit.button('Recover again', resetGame);
  actions.append(boot, reset);
  windowEl.append(titleBar, message, fragments, status, actions, outcome);
  section.append(windowEl);
  let recovered;
  const items = [
    'GLITTER CURSOR: leaves a trail of questionable decisions',
    'GUESTBOOK: please sign before you leave',
    'MYSTERY BUTTON: definitely do not press',
  ];
  function resetGame() {
    recovered = 0;
    kit.resetReward();
    boot.disabled = true;
    status.textContent = 'FRAGMENTS RECOVERED: 0 / 3';
    outcome.replaceChildren();
    fragments.replaceChildren();
    items.forEach((item, index) =>
      fragments.append(
        kit.scratch({
          label: `Recover disc fragment ${index + 1}`,
          content: item,
          onReveal: () => {
            recovered += 1;
            status.textContent = `FRAGMENTS RECOVERED: ${recovered} / 3`;
            if (recovered === 3) {
              boot.disabled = false;
              status.textContent = 'ALL FRAGMENTS RECOVERED · READY TO BOOT';
            }
          },
        }),
      ),
    );
  }
  resetGame();
}

export const concepts = [
  {
    id: 'scratch-boss',
    title: 'Scratch the Final Boss',
    category: 'Arcade',
    tagline: 'Defeat the pop-up from 2002.',
    render: renderBoss,
  },
  {
    id: 'bug-quarantine',
    title: 'Bug Quarantine',
    category: 'Arcade',
    tagline: 'Investigate the artifact. Do not release it.',
    render: renderQuarantine,
  },
  {
    id: 'corrupted-cd',
    title: 'The Corrupted CD-ROM',
    category: 'Vibe Lab',
    tagline: 'Recover a lost corner of the weird web.',
    render: renderCd,
  },
];
