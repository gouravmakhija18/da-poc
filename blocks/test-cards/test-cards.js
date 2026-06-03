function isExternal(url) {
  try {
    return new URL(url, window.location.origin).origin !== window.location.origin;
  } catch {
    return false;
  }
}

function decorateLink(a) {
  if (!a) return;
  const href = a.getAttribute('href');
  if (href && isExternal(href)) {
    a.setAttribute('target', '_blank');
    a.setAttribute('rel', 'noopener noreferrer');
  }
}

function equalizeRowHeights(grid) {
  const cards = [...grid.querySelectorAll('.test-cards-card')];
  cards.forEach((card) => { card.style.height = ''; });

  const style = window.getComputedStyle(grid);
  const columns = style.getPropertyValue('grid-template-columns').split(' ').length;
  if (columns <= 1) return;

  for (let i = 0; i < cards.length; i += columns) {
    const row = cards.slice(i, i + columns);
    const maxHeight = Math.max(...row.map((c) => c.scrollHeight));
    row.forEach((c) => { c.style.height = `${maxHeight}px`; });
  }
}

export default function decorate(block) {
  const isClickable = block.classList.contains('clickable');
  if (isClickable) {
    block.classList.add('test-cards-clickable');
  }

  const rows = [...block.querySelectorAll(':scope > div')];
  if (!rows.length) return;

  const headerRow = rows[0];
  const cardRows = rows.slice(1);

  const [titleCell, descCell] = [...headerRow.querySelectorAll(':scope > div')];
  const headerEl = document.createElement('div');
  headerEl.className = 'test-cards-header';

  const heading = titleCell?.querySelector('h1, h2, h3, h4, h5, h6');
  if (heading) {
    const titleDiv = document.createElement('div');
    titleDiv.className = 'test-cards-title';
    titleDiv.append(heading);
    headerEl.append(titleDiv);
  }
  const descContent = descCell?.innerHTML?.trim();
  if (descContent) {
    const descDiv = document.createElement('div');
    descDiv.className = 'test-cards-description';
    descDiv.innerHTML = descContent;
    headerEl.append(descDiv);
  }

  const hasHeader = headerEl.children.length > 0;

  const gridEl = document.createElement('div');
  gridEl.className = 'test-cards-grid';

  cardRows.forEach((row) => {
    const cell = row.querySelector(':scope > div');
    if (!cell) return;

    const card = document.createElement('div');
    card.className = 'test-cards-card';

    if (isClickable) {
      const link = cell.querySelector('a');
      const a = document.createElement('a');
      if (link) {
        a.href = link.href;
        decorateLink(a);
      }
      a.className = 'test-cards-card-link';

      const labelSpan = document.createElement('span');
      labelSpan.className = 'test-cards-card-label';
      labelSpan.textContent = link ? link.textContent.trim() : cell.textContent.trim();

      const arrowSpan = document.createElement('span');
      arrowSpan.className = 'test-cards-card-arrow';
      const arrowImg = document.createElement('img');
      arrowImg.src = '/icons/arrow-forward.svg';
      arrowImg.alt = '';
      arrowImg.setAttribute('aria-hidden', 'true');
      arrowSpan.append(arrowImg);

      a.append(labelSpan, arrowSpan);
      card.append(a);
    } else {
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = cell.innerHTML;

      const paras = [...tempDiv.querySelectorAll('p')];
      let ctaEl = null;
      for (let i = paras.length - 1; i >= 0; i -= 1) {
        const p = paras[i];
        const links = p.querySelectorAll('a');
        if (links.length === 1 && p.textContent.trim() === links[0].textContent.trim()) {
          ctaEl = p;
          p.remove();
          break;
        }
      }

      const contentDiv = document.createElement('div');
      contentDiv.className = 'test-cards-card-content';
      contentDiv.innerHTML = tempDiv.innerHTML;
      card.append(contentDiv);

      if (ctaEl) {
        const ctaDiv = document.createElement('div');
        ctaDiv.className = 'test-cards-card-cta';
        ctaDiv.append(ctaEl);
        ctaEl.querySelectorAll('a').forEach(decorateLink);
        card.append(ctaDiv);
      }
    }

    gridEl.append(card);
  });

  block.textContent = '';
  if (hasHeader) block.append(headerEl);
  block.append(gridEl);

  if (!isClickable) {
    const resizeObserver = new ResizeObserver(() => equalizeRowHeights(gridEl));
    resizeObserver.observe(gridEl);
    equalizeRowHeights(gridEl);
  }
}
