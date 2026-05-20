import { createOptimizedPicture } from '../../scripts/aem.js';

const BLOCK_NAME = 'notes-from-the-field';
const READ_MORE_LABEL = 'Read more';
const URL_PATTERN = /^(https?:\/\/|\/|#)/i;
let blockCount = 0;

function moveChildren(from, to) {
  while (from.firstChild) to.append(from.firstChild);
}

function getCellText(cell) {
  return cell ? cell.textContent.replace(/\s+/g, ' ').trim() : '';
}

function hasImage(row) {
  return !!row.querySelector('picture, img');
}

function isDateText(text) {
  const value = text.toLowerCase();
  return /(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{4}/.test(value)
    || /^\d{4}([/-]\d{1,2}){0,2}$/.test(value)
    || /^\d{1,2}[/-]\d{1,2}[/-]\d{2,4}$/.test(value);
}

function getUrlFromText(text) {
  const value = text.trim();
  if (!URL_PATTERN.test(value)) return '';

  try {
    return new URL(value, window.location.href).href;
  } catch {
    return '';
  }
}

function getIntroCells(rows) {
  if (rows.length === 0) return {};

  const firstRowCells = [...rows[0].children];
  if (firstRowCells.length > 1) {
    const [titleCell, descriptionCell, buttonCell] = firstRowCells;
    return { titleCell, descriptionCell, buttonCell };
  }

  const titleCell = rows[0]?.firstElementChild;
  const descriptionRowCells = rows[1] ? [...rows[1].children] : [];
  const buttonRowCells = rows[2] ? [...rows[2].children] : [];

  return {
    titleCell,
    descriptionCell: descriptionRowCells[0],
    buttonCell: descriptionRowCells[1] || buttonRowCells[0],
  };
}

function buildTitle(cell, id) {
  if (!cell || !getCellText(cell)) return null;

  const title = document.createElement('h2');
  title.className = `${BLOCK_NAME}__title`;
  title.id = id;

  const authoredHeading = cell.querySelector('h1, h2, h3, h4, h5, h6');
  if (authoredHeading) {
    moveChildren(authoredHeading, title);
  } else if (cell.children.length === 1 && cell.firstElementChild.tagName === 'P') {
    moveChildren(cell.firstElementChild, title);
  } else {
    title.textContent = getCellText(cell);
  }

  return title;
}

function buildDescription(cell) {
  if (!cell || !getCellText(cell)) return null;

  const description = document.createElement('div');
  description.className = `${BLOCK_NAME}__description`;
  moveChildren(cell, description);

  return description;
}

function buildButton(cell) {
  if (!cell) return null;

  const authoredLink = cell.querySelector('a[href]');
  if (!authoredLink) return null;

  const button = authoredLink.cloneNode(true);
  button.className = `${BLOCK_NAME}__button`;
  button.setAttribute('aria-label', button.textContent.trim() || 'Learn more');

  const icon = document.createElement('span');
  icon.className = `${BLOCK_NAME}__button-icon`;
  icon.setAttribute('aria-hidden', 'true');
  button.append(icon);

  return button;
}

function buildIntro(rows, uid) {
  const { titleCell, descriptionCell, buttonCell } = getIntroCells(rows);
  const intro = document.createElement('div');
  intro.className = `${BLOCK_NAME}__intro`;

  const title = buildTitle(titleCell, `${uid}-title`);
  const description = buildDescription(descriptionCell);
  const button = buildButton(buttonCell);

  [title, description, button].filter(Boolean).forEach((element) => {
    intro.append(element);
  });

  return {
    element: intro,
    title,
    hasContent: intro.children.length > 0,
  };
}

function getCardLink(cells, imageCell) {
  const reversedCells = [...cells].reverse();
  const linkedCell = reversedCells.find((cell) => cell !== imageCell && cell.querySelector('a[href]'));

  if (linkedCell) {
    const link = linkedCell.querySelector('a[href]');
    const label = getCellText(link);
    return {
      href: link.href,
      label: URL_PATTERN.test(label) ? READ_MORE_LABEL : label || READ_MORE_LABEL,
      cell: linkedCell,
      standalone: cells.indexOf(linkedCell) === cells.length - 1 || label.length <= 30,
    };
  }

  const urlCell = reversedCells.find((cell) => (
    cell !== imageCell && getUrlFromText(getCellText(cell))
  ));
  if (!urlCell) {
    return {
      href: '',
      label: READ_MORE_LABEL,
      cell: null,
      standalone: false,
    };
  }

  return {
    href: getUrlFromText(getCellText(urlCell)),
    label: READ_MORE_LABEL,
    cell: urlCell,
    standalone: true,
  };
}

function getTextCells(cells, imageCell, link) {
  return cells.filter((cell) => (
    cell !== imageCell
    && (!link.cell || !link.standalone || cell !== link.cell)
  ));
}

function getCardContentCells(textCells) {
  const [firstTextCell, secondTextCell] = textCells;

  if (firstTextCell && secondTextCell && isDateText(getCellText(firstTextCell))) {
    return {
      descriptionCell: secondTextCell,
      dateCell: firstTextCell,
    };
  }

  return {
    descriptionCell: firstTextCell,
    dateCell: secondTextCell,
  };
}

function readCard(row) {
  const cells = [...row.children];
  const imageCell = cells.find((cell) => cell.querySelector('picture, img')) || cells[0];
  const image = imageCell?.querySelector('img');

  if (!image) return null;

  const link = getCardLink(cells, imageCell);
  const textCells = getTextCells(cells, imageCell, link);
  const { descriptionCell, dateCell } = getCardContentCells(textCells);

  return {
    image,
    descriptionCell,
    date: getCellText(dateCell),
    href: link.href,
    label: link.label,
  };
}

function isDynamicMediaUrl(src) {
  try {
    const url = new URL(src, window.location.href);
    return url.hostname.includes('scene7.com')
      || url.pathname.includes('/is/image/')
      || url.pathname.includes('/dynamicmedia/');
  } catch {
    return false;
  }
}

function buildDynamicMediaUrl(src, width, height, format) {
  const url = new URL(src, window.location.href);
  url.searchParams.set('wid', width);
  url.searchParams.set('hei', height);
  url.searchParams.set('fit', 'crop');
  url.searchParams.set('qlt', '85');
  if (format) url.searchParams.set('fmt', format);
  return url.href;
}

function createDynamicMediaPicture(src, alt, eager, breakpoints) {
  const picture = document.createElement('picture');

  breakpoints.forEach((breakpoint) => {
    const source = document.createElement('source');
    if (breakpoint.media) source.setAttribute('media', breakpoint.media);
    source.setAttribute('type', 'image/webp');
    source.setAttribute(
      'srcset',
      buildDynamicMediaUrl(src, breakpoint.width, breakpoint.height, 'webp'),
    );
    picture.append(source);
  });

  const fallback = breakpoints[breakpoints.length - 1];
  const img = document.createElement('img');
  img.loading = eager ? 'eager' : 'lazy';
  img.decoding = 'async';
  img.alt = alt;
  img.src = buildDynamicMediaUrl(src, fallback.width, fallback.height);
  picture.append(img);

  return picture;
}

function createResponsivePicture(image, eager = false) {
  const src = image.currentSrc || image.getAttribute('src');
  if (!src) return null;

  const alt = image.getAttribute('alt') || '';
  const breakpoints = [
    { media: '(min-width: 1200px)', width: '1120', height: '630' },
    { media: '(min-width: 900px)', width: '900', height: '506' },
    { media: '(min-width: 600px)', width: '720', height: '720' },
    { width: '450', height: '450' },
  ];

  if (isDynamicMediaUrl(src)) {
    return createDynamicMediaPicture(src, alt, eager, breakpoints);
  }

  return createOptimizedPicture(
    src,
    alt,
    eager,
    breakpoints.map((breakpoint) => ({
      media: breakpoint.media,
      width: breakpoint.width,
    })),
  );
}

function buildMedia(card, index) {
  const picture = createResponsivePicture(card.image, index === 0);
  if (!picture) return null;

  const media = document.createElement(card.href ? 'a' : 'div');
  media.className = `${BLOCK_NAME}__media`;
  if (card.href) {
    media.href = card.href;
    media.setAttribute('aria-label', card.label);
  }
  media.append(picture);

  return media;
}

function buildCardDescription(card) {
  if (!card.descriptionCell || !getCellText(card.descriptionCell)) return null;

  const description = document.createElement('div');
  description.className = `${BLOCK_NAME}__card-description`;
  moveChildren(card.descriptionCell, description);

  return description;
}

function buildCard(card, index, total) {
  const slide = document.createElement('li');
  slide.className = `${BLOCK_NAME}__slide`;
  slide.setAttribute('role', 'group');
  slide.setAttribute('aria-roledescription', 'slide');
  slide.setAttribute('aria-label', `${index + 1} of ${total}`);

  const article = document.createElement('article');
  article.className = `${BLOCK_NAME}__card`;

  const media = buildMedia(card, index);
  if (media) article.append(media);

  const body = document.createElement('div');
  body.className = `${BLOCK_NAME}__card-body`;

  if (card.date) {
    const date = document.createElement('p');
    date.className = `${BLOCK_NAME}__date`;
    date.textContent = card.date;
    body.append(date);
  }

  const description = buildCardDescription(card);
  const cta = card.href ? document.createElement('a') : null;
  if (cta) {
    cta.className = `${BLOCK_NAME}__card-link`;
    cta.href = card.href;
    cta.textContent = card.label || READ_MORE_LABEL;
  }

  if (description || cta) {
    const copy = document.createElement('div');
    copy.className = `${BLOCK_NAME}__card-copy`;
    if (description) copy.append(description);
    if (cta) copy.append(cta);
    body.append(copy);
  }

  article.append(body);
  slide.append(article);

  return slide;
}

function setSlideFocusable(slide, focusable) {
  slide.querySelectorAll('a, button').forEach((element) => {
    if (focusable) element.removeAttribute('tabindex');
    else element.setAttribute('tabindex', '-1');
  });
}

function updateSlides(slides, activeIndex, carouselEnabled, status) {
  const previousIndex = (activeIndex - 1 + slides.length) % slides.length;

  slides.forEach((slide, index) => {
    const isActive = index === activeIndex;
    const isPrevious = index === previousIndex;
    const isStaticLeading = !carouselEnabled && index === 0 && slides.length > 1;
    const isStaticFeatured = !carouselEnabled && (index === 1 || slides.length === 1);

    slide.classList.toggle(`${BLOCK_NAME}__slide--active`, carouselEnabled && isActive);
    slide.classList.toggle(`${BLOCK_NAME}__slide--previous`, carouselEnabled && isPrevious);
    slide.classList.toggle(`${BLOCK_NAME}__slide--inactive`, carouselEnabled && !isActive && !isPrevious);
    slide.classList.toggle(`${BLOCK_NAME}__slide--static-leading`, isStaticLeading);
    slide.classList.toggle(`${BLOCK_NAME}__slide--static-featured`, isStaticFeatured);

    if (carouselEnabled) {
      slide.setAttribute('aria-hidden', isActive ? 'false' : 'true');
      setSlideFocusable(slide, isActive);
    } else {
      slide.removeAttribute('aria-hidden');
      setSlideFocusable(slide, true);
    }
  });

  if (status && carouselEnabled) {
    // eslint-disable-next-line no-param-reassign
    status.textContent = `Showing note ${activeIndex + 1} of ${slides.length}`;
  }
}

function buildControls(uid) {
  const controls = document.createElement('div');
  controls.className = `${BLOCK_NAME}__controls`;
  controls.setAttribute('role', 'group');
  controls.setAttribute('aria-label', 'Notes carousel controls');

  ['previous', 'next'].forEach((action) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `${BLOCK_NAME}__control ${BLOCK_NAME}__control--${action}`;
    button.setAttribute('aria-controls', `${uid}-track`);
    button.setAttribute('aria-label', action === 'previous' ? 'Previous note' : 'Next note');

    const icon = document.createElement('span');
    icon.className = `${BLOCK_NAME}__control-icon`;
    icon.setAttribute('aria-hidden', 'true');
    button.append(icon);
    controls.append(button);
  });

  return controls;
}

function activateAnimation(block, direction) {
  // eslint-disable-next-line no-param-reassign
  block.dataset.direction = direction;
  block.classList.remove(`${BLOCK_NAME}--animating`);
  requestAnimationFrame(() => {
    block.classList.add(`${BLOCK_NAME}--animating`);
  });
  setTimeout(() => {
    block.classList.remove(`${BLOCK_NAME}--animating`);
  }, 300);
}

function buildCarousel(cards, uid, labelledBy, block) {
  const carouselEnabled = cards.length > 2;
  const carousel = document.createElement('div');
  carousel.className = `${BLOCK_NAME}__carousel`;
  carousel.setAttribute('role', 'region');
  carousel.setAttribute('aria-roledescription', 'carousel');
  if (labelledBy) carousel.setAttribute('aria-labelledby', labelledBy);
  else carousel.setAttribute('aria-label', 'Notes from the field');

  const controls = buildControls(uid);
  controls.hidden = !carouselEnabled;

  const viewport = document.createElement('div');
  viewport.className = `${BLOCK_NAME}__viewport`;

  const track = document.createElement('ul');
  track.className = `${BLOCK_NAME}__track`;
  track.id = `${uid}-track`;

  cards.forEach((card, index) => {
    track.append(buildCard(card, index, cards.length));
  });
  viewport.append(track);

  const status = document.createElement('p');
  status.className = `${BLOCK_NAME}__status`;
  status.setAttribute('aria-live', 'polite');

  carousel.append(controls, viewport, status);

  const slides = [...track.children];
  let activeIndex = 0;
  updateSlides(slides, activeIndex, carouselEnabled, status);

  if (carouselEnabled) {
    const previousButton = controls.querySelector(`.${BLOCK_NAME}__control--previous`);
    const nextButton = controls.querySelector(`.${BLOCK_NAME}__control--next`);

    const goTo = (index, direction) => {
      const shouldMoveFocus = !!document.activeElement?.closest?.(`.${BLOCK_NAME}__slide`);
      activeIndex = (index + slides.length) % slides.length;
      activateAnimation(block, direction);
      updateSlides(slides, activeIndex, carouselEnabled, status);
      if (shouldMoveFocus) {
        const focusTarget = slides[activeIndex].querySelector('a, button');
        if (focusTarget) focusTarget.focus();
      }
    };

    previousButton.addEventListener('click', () => goTo(activeIndex - 1, 'previous'));
    nextButton.addEventListener('click', () => goTo(activeIndex + 1, 'next'));

    carousel.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        previousButton.click();
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        nextButton.click();
      }
    });
  }

  block.classList.toggle(`${BLOCK_NAME}--static`, !carouselEnabled);

  return carousel;
}

export default function decorate(block) {
  blockCount += 1;
  const uid = `${BLOCK_NAME}-${blockCount}`;
  const rows = [...block.children];
  const firstCardRowIndex = rows.findIndex(hasImage);
  const introRows = firstCardRowIndex === -1 ? rows : rows.slice(0, firstCardRowIndex);
  const cardRows = firstCardRowIndex === -1 ? [] : rows.slice(firstCardRowIndex);

  const intro = buildIntro(introRows, uid);
  const cards = cardRows.map(readCard).filter(Boolean);
  if (!intro.hasContent && cards.length === 0) return;

  const inner = document.createElement('div');
  inner.className = `${BLOCK_NAME}__inner`;

  if (intro.hasContent) inner.append(intro.element);
  if (cards.length > 0) {
    inner.append(buildCarousel(cards, uid, intro.title?.id, block));
  }

  block.replaceChildren(inner);
}
