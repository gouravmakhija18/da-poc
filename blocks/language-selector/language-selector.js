export default function decorate(block) {
  const languages = [];

  [...block.children].forEach((row) => {
    const cell = row.firstElementChild;
    if (!cell) return;

    const icon = cell.querySelector('.icon');
    const link = cell.querySelector('a');
    if (!link) return;

    const textNodes = [];
    cell.childNodes.forEach((node) => {
      if (node.nodeType === Node.TEXT_NODE && node.textContent.trim()) {
        textNodes.push(node.textContent.trim());
      }
    });

    const label = textNodes.join(' ') || link.textContent.trim();
    const href = link.getAttribute('href');

    languages.push({ icon, label, href });
  });

  if (languages.length === 0) return;

  const currentPath = window.location.pathname;
  let activeIndex = languages.findIndex(
    (lang) => currentPath.startsWith(lang.href),
  );
  if (activeIndex === -1) activeIndex = 0;

  const active = languages[activeIndex];

  const toggle = document.createElement('button');
  toggle.className = 'language-selector-toggle';
  toggle.setAttribute('aria-expanded', 'false');
  toggle.setAttribute('aria-haspopup', 'listbox');

  if (active.icon) toggle.append(active.icon.cloneNode(true));
  const labelSpan = document.createElement('span');
  labelSpan.className = 'language-selector-label';
  labelSpan.textContent = active.label;
  toggle.append(labelSpan);

  const chevron = document.createElement('span');
  chevron.className = 'language-selector-chevron';
  chevron.setAttribute('aria-hidden', 'true');
  toggle.append(chevron);

  const list = document.createElement('ul');
  list.className = 'language-selector-list';
  list.setAttribute('role', 'listbox');
  list.hidden = true;

  languages.forEach((lang, i) => {
    const li = document.createElement('li');
    li.className = 'language-selector-item';
    li.setAttribute('role', 'option');

    if (i === activeIndex) {
      li.classList.add('active');
      li.setAttribute('aria-selected', 'true');
    }

    const a = document.createElement('a');
    a.href = lang.href;
    if (lang.icon) a.append(lang.icon.cloneNode(true));
    a.append(document.createTextNode(` ${lang.label}`));
    li.append(a);
    list.append(li);
  });

  function open() {
    toggle.setAttribute('aria-expanded', 'true');
    list.hidden = false;
  }

  function close() {
    toggle.setAttribute('aria-expanded', 'false');
    list.hidden = true;
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    if (list.hidden) open();
    else close();
  });

  document.addEventListener('click', (e) => {
    if (!block.contains(e.target)) close();
  });

  toggle.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      close();
      toggle.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      open();
      const firstLink = list.querySelector('a');
      if (firstLink) firstLink.focus();
    }
  });

  list.addEventListener('keydown', (e) => {
    const items = [...list.querySelectorAll('a')];
    const idx = items.indexOf(document.activeElement);

    if (e.key === 'Escape') {
      close();
      toggle.focus();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = items[idx + 1] || items[0];
      next.focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = items[idx - 1] || items[items.length - 1];
      prev.focus();
    }
  });

  block.replaceChildren(toggle, list);
}
