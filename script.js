const screenOrder = [
  'screen-welcome',
  'screen-background',
  'screen-background-preview',
  'screen-party',
  'screen-selfie',
  'screen-delivery',
  'screen-payment',
  'screen-review',
  'screen-receipt'
];

const progressScreens = [
  'screen-background',
  'screen-background-preview',
  'screen-party',
  'screen-selfie',
  'screen-delivery',
  'screen-payment',
  'screen-review'
];

const progressLabels = {
  'screen-background': 'Background',
  'screen-background-preview': 'Preview',
  'screen-party': 'Party',
  'screen-selfie': 'Selfie',
  'screen-delivery': 'Delivery',
  'screen-payment': 'Payment',
  'screen-review': 'Review'
};

const state = {
  background: null,
  backgroundSource: null,
  backgroundSelections: [],
  selectedBackgroundCategory: null,
  customBackgroundRequest: '',
  partyName: '',
  peopleCount: null,
  sceneCount: null,
  deliveryMethod: null,
  prints: 0,
  emailCount: 0,
  emails: [],
  paymentMethod: null,
  selfieData: null,
  multipleBackgrounds: false
};

const PRICING_DEFAULTS = {
  printFee: 5,
  emailFee: 3,
  multiBackgroundFee: 10,
  extraSceneFee: 5
};

const SCENE_MIN = 1;
const SCENE_MAX = 8;

const PAYMENT_EMOJI_MAP = {
  Cash: '💵',
  'Credit Card': '💳',
  'Debit Card': '🏧'
};

let currentScreenIndex = 0;
let currentKeyboardInput = null;
let keyboardValue = '';
let selfieStream = null;
let appConfig = null;
let pendingReceipt = null;
let furthestProgressIndex = -1;
let welcomeTapFeedbackTimeout = null;
let sceneStepperControls = null;
let customBackgroundModal = null;
let customBackgroundTextarea = null;
let nextPhotoIdCache = null;

const PHOTO_ID_STORAGE_KEY = 'photoIdCounter';

const backgroundGradients = {
  stage: 'linear-gradient(135deg, #414141, #000000)'
};

const BACKGROUND_CATEGORY_ORDER = ['fsu-spirit', 'nature', 'city-retro', 'classic'];

let backgroundCategories = [];
let backgroundsByCategory = new Map();

const IDLE_TIMEOUT = 25000;
const IDLE_PROMPT_DURATION = 10000;
let idleTimeoutId = null;
let idlePromptTimeoutId = null;
let idlePromptVisible = false;
let idleCountdownInterval = null;

function showScreen(targetId) {
  const keyboardScreen = document.getElementById('screen-keyboard');
  if (keyboardScreen.classList.contains('active')) {
    keyboardScreen.classList.remove('active');
  }

  screenOrder.forEach((id, index) => {
    const element = document.getElementById(id);
    if (element) {
      element.classList.toggle('active', id === targetId);
    }
    if (id === targetId) {
      currentScreenIndex = index;
    }
  });

  document.body.classList.toggle('welcome-active', targetId === 'screen-welcome');

  const progressIndex = progressScreens.indexOf(targetId);
  if (progressIndex !== -1) {
    furthestProgressIndex = Math.max(furthestProgressIndex, progressIndex);
  } else if (targetId === 'screen-receipt') {
    furthestProgressIndex = progressScreens.length - 1;
  }

  updateProgress(targetId);
  resetIdleTimer();

  if (targetId === 'screen-review') {
    document.getElementById('review-summary').innerHTML = generateSummaryHTML();
  }
}

function goToNextScreen() {
  const nextIndex = Math.min(currentScreenIndex + 1, screenOrder.length - 1);
  if (validateScreen(screenOrder[currentScreenIndex])) {
    if (screenOrder[currentScreenIndex] === 'screen-selfie') {
      stopSelfie();
    }
    showScreen(screenOrder[nextIndex]);
  }
}

function goToPreviousScreen() {
  const prevIndex = Math.max(currentScreenIndex - 1, 0);
  showScreen(screenOrder[prevIndex]);
}

function validateScreen(screenId) {
  switch (screenId) {
    case 'screen-background':
      const hasCustomRequest = hasCustomBackgroundRequest();
      if (state.multipleBackgrounds && state.backgroundSelections.length < 2 && !hasCustomRequest) {
        alert('Please select two backgrounds to continue.');
        return false;
      }
      if (!state.multipleBackgrounds && !state.background && !hasCustomRequest) {
        alert('Please select a background to continue.');
        return false;
      }
      break;
    case 'screen-party':
      if (!state.partyName.trim()) {
        alert('Please enter a party name.');
        return false;
      }
      if (!state.peopleCount) {
        alert('Please choose how many people are in the photo.');
        return false;
      }
      break;
    case 'screen-delivery': {
      if (!state.deliveryMethod) {
        alert('Please select a delivery method.');
        return false;
      }
      const filledEmails = state.emails.filter(email => email && email.trim().length);
      if (filledEmails.length !== state.emailCount) {
        alert('Please fill in all email addresses.');
        return false;
      }
      if (filledEmails.some(email => !isValidEmail(email))) {
        alert('One or more email addresses look incorrect.');
        return false;
      }
      break;
    }
    case 'screen-payment':
      if (!state.paymentMethod) {
        alert('Please pick a payment method.');
        return false;
      }
      break;
    default:
      break;
  }
  return true;
}

async function loadConfig() {
  try {
    const res = await fetch('./config.json');
    const config = await res.json();
    window.appConfig = config;
    appConfig = config;
    init();
  } catch (error) {
    console.error('Unable to load configuration', error);
  }
}

function renderProgressIndicator() {
  const indicator = document.getElementById('progress-indicator');
  if (!indicator) {
    return;
  }

  const status = document.createElement('p');
  status.className = 'progress-status sr-only';
  status.setAttribute('aria-live', 'polite');
  status.textContent = `Step 1 of ${progressScreens.length}`;

  const list = document.createElement('ol');
  list.className = 'progress-steps';

  progressScreens.forEach((screenId, index) => {
    const item = document.createElement('li');
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'progress-step';
    button.dataset.step = screenId;
    button.dataset.index = index;
    const label = progressLabels[screenId] || `Step ${index + 1}`;
    button.setAttribute('aria-label', `Step ${index + 1} of ${progressScreens.length}: ${label}`);
    button.title = `Go to ${label}`;
    button.innerHTML = `
      <span class="step-index">${index + 1}</span>
      <span class="step-label">${label}</span>
    `;
    button.addEventListener('click', () => {
      if (button.disabled) {
        return;
      }
      showScreen(screenId);
    });
    item.appendChild(button);
    list.appendChild(item);
  });

  indicator.innerHTML = '';
  indicator.appendChild(status);
  indicator.appendChild(list);
}

function init() {
  if (!appConfig) return;
  renderProgressIndicator();
  setupNavigation();
  populateEventInfo();
  prepareBackgroundData();
  populateBackgrounds();
  setupBackgroundAddons();
  setupCustomBackgroundRequest();
  populateTouchSelectors();
  setupSelfie();
  setupKeyboard();
  setupIdleTimer();
  document.getElementById('confirm-btn').addEventListener('click', onConfirm);
  document.getElementById('print-btn').addEventListener('click', () => window.print());
  document.getElementById('finish-btn').addEventListener('click', resetKiosk);
  document.getElementById('cancel-confirm').addEventListener('click', hideConfirmModal);
  document.getElementById('continue-confirm').addEventListener('click', finalizeTransaction);
  const idleStayButton = document.getElementById('idle-stay');
  if (idleStayButton) {
    idleStayButton.addEventListener('click', () => {
      hideIdlePrompt();
      resetIdleTimer();
    });
  }
  showScreen('screen-welcome');
}

function setupNavigation() {
  setupWelcomeScreenTap();
  document.querySelectorAll('[data-next]').forEach(btn => btn.addEventListener('click', goToNextScreen));
  document.querySelectorAll('[data-prev]').forEach(btn => btn.addEventListener('click', goToPreviousScreen));
}

function setupWelcomeScreenTap() {
  const welcomeScreen = document.getElementById('screen-welcome');
  if (!welcomeScreen) {
    return;
  }

  const welcomeCard = document.getElementById('welcome-card');

  const triggerTapFeedback = () => {
    if (!welcomeCard) {
      return;
    }
    welcomeCard.classList.add('is-tapping');
    if (welcomeTapFeedbackTimeout) {
      clearTimeout(welcomeTapFeedbackTimeout);
    }
    welcomeTapFeedbackTimeout = window.setTimeout(() => {
      welcomeCard.classList.remove('is-tapping');
      welcomeTapFeedbackTimeout = null;
    }, 220);
  };

  const showRipple = event => {
    if (!event || !welcomeScreen) {
      return;
    }
    const ripple = document.createElement('span');
    ripple.className = 'tap-ripple';
    const rect = welcomeScreen.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    ripple.style.width = `${size}px`;
    ripple.style.height = `${size}px`;
    ripple.style.left = `${event.clientX - rect.left - size / 2}px`;
    ripple.style.top = `${event.clientY - rect.top - size / 2}px`;
    welcomeScreen.appendChild(ripple);
    ripple.addEventListener('animationend', () => {
      ripple.remove();
    });
  };

  const proceedToNext = () => {
    showScreen('screen-background');
  };

  welcomeScreen.addEventListener('pointerdown', event => {
    if (event && event.isPrimary === false) {
      return;
    }
    triggerTapFeedback();
    showRipple(event);
  });

  welcomeScreen.addEventListener('click', () => {
    proceedToNext();
  });

  welcomeScreen.addEventListener('keydown', event => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      triggerTapFeedback();
      proceedToNext();
    }
  });
}

function populateEventInfo() {
  const welcomeEventName = document.getElementById('welcome-event-name');
  if (welcomeEventName) {
    welcomeEventName.textContent = `${appConfig.eventName}`;
  }

  const headerName = document.getElementById('eventName');
  if (headerName) {
    headerName.textContent = appConfig.eventName;
  }

  const taglineText = typeof appConfig.tagline === 'string' ? appConfig.tagline.trim() : '';

  const welcomeTagline = document.getElementById('welcome-tagline');
  if (welcomeTagline) {
    welcomeTagline.textContent = taglineText || 'Step into the spotlight';
  }

  const eventTagline = document.getElementById('eventTagline');
  if (eventTagline) {
    eventTagline.textContent = taglineText;
    eventTagline.classList.toggle('hidden', !taglineText);
  }

  updatePricingDisplay();
}

function populateBackgrounds() {
  if (!appConfig) {
    return;
  }

  if (!backgroundCategories.length || !backgroundsByCategory.size) {
    prepareBackgroundData();
  }

  const tabList = document.getElementById('background-tablist');
  const grid = document.getElementById('background-grid');

  if (!tabList || !grid) {
    return;
  }

  const availableCategories = backgroundCategories.filter(category => {
    const items = backgroundsByCategory.get(category.id) || [];
    return items.length > 0;
  });

  const availableCategoryIds = new Set(availableCategories.map(category => category.id));

  if (!state.selectedBackgroundCategory && state.backgroundSelections.length) {
    const firstSelection = state.backgroundSelections[0];
    const selectionCategoryId = getBackgroundCategoryKey(firstSelection);
    if (selectionCategoryId && availableCategoryIds.has(selectionCategoryId)) {
      state.selectedBackgroundCategory = selectionCategoryId;
    }
  }

  if (!state.selectedBackgroundCategory && availableCategories.length) {
    const preferredCategoryId =
      BACKGROUND_CATEGORY_ORDER.find(id => availableCategoryIds.has(id)) || availableCategories[0].id;
    state.selectedBackgroundCategory = preferredCategoryId;
  }

  if (state.selectedBackgroundCategory && !availableCategoryIds.has(state.selectedBackgroundCategory)) {
    state.selectedBackgroundCategory = availableCategories.length ? availableCategories[0].id : null;
  }

  renderBackgroundTabs(tabList, availableCategories);

  if (!state.selectedBackgroundCategory) {
    grid.innerHTML = '';
    grid.setAttribute('aria-label', 'No backgrounds available');
    updateBackgroundPreview();
    return;
  }

  renderBackgroundOptions(grid, state.selectedBackgroundCategory);
  updateBackgroundOptionSelectionClasses();
  updateBackgroundPreview();
}

function renderBackgroundTabs(container, categories) {
  if (!container) {
    return;
  }

  container.innerHTML = '';

  if (!Array.isArray(categories) || !categories.length) {
    return;
  }

  categories.forEach(category => {
    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = 'background-tab';
    tab.dataset.categoryId = category.id;
    tab.id = `background-tab-${category.id}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', 'background-grid');
    tab.textContent = category.name;
    const isActive = state.selectedBackgroundCategory === category.id;
    if (isActive) {
      tab.classList.add('active');
    }
    tab.setAttribute('aria-selected', isActive ? 'true' : 'false');
    tab.tabIndex = isActive ? 0 : -1;
    tab.addEventListener('click', () => {
      if (state.selectedBackgroundCategory === category.id) {
        return;
      }
      state.selectedBackgroundCategory = category.id;
      populateBackgrounds();
    });
    container.appendChild(tab);
  });
}

function renderBackgroundOptions(grid, categoryId) {
  const template = document.getElementById('background-option-template');
  if (!template || !grid) {
    return;
  }

  grid.innerHTML = '';

  if (!categoryId || !backgroundsByCategory.has(categoryId)) {
    grid.setAttribute('aria-label', 'No backgrounds available');
    return;
  }

  const backgrounds = backgroundsByCategory.get(categoryId) || [];

  backgrounds.forEach((background, index) => {
    const option = template.content.firstElementChild.cloneNode(true);
    option.style.backgroundImage = getBackgroundImage(background);
    const label = option.querySelector('.label');
    if (label) {
      label.textContent = background.name;
    }
    option.title = `Tap to choose ${background.name}`;
    option.setAttribute('aria-label', background.name);
    option.setAttribute('aria-pressed', 'false');
    const optionId = background.id || `background-${categoryId}-${index}`;
    option.dataset.backgroundId = optionId;
    option.addEventListener('click', () => selectBackground(background, optionId));
    grid.appendChild(option);
  });

  const category = backgroundCategories.find(item => item.id === categoryId);
  grid.setAttribute('aria-label', category ? `${category.name} backgrounds` : 'Background choices');
}

function prepareBackgroundData() {
  if (!appConfig) {
    return;
  }

  const backgrounds = Array.isArray(appConfig.backgrounds) ? appConfig.backgrounds : [];
  const categoriesConfig = Array.isArray(appConfig.backgroundCategories) ? appConfig.backgroundCategories : [];

  const normalizedCategories = categoriesConfig.map(category => {
    const id = category.id || slugify(category.name);
    return {
      id,
      name: category.name || formatCategoryLabel(id),
      description: category.description || ''
    };
  });

  const normalizedCategoryMap = new Map();
  normalizedCategories.forEach(category => {
    normalizedCategoryMap.set(category.id, category);
  });

  const normalizedBackgrounds = backgrounds.map(background => {
    const categoryId = getBackgroundCategoryKey(background) || 'other';
    const configuredCategory = normalizedCategoryMap.get(categoryId);
    const categoryName = background.categoryName || background.category || (configuredCategory ? configuredCategory.name : formatCategoryLabel(categoryId));
    return {
      ...background,
      categoryId,
      categoryName
    };
  });

  const categoryMap = new Map();
  normalizedBackgrounds.forEach(background => {
    if (!categoryMap.has(background.categoryId)) {
      categoryMap.set(background.categoryId, []);
    }
    categoryMap.get(background.categoryId).push(background);
  });

  const discoveredCategories = [];
  categoryMap.forEach((items, id) => {
    if (!normalizedCategoryMap.has(id)) {
      const sample = items[0] || {};
      discoveredCategories.push({
        id,
        name: sample.categoryName || formatCategoryLabel(id),
        description: ''
      });
    }
  });

  discoveredCategories.sort((a, b) => a.name.localeCompare(b.name));

  const orderedCategories = normalizedCategories
    .filter(category => categoryMap.has(category.id))
    .concat(discoveredCategories);

  const orderLookup = new Map(BACKGROUND_CATEGORY_ORDER.map((id, index) => [id, index]));

  orderedCategories.sort((a, b) => {
    const orderA = orderLookup.has(a.id) ? orderLookup.get(a.id) : BACKGROUND_CATEGORY_ORDER.length;
    const orderB = orderLookup.has(b.id) ? orderLookup.get(b.id) : BACKGROUND_CATEGORY_ORDER.length;
    if (orderA !== orderB) {
      return orderA - orderB;
    }
    return a.name.localeCompare(b.name);
  });

  backgroundCategories = orderedCategories;

  backgroundsByCategory = categoryMap;
  appConfig.backgrounds = normalizedBackgrounds;

  if (state.selectedBackgroundCategory && !backgroundsByCategory.has(state.selectedBackgroundCategory)) {
    state.selectedBackgroundCategory = null;
  }
}

function getBackgroundCategoryKey(background) {
  if (!background) {
    return null;
  }
  if (background.categoryId) {
    return background.categoryId;
  }
  if (background.category) {
    return slugify(background.category);
  }
  return null;
}

function formatCategoryLabel(value) {
  if (!value) {
    return 'Backgrounds';
  }
  return String(value)
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, char => char.toUpperCase());
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'other';
}

function hasCustomBackgroundRequest() {
  return Boolean(state.customBackgroundRequest && state.customBackgroundRequest.trim());
}

function escapeHtml(value) {
  if (value == null) {
    return '';
  }
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function selectBackground(background, optionId) {
  const backgroundImage = getBackgroundImage(background);
  const selectionId = optionId || background.id || background.name || 'custom';
  const selection = { ...background, id: selectionId, image: backgroundImage };

  state.customBackgroundRequest = '';
  state.backgroundSource = 'preset';
  const categoryId = getBackgroundCategoryKey(background);
  if (categoryId) {
    state.selectedBackgroundCategory = categoryId;
  }

  if (state.multipleBackgrounds) {
    const existingIndex = state.backgroundSelections.findIndex(item => item.id === selection.id);
    if (existingIndex !== -1) {
      state.backgroundSelections.splice(existingIndex, 1);
    } else {
      if (state.backgroundSelections.length >= 2) {
        state.backgroundSelections.shift();
      }
      state.backgroundSelections.push(selection);
    }
  } else {
    state.backgroundSelections = [selection];
  }

  state.background = state.backgroundSelections[0] || null;

  updateBackgroundOptionSelectionClasses();
  updateBackgroundPreview();
  updateCustomBackgroundStatus();
  syncSceneSelectionWithBackgrounds();
  updatePricingDisplay();
}

function updateBackgroundOptionSelectionClasses() {
  const selectedIds = new Set(state.backgroundSelections.map(item => item.id));
  document.querySelectorAll('#background-grid .background-option').forEach(btn => {
    const id = btn.dataset.backgroundId;
    const isSelected = selectedIds.has(id);
    btn.classList.toggle('selected', isSelected);
    btn.setAttribute('aria-pressed', isSelected ? 'true' : 'false');
  });
}

function updateBackgroundPreview() {
  const preview = document.getElementById('background-preview');
  if (!preview) {
    return;
  }

  const primarySlot = preview.querySelector('[data-slot="0"]');
  const secondarySlot = preview.querySelector('[data-slot="1"]');
  const firstSelection = state.backgroundSelections[0] || null;
  const secondSelection = state.backgroundSelections[1] || null;
  const hasCustomRequest = hasCustomBackgroundRequest();

  preview.classList.toggle('multi', state.multipleBackgrounds);

  if (primarySlot) {
    if (firstSelection) {
      primarySlot.style.backgroundImage = firstSelection.image;
      primarySlot.textContent = '';
      primarySlot.classList.remove('custom-request');
      primarySlot.removeAttribute('title');
    } else if (hasCustomRequest) {
      primarySlot.style.backgroundImage = '';
      primarySlot.textContent = state.customBackgroundRequest;
      primarySlot.classList.add('custom-request');
      primarySlot.title = state.customBackgroundRequest;
    } else {
      primarySlot.style.backgroundImage = '';
      primarySlot.textContent = 'Choose a background';
      primarySlot.classList.remove('custom-request');
      primarySlot.removeAttribute('title');
    }
  }

  if (secondarySlot) {
    if (state.multipleBackgrounds && !hasCustomRequest) {
      secondarySlot.classList.remove('hidden');
      if (secondSelection) {
        secondarySlot.style.backgroundImage = secondSelection.image;
        secondarySlot.textContent = '';
      } else {
        secondarySlot.style.backgroundImage = '';
        secondarySlot.textContent = 'Select a second background';
      }
    } else {
      secondarySlot.classList.add('hidden');
      secondarySlot.style.backgroundImage = '';
      secondarySlot.textContent = 'Turn on Multi-Background to add another scene';
    }
  }

  const labelEl = document.getElementById('selected-background-name');
  if (labelEl) {
    const selections = getSelectedBackgrounds();
    if (selections.length) {
      labelEl.textContent = selections.map(item => item.name).join(' + ');
    } else if (hasCustomRequest) {
      labelEl.textContent = `Custom request: ${state.customBackgroundRequest}`;
    } else {
      labelEl.textContent = 'No background selected';
    }
  }
}

function getSelectedBackgrounds() {
  if (state.backgroundSelections && state.backgroundSelections.length) {
    return state.backgroundSelections;
  }
  if (state.background) {
    return [state.background];
  }
  return [];
}

function getBackgroundSummaryText() {
  if (hasCustomBackgroundRequest()) {
    return `Custom request: ${state.customBackgroundRequest}`;
  }
  const selections = getSelectedBackgrounds();
  if (selections.length) {
    return selections.map(item => item.name).join(' + ');
  }
  return 'Not selected';
}

function getBackgroundIdSummary() {
  if (hasCustomBackgroundRequest()) {
    return 'custom-request';
  }
  const selections = getSelectedBackgrounds();
  if (selections.length) {
    return selections.map(item => item.id || 'custom').join(', ');
  }
  return 'none';
}

function getBackgroundLabel() {
  return getSelectedBackgrounds().length > 1 ? 'Backgrounds' : 'Background';
}

function populateTouchSelectors() {
  initializePeopleStepper(document.getElementById('peopleCount'), 1, 10);

  initializeSceneStepper(
    document.getElementById('sceneCount'),
    SCENE_MIN,
    SCENE_MAX,
    {
      helperId: 'scene-count-helper'
    }
  );

  createTouchSelector(
    document.getElementById('delivery-method'),
    appConfig.deliveryMethods,
    value => value,
    value => {
      state.deliveryMethod = value;
    }
  );

  const printOptions = buildRange(0, appConfig.maxPrints);
  createTouchSelector(
    document.getElementById('prints-count'),
    printOptions,
    value => `${value}`,
    value => {
      state.prints = Number(value);
      updatePricingDisplay();
    }
  );

  const emailOptions = buildRange(0, appConfig.maxEmails);
  createTouchSelector(
    document.getElementById('email-count'),
    emailOptions,
    value => `${value}`,
    value => {
      state.emailCount = Number(value);
      renderEmailInputs(state.emailCount);
      updatePricingDisplay();
    }
  );

  createTouchSelector(
    document.getElementById('payment-method'),
    appConfig.paymentMethods,
    formatPaymentLabel,
    value => {
      state.paymentMethod = value;
    }
  );
}

function formatPaymentLabel(value) {
  const emoji = PAYMENT_EMOJI_MAP[value];
  return emoji ? `${emoji} ${value}` : `${value}`;
}

function buildRange(min, max) {
  const range = [];
  for (let i = min; i <= max; i++) {
    range.push(i);
  }
  return range;
}

function createTouchSelector(container, options, labelFormatter, onSelect) {
  const template = document.getElementById('touch-option-template');
  container.innerHTML = '';
  options.forEach(value => {
    const btn = template.content.firstElementChild.cloneNode(true);
    const label = labelFormatter(value);
    btn.textContent = label;
    btn.setAttribute('aria-label', label);
    btn.addEventListener('click', () => {
      container.querySelectorAll('.touch-option').forEach(option => option.classList.remove('selected'));
      btn.classList.add('selected');
      onSelect(value);
    });
    container.appendChild(btn);
  });
}

function initializePeopleStepper(valueDisplay, min, max) {
  if (!valueDisplay) {
    return;
  }

  const stepper = valueDisplay.closest('.stepper');
  if (!stepper) {
    return;
  }

  const minusBtn = stepper.querySelector('.minus');
  const plusBtn = stepper.querySelector('.plus');

  if (!minusBtn || !plusBtn) {
    return;
  }

  [minusBtn, plusBtn].forEach(btn => {
    if (!btn.hasAttribute('type')) {
      btn.type = 'button';
    }
  });

  let value = Number.isFinite(state.peopleCount) ? state.peopleCount : min;
  value = Math.min(Math.max(value, min), max);
  state.peopleCount = value;

  function updateDisplay() {
    valueDisplay.textContent = `${value}`;
    minusBtn.disabled = value <= min;
    const isAtMax = value >= max;
    if (isAtMax) {
      plusBtn.setAttribute('aria-disabled', 'true');
    } else {
      plusBtn.removeAttribute('aria-disabled');
    }
    plusBtn.classList.toggle('at-limit', isAtMax);
  }

  minusBtn.addEventListener('click', () => {
    if (value > min) {
      value -= 1;
      state.peopleCount = value;
      updateDisplay();
    }
  });

  plusBtn.addEventListener('click', () => {
    if (value >= max) {
      alert(`You can have up to ${max} people in the photo.`);
      return;
    }
    value += 1;
    state.peopleCount = value;
    updateDisplay();
  });

  updateDisplay();
}

function initializeSceneStepper(valueDisplay, min = SCENE_MIN, max = SCENE_MAX, options = {}) {
  if (!valueDisplay) {
    return;
  }

  const stepper = valueDisplay.closest('.stepper');
  if (!stepper) {
    return;
  }

  const minusBtn = stepper.querySelector('.minus-scene');
  const plusBtn = stepper.querySelector('.plus-scene');

  if (!minusBtn || !plusBtn) {
    return;
  }

  [minusBtn, plusBtn].forEach(btn => {
    if (!btn.hasAttribute('type')) {
      btn.type = 'button';
    }
  });

  const { helperId = null } = options;

  sceneStepperControls = {
    min,
    max,
    minusBtn,
    plusBtn,
    valueDisplay,
    helperId
  };

  ensureSceneCountIsValid();
  updateSceneStepperDisplay();

  minusBtn.addEventListener('click', () => {
    const included = getIncludedSceneCount();
    const nextValue = Math.max(state.sceneCount - 1, Math.max(min, included));
    if (nextValue === state.sceneCount) {
      return;
    }
    state.sceneCount = nextValue;
    updateSceneStepperDisplay();
    updatePricingDisplay();
  });

  plusBtn.addEventListener('click', () => {
    if (state.sceneCount >= max) {
      alert(`You can schedule up to ${max} scenes.`);
      return;
    }
    state.sceneCount = Math.min(state.sceneCount + 1, max);
    updateSceneStepperDisplay();
    updatePricingDisplay();
  });
}

function getIncludedSceneCount() {
  const selections = getSelectedBackgrounds();
  return selections.length;
}

function clampSceneCount(value) {
  const included = getIncludedSceneCount();
  const min = sceneStepperControls ? sceneStepperControls.min : SCENE_MIN;
  const max = sceneStepperControls ? sceneStepperControls.max : SCENE_MAX;
  let nextValue = Number.isFinite(value) ? value : Math.max(included, min);
  nextValue = Math.max(nextValue, min);
  nextValue = Math.max(nextValue, included);
  nextValue = Math.min(nextValue, max);
  return nextValue;
}

function ensureSceneCountIsValid() {
  const clamped = clampSceneCount(state.sceneCount);
  if (state.sceneCount !== clamped) {
    state.sceneCount = clamped;
  }
  return clamped;
}

function updateSceneStepperDisplay() {
  if (!sceneStepperControls) {
    return;
  }
  const { min, max, minusBtn, plusBtn, valueDisplay, helperId } = sceneStepperControls;
  const sceneValue = ensureSceneCountIsValid();
  const included = getIncludedSceneCount();

  valueDisplay.textContent = `${sceneValue}`;
  const disableMinus = sceneValue <= min || sceneValue <= included;
  minusBtn.disabled = disableMinus;

  const atMax = sceneValue >= max;
  if (atMax) {
    plusBtn.setAttribute('aria-disabled', 'true');
  } else {
    plusBtn.removeAttribute('aria-disabled');
  }
  plusBtn.classList.toggle('at-limit', atMax);

  if (helperId) {
    const helper = document.getElementById(helperId);
    if (helper) {
      const currency = (appConfig && appConfig.currency) || 'USD';
      const extraSceneFee = getFeeValue('extraSceneFee', PRICING_DEFAULTS.extraSceneFee);
      const formattedFee = formatCurrency(extraSceneFee, currency);
      const includedText = included === 1 ? '1' : `${included}`;
      helper.textContent = `Included: ${includedText} (Extra +${formattedFee} each after included)`;
    }
  }
}

function syncSceneSelectionWithBackgrounds() {
  ensureSceneCountIsValid();
  updateSceneStepperDisplay();
}

function getScenePricingInfo() {
  const sceneCount = ensureSceneCountIsValid();
  const includedScenes = getIncludedSceneCount();
  const extraSceneFee = getFeeValue('extraSceneFee', PRICING_DEFAULTS.extraSceneFee);
  const extraSceneCount = Math.max(sceneCount - includedScenes, 0);
  const sceneCost = extraSceneCount * extraSceneFee;
  return {
    sceneCount,
    includedScenes,
    extraSceneCount,
    extraSceneFee,
    sceneCost
  };
}

function setupBackgroundAddons() {
  const toggle = document.getElementById('multi-background-toggle');
  if (!toggle) {
    return;
  }
  toggle.addEventListener('click', () => {
    state.multipleBackgrounds = !state.multipleBackgrounds;
    if (state.multipleBackgrounds) {
      if (!state.backgroundSelections.length && state.background) {
        state.backgroundSelections = [state.background];
      }
    } else {
      state.backgroundSelections = state.backgroundSelections.slice(0, 1);
      state.background = state.backgroundSelections[0] || null;
    }
    syncSceneSelectionWithBackgrounds();
    updatePricingDisplay();
  });
  reflectMultiBackgroundState();
}

function reflectMultiBackgroundState() {
  const toggle = document.getElementById('multi-background-toggle');
  const note = document.getElementById('multi-background-note');
  if (!toggle) {
    return;
  }
  const isActive = Boolean(state.multipleBackgrounds);
  const currency = (appConfig && appConfig.currency) || 'USD';
  const multiFee = formatCurrency(getFeeValue('multiBackgroundFee', PRICING_DEFAULTS.multiBackgroundFee), currency);
  toggle.classList.toggle('active', isActive);
  toggle.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  toggle.textContent = isActive
    ? `Multi-Background Package Added (+${multiFee})`
    : `Add Multi-Background Package (+${multiFee})`;
  if (note) {
    note.textContent = isActive
      ? 'Select two backgrounds to capture multiple scenes during your session.'
      : 'Add a second background setup for an additional fee.';
  }
  syncSceneSelectionWithBackgrounds();
  updateBackgroundOptionSelectionClasses();
  updateBackgroundPreview();
}

function updateCustomBackgroundStatus() {
  const statusEl = document.getElementById('custom-background-status');
  const button = document.getElementById('custom-background-button');
  const hasRequest = hasCustomBackgroundRequest();
  if (statusEl) {
    if (hasRequest) {
      statusEl.textContent = `Custom request noted: ${state.customBackgroundRequest}`;
      statusEl.classList.add('active');
      statusEl.title = state.customBackgroundRequest;
    } else {
      statusEl.textContent = 'Prefer a specific scene? Request a custom background.';
      statusEl.classList.remove('active');
      statusEl.removeAttribute('title');
    }
  }
  if (button) {
    button.textContent = hasRequest ? 'Edit Custom Background Request' : 'Request Custom Background';
  }
}

function openCustomBackgroundModal() {
  if (!customBackgroundModal) {
    return;
  }
  customBackgroundModal.classList.remove('hidden');
  if (customBackgroundTextarea) {
    customBackgroundTextarea.value = state.customBackgroundRequest || '';
    customBackgroundTextarea.focus();
  }
}

function closeCustomBackgroundModal() {
  if (!customBackgroundModal) {
    return;
  }
  customBackgroundModal.classList.add('hidden');
}

function setupCustomBackgroundRequest() {
  const trigger = document.getElementById('custom-background-button');
  customBackgroundModal = document.getElementById('custom-background-modal');
  customBackgroundTextarea = document.getElementById('custom-background-input');
  const cancelBtn = document.getElementById('custom-background-cancel');
  const saveBtn = document.getElementById('custom-background-save');

  if (!trigger || !customBackgroundModal || !customBackgroundTextarea || !cancelBtn || !saveBtn) {
    return;
  }

  trigger.addEventListener('click', () => {
    openCustomBackgroundModal();
  });

  cancelBtn.addEventListener('click', () => {
    customBackgroundTextarea.value = state.customBackgroundRequest || '';
    closeCustomBackgroundModal();
  });

  saveBtn.addEventListener('click', () => {
    const value = customBackgroundTextarea.value.trim();
    state.customBackgroundRequest = value;
    if (value) {
      state.background = null;
      state.backgroundSelections = [];
      state.backgroundSource = 'custom';
      state.multipleBackgrounds = false;
    }
    updateBackgroundOptionSelectionClasses();
    reflectMultiBackgroundState();
    updateBackgroundPreview();
    updatePricingDisplay();
    updateCustomBackgroundStatus();
    closeCustomBackgroundModal();
  });

  customBackgroundModal.addEventListener('click', event => {
    if (event.target === customBackgroundModal) {
      closeCustomBackgroundModal();
    }
  });

  updateCustomBackgroundStatus();
}

function renderEmailInputs(count = state.emailCount) {
  const container = document.getElementById('emailInputs');
  container.innerHTML = '';
  state.emails = new Array(count).fill('');
  for (let i = 0; i < count; i++) {
    const wrapper = document.createElement('div');
    wrapper.className = 'email-chip touch-field';
    wrapper.dataset.keyboardTarget = `email-${i}`;
    const label = document.createElement('span');
    label.textContent = `Email ${i + 1}`;
    const input = document.createElement('input');
    input.type = 'email';
    input.id = `email-${i}`;
    input.readOnly = true;
    input.autocomplete = 'off';
    input.dataset.index = i;
    input.addEventListener('focus', () => openKeyboardForInput(input));
    input.addEventListener('click', () => openKeyboardForInput(input));
    input.setAttribute('aria-label', `Email address ${i + 1}`);
    wrapper.appendChild(label);
    wrapper.appendChild(input);
    container.appendChild(wrapper);
    wrapper.addEventListener('click', () => openKeyboardForInput(input));
  }
}

function setupSelfie() {
  const startBtn = document.getElementById('selfie-start');
  const captureBtn = document.getElementById('selfie-capture');
  const retakeBtn = document.getElementById('selfie-retake');
  const video = document.getElementById('selfie-video');
  const canvas = document.getElementById('selfie-canvas');

  startBtn.addEventListener('click', async () => {
    if (selfieStream) {
      stopSelfie();
    }
    try {
      selfieStream = await navigator.mediaDevices.getUserMedia({ video: true });
      video.srcObject = selfieStream;
      captureBtn.disabled = false;
      startBtn.disabled = true;
    } catch (error) {
      alert('Camera unavailable. Please ask an attendant for assistance.');
    }
  });

  captureBtn.addEventListener('click', () => {
    if (!selfieStream) return;
    const context = canvas.getContext('2d');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    canvas.classList.remove('hidden');
    video.classList.add('hidden');
    state.selfieData = canvas.toDataURL('image/png');
    captureBtn.disabled = true;
    retakeBtn.disabled = false;
  });

  retakeBtn.addEventListener('click', () => {
    if (!selfieStream) return;
    video.classList.remove('hidden');
    canvas.classList.add('hidden');
    captureBtn.disabled = false;
    retakeBtn.disabled = true;
    state.selfieData = null;
  });
}

function setupKeyboard() {
  const keyboardScreen = document.getElementById('screen-keyboard');
  const keyboardKeys = document.getElementById('keyboard-keys');
  const keyboardDone = document.getElementById('keyboard-done');
  const keyboardClear = document.getElementById('keyboard-clear');
  const keyboardDisplay = document.getElementById('keyboard-display');

  const layout = [
    '1','2','3','4','5','6','7','8','9','0',
    'Q','W','E','R','T','Y','U','I','O','P',
    'A','S','D','F','G','H','J','K','L','@',
    'Z','X','C','V','B','N','M','.','-','_',
    'Space','⌫'
  ];

  layout.forEach(char => {
    const key = document.createElement('button');
    key.type = 'button';
    key.textContent = char === 'Space' ? 'Space' : char;
    key.addEventListener('click', () => {
      if (char === '⌫') {
        keyboardValue = keyboardValue.slice(0, -1);
      } else if (char === 'Space') {
        keyboardValue += ' ';
      } else {
        keyboardValue += char;
      }
      keyboardDisplay.textContent = keyboardValue;
    });
    keyboardKeys.appendChild(key);
  });

  keyboardDone.addEventListener('click', () => {
    if (!currentKeyboardInput) return closeKeyboard();
    const value = keyboardValue.trim();
    currentKeyboardInput.value = value;
    if (currentKeyboardInput.id.startsWith('email-')) {
      const index = Number(currentKeyboardInput.dataset.index);
      state.emails[index] = value;
    } else if (currentKeyboardInput.id === 'party-name') {
      state.partyName = value;
    }
    closeKeyboard();
  });

  keyboardClear.addEventListener('click', () => {
    keyboardValue = '';
    keyboardDisplay.textContent = '';
  });

  document.querySelectorAll('[data-keyboard-target]').forEach(wrapper => {
    const input = document.getElementById(wrapper.dataset.keyboardTarget);
    input.readOnly = true;
    wrapper.addEventListener('click', () => openKeyboardForInput(input));
  });

  document.getElementById('party-name').addEventListener('focus', event => {
    event.target.blur();
    openKeyboardForInput(event.target);
  });
}

function openKeyboardForInput(input) {
  currentKeyboardInput = input;
  keyboardValue = input.value || '';
  const keyboardDisplay = document.getElementById('keyboard-display');
  keyboardDisplay.textContent = keyboardValue;
  const keyboardScreen = document.getElementById('screen-keyboard');
  keyboardScreen.classList.add('active');
}

function closeKeyboard() {
  currentKeyboardInput = null;
  const keyboardScreen = document.getElementById('screen-keyboard');
  keyboardScreen.classList.remove('active');
}

function isValidEmail(email) {
  const pattern = /.+@.+\..+/;
  return pattern.test(email);
}

function onConfirm() {
  if (!validateScreen('screen-delivery') || !validateScreen('screen-payment')) {
    return;
  }
  stopSelfie();
  const summary = document.getElementById('review-summary');
  summary.innerHTML = generateSummaryHTML();
  capturePendingReceipt();
  showConfirmModal();
}

function generateSummaryHTML() {
  const priceDetails = calculatePriceDetails();
  const priceText = priceDetails ? formatCurrency(priceDetails.total, priceDetails.currency) : 'Free';
  const backgroundSummary = escapeHtml(getBackgroundSummaryText());
  const partyName = escapeHtml(state.partyName);
  const deliveryMethod = escapeHtml(state.deliveryMethod);
  const paymentMethod = escapeHtml(state.paymentMethod);
  const previewReceipt = {
    charges: priceDetails,
    prints: state.prints,
    emailCount: state.emailCount,
    multipleBackgrounds: state.multipleBackgrounds,
    sceneCount: state.sceneCount,
    extraSceneCount: priceDetails ? priceDetails.extraSceneCount : Math.max((state.sceneCount || 0) - getIncludedSceneCount(), 0)
  };
  return `
    <h3>You're all set!</h3>
    <p><strong>Party:</strong> ${partyName}</p>
    <p><strong>${getBackgroundLabel()}:</strong> ${backgroundSummary}</p>
    <p><strong>People in photo:</strong> ${state.peopleCount}</p>
    <p><strong>Scenes:</strong> ${state.sceneCount}</p>
    <p><strong>Delivery:</strong> ${deliveryMethod}</p>
    <p><strong>Prints:</strong> ${state.prints}</p>
    <p><strong>Email count:</strong> ${state.emailCount}</p>
    <p><strong>Multi-background add-on:</strong> ${state.multipleBackgrounds ? 'Yes' : 'No'}</p>
    <p><strong>Payment:</strong> ${paymentMethod}</p>
    <p><strong>Total:</strong> ${priceText}</p>
    ${buildPriceBreakdownMarkup(previewReceipt)}
  `;
}

function capturePendingReceipt() {
  const now = new Date();
  const photoID = generatePhotoID();
  const formattedDate = now.toLocaleDateString('en-US');
  const formattedTime = now.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  const emailList = collectEmailAddresses();
  const priceDetails = calculatePriceDetails();
  const priceText = priceDetails ? formatCurrency(priceDetails.total, priceDetails.currency) : 'Free';
  const selectedBackgrounds = getSelectedBackgrounds();
  const backgroundSummary = getBackgroundSummaryText();
  const backgroundIdSummary = getBackgroundIdSummary();
  const primaryBackground = selectedBackgrounds[0] || null;

  pendingReceipt = {
    customerNumber: photoID,
    photoID,
    createdAt: now.toISOString(),
    date: formattedDate,
    time: formattedTime,
    partyName: state.partyName,
    background: backgroundSummary,
    backgroundId: backgroundIdSummary,
    backgroundImage: primaryBackground ? primaryBackground.image : '',
    backgroundSelections: selectedBackgrounds.map(item => ({ id: item.id, name: item.name })),
    customBackgroundRequest: state.customBackgroundRequest || '',
    deliveryMethod: state.deliveryMethod,
    prints: state.prints,
    emailCount: state.emailCount,
    emails: emailList,
    paymentMethod: state.paymentMethod,
    total: priceText,
    totalRaw: priceDetails ? priceDetails.total : 0,
    charges: priceDetails ? { ...priceDetails } : null,
    hotline: appConfig.hotline,
    supportEmail: appConfig.supportEmail,
    peopleCount: state.peopleCount,
    sceneCount: state.sceneCount,
    includedScenes: priceDetails ? priceDetails.includedScenes : getIncludedSceneCount(),
    extraSceneCount: priceDetails ? priceDetails.extraSceneCount : Math.max((state.sceneCount || 0) - getIncludedSceneCount(), 0),
    multipleBackgrounds: state.multipleBackgrounds
  };
}

function renderReceipt() {
  const receipt = document.getElementById('receipt-output');
  if (!pendingReceipt) return;
  const emails = pendingReceipt.emails.length
    ? pendingReceipt.emails.map(email => `<li>${escapeHtml(email)}</li>`).join('')
    : '<li>No emails requested</li>';
  const breakdownMarkup = buildPriceBreakdownMarkup(pendingReceipt);
  const multiBackgroundText = pendingReceipt.multipleBackgrounds ? 'Yes' : 'No';
  const backgroundCount = Array.isArray(pendingReceipt.backgroundSelections) ? pendingReceipt.backgroundSelections.length : 0;
  const backgroundLabel = backgroundCount > 1 ? 'Backgrounds' : 'Background';
  const backgroundIdLabel = backgroundCount > 1 ? 'Background IDs' : 'Background ID';
  const sceneCount = Number(pendingReceipt.sceneCount || 0);
  const includedScenes = Number(pendingReceipt.includedScenes || 0);
  const extraSceneCount = Number(pendingReceipt.extraSceneCount || 0);
  const sceneDisplay = extraSceneCount > 0
    ? `${sceneCount} (includes ${includedScenes}, +${extraSceneCount} extra)`
    : `${sceneCount} (included with backgrounds)`;
  const safePartyName = escapeHtml(pendingReceipt.partyName);
  const safeEventName = escapeHtml(appConfig ? appConfig.eventName : '');
  const safeDeliveryMethod = escapeHtml(pendingReceipt.deliveryMethod);
  const safePaymentMethod = escapeHtml(pendingReceipt.paymentMethod);
  const safeBackground = escapeHtml(pendingReceipt.background);
  const safeBackgroundId = escapeHtml(pendingReceipt.backgroundId);
  const customNotes = pendingReceipt.customBackgroundRequest ? escapeHtml(pendingReceipt.customBackgroundRequest) : '';
  const customerNotesMarkup = customNotes
    ? `<div class="notes-section"><p><strong>Notes:</strong> ${customNotes}</p></div>`
    : '<div class="notes-section"><p><strong>Notes:</strong> ____________________________</p></div>';
  const operatorNotesMarkup = customerNotesMarkup;

  receipt.innerHTML = `
    <section class="receipt-section">
      <h3>Customer Copy</h3>
      <p><strong>Name:</strong> ${safePartyName}</p>
      <p><strong>Event:</strong> ${safeEventName}</p>
      <p><strong>Date:</strong> ${pendingReceipt.date}</p>
      <p><strong>Time:</strong> ${pendingReceipt.time}</p>
      <p><strong>Prints:</strong> ${pendingReceipt.prints}</p>
      <p><strong>Emails:</strong> ${pendingReceipt.emailCount}</p>
      <p><strong>Delivery:</strong> ${safeDeliveryMethod}</p>
      <p><strong>Payment Method:</strong> ${safePaymentMethod}</p>
      <p><strong>Total:</strong> ${pendingReceipt.total}</p>
      <p><strong>Scenes:</strong> ${sceneDisplay}</p>
      <p><strong>Multi-background add-on:</strong> ${multiBackgroundText}</p>
      ${breakdownMarkup}
      <p><strong>Photo ID:</strong> ${pendingReceipt.photoID}</p>
      ${customerNotesMarkup}
      <p class="instruction">Come back at the end of the night to pick up your prints. If you do not receive your email within 2 business days, contact ${pendingReceipt.supportEmail}. Questions? Call ${pendingReceipt.hotline}.</p>
    </section>
    <section class="receipt-section">
      <h3>Operator Copy</h3>
      <p><strong>Name:</strong> ${safePartyName}</p>
      <p><strong>Delivery:</strong> ${safeDeliveryMethod}</p>
      <p><strong>Date:</strong> ${pendingReceipt.date}</p>
      <p><strong>Time:</strong> ${pendingReceipt.time}</p>
      <p><strong>People:</strong> ${pendingReceipt.peopleCount}</p>
      <p><strong>Scenes:</strong> ${sceneDisplay}</p>
      <p><strong>${backgroundLabel}:</strong> ${safeBackground}</p>
      <p><strong>${backgroundIdLabel}:</strong> ${safeBackgroundId}</p>
      <p><strong>Emails:</strong></p>
      <ul>${emails}</ul>
      <p><strong>Email Count:</strong> ${pendingReceipt.emailCount}</p>
      <p><strong>Prints:</strong> ${pendingReceipt.prints}</p>
      <p><strong>Total:</strong> ${pendingReceipt.total}</p>
      <p><strong>Multi-background add-on:</strong> ${multiBackgroundText}</p>
      ${breakdownMarkup}
      <div class="stamp-grid">
        <div class="stamp-area">Paid</div>
        <div class="stamp-area">Email Sent</div>
        <div class="stamp-area">Printed</div>
        <div class="stamp-area">Picked Up</div>
        <div class="stamp-area">Photo Taken</div>
      </div>
      <p><strong>Photo ID:</strong> <span class="large-photo-id">${pendingReceipt.photoID}</span></p>
      ${operatorNotesMarkup}
      ${state.selfieData ? `<img class="selfie-thumbnail" src="${state.selfieData}" alt="Customer quick selfie" />` : ''}
    </section>
  `;
}

function resetKiosk() {
  stopSelfie();
  Object.assign(state, {
    background: null,
    backgroundSource: null,
    backgroundSelections: [],
    selectedBackgroundCategory: null,
    customBackgroundRequest: '',
    partyName: '',
    peopleCount: null,
    sceneCount: null,
    deliveryMethod: null,
    prints: 0,
    emailCount: 0,
    emails: [],
    paymentMethod: null,
    selfieData: null,
    multipleBackgrounds: false
  });

  furthestProgressIndex = -1;
  closeCustomBackgroundModal();
  populateTouchSelectors();
  document.querySelectorAll('#background-grid .background-option').forEach(btn => btn.classList.remove('selected'));
  updateBackgroundOptionSelectionClasses();
  updateBackgroundPreview();
  document.querySelectorAll('.touch-selector').forEach(selector => selector.querySelectorAll('.touch-option').forEach(btn => btn.classList.remove('selected')));
  document.getElementById('party-name').value = '';
  document.getElementById('emailInputs').innerHTML = '';
  document.getElementById('review-summary').innerHTML = '';
  pendingReceipt = null;
  populateBackgrounds();
  reflectMultiBackgroundState();
  updateCustomBackgroundStatus();
  updatePricingDisplay();
  showScreen('screen-welcome');
}

function stopSelfie() {
  if (selfieStream) {
    selfieStream.getTracks().forEach(track => track.stop());
    selfieStream = null;
  }
  document.getElementById('selfie-video').classList.remove('hidden');
  document.getElementById('selfie-canvas').classList.add('hidden');
  document.getElementById('selfie-start').disabled = false;
  document.getElementById('selfie-capture').disabled = true;
  document.getElementById('selfie-retake').disabled = true;
}

function formatCurrency(amount, currency = 'USD') {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);
}

function collectEmailAddresses() {
  const container = document.getElementById('emailInputs');
  const inputs = Array.from(container.querySelectorAll('input'));
  const addresses = inputs.map(input => input.value.trim()).filter(Boolean);
  state.emails = inputs.map(input => input.value.trim());
  return addresses;
}

function getFeeValue(key, fallback) {
  if (!appConfig) {
    return fallback;
  }
  const value = Number(appConfig[key]);
  if (Number.isFinite(value) && value >= 0) {
    return value;
  }
  return fallback;
}

function calculatePriceDetails() {
  if (!appConfig) {
    return null;
  }
  const currency = appConfig.currency || 'USD';
  const basePrice = Number(appConfig.price || 0);
  const perPrintFee = getFeeValue('printFee', PRICING_DEFAULTS.printFee);
  const perEmailFee = getFeeValue('emailFee', PRICING_DEFAULTS.emailFee);
  const multiBackgroundFee = getFeeValue('multiBackgroundFee', PRICING_DEFAULTS.multiBackgroundFee);
  const sceneInfo = getScenePricingInfo();

  const prints = Math.max(Number(state.prints || 0), 0);
  const emails = Math.max(Number(state.emailCount || 0), 0);

  const printCost = prints * perPrintFee;
  const emailCost = emails * perEmailFee;
  const multiBackgroundCost = state.multipleBackgrounds ? multiBackgroundFee : 0;
  const sceneCost = sceneInfo.sceneCost;
  const total = basePrice + printCost + emailCost + multiBackgroundCost + sceneCost;

  return {
    currency,
    basePrice,
    perPrintFee,
    perEmailFee,
    multiBackgroundFee,
    extraSceneFee: sceneInfo.extraSceneFee,
    prints,
    emails,
    printCost,
    emailCost,
    multiBackgroundCost,
    sceneCount: sceneInfo.sceneCount,
    includedScenes: sceneInfo.includedScenes,
    extraSceneCount: sceneInfo.extraSceneCount,
    sceneCost,
    total
  };
}

function updatePricingDisplay() {
  if (!appConfig) {
    return;
  }
  const details = calculatePriceDetails();
  if (!details) {
    return;
  }

  const priceSource = {
    charges: details,
    prints: details.prints,
    emailCount: details.emails,
    multipleBackgrounds: state.multipleBackgrounds,
    sceneCount: details.sceneCount,
    extraSceneCount: details.extraSceneCount,
    includedScenes: details.includedScenes
  };
  const breakdownData = getPriceLineItems(priceSource);

  const headerPrice = document.getElementById('eventPrice');
  if (headerPrice) {
    if (details.basePrice) {
      headerPrice.textContent = `Starting at ${formatCurrency(details.basePrice, details.currency)}`;
    } else {
      headerPrice.textContent = 'Free Event';
    }
  }

  const welcomePrice = document.getElementById('welcome-price');
  if (welcomePrice) {
    welcomePrice.textContent = details.basePrice
      ? `Starting at ${formatCurrency(details.basePrice, details.currency)}`
      : 'Free';
  }

  const runningTotal = document.getElementById('running-total');
  if (runningTotal) {
    const totalText = details.total > 0 ? formatCurrency(details.total, details.currency) : 'Free';
    if (breakdownData) {
      const summaryParts = breakdownData.items.map(item => `${item.label} ${formatCurrency(item.amount, breakdownData.currency)}`);
      runningTotal.innerHTML = `
        <span class="running-total-heading">Current total</span>
        <span class="running-total-amount">${totalText}</span>
        <span class="running-total-breakdown">
          <span class="running-total-breakdown-label">Price breakdown:</span>
          <span class="running-total-breakdown-items">${summaryParts.join(' • ')}</span>
        </span>
      `;
    } else {
      runningTotal.textContent = `Current total: ${totalText}`;
    }
  }

  const paymentNote = document.getElementById('payment-note');
  if (paymentNote) {
    if (breakdownData) {
      paymentNote.textContent = '';
      paymentNote.classList.add('hidden');
    } else {
      paymentNote.textContent = `Total due: ${formatCurrency(details.total, details.currency)}`;
      paymentNote.classList.remove('hidden');
    }
  }

  const breakdownMarkup = breakdownData ? buildPriceBreakdownMarkupFromData(breakdownData) : '';
  ['delivery-price-summary', 'payment-price-summary'].forEach(id => {
    const container = document.getElementById(id);
    if (!container) {
      return;
    }
    container.innerHTML = breakdownMarkup;
    container.classList.toggle('has-breakdown', Boolean(breakdownMarkup));
  });

  const reviewSummary = document.getElementById('review-summary');
  if (reviewSummary && reviewSummary.innerHTML.trim()) {
    reviewSummary.innerHTML = generateSummaryHTML();
  }

  reflectMultiBackgroundState();
}

function buildPriceBreakdownMarkup(source) {
  const breakdown = getPriceLineItems(source);
  return buildPriceBreakdownMarkupFromData(breakdown);
}

function buildPriceBreakdownMarkupFromData(breakdown) {
  if (!breakdown || !Array.isArray(breakdown.items)) {
    return '';
  }
  const lines = breakdown.items.map(item =>
    priceBreakdownLine(item.label, item.amount, breakdown.currency, { detail: item.detail })
  );
  lines.push(priceBreakdownLine('Total', breakdown.total, breakdown.currency, { isTotal: true }));
  return `<div class="price-breakdown"><p class="price-breakdown-label">Price breakdown:</p><ul>${lines.join('')}</ul></div>`;
}

function priceBreakdownLine(label, amount, currency, options = {}) {
  const { detail = '', isTotal = false } = options;
  const formattedAmount = formatCurrency(Number(amount || 0), currency);
  const classNames = ['price-breakdown-line'];
  if (isTotal) {
    classNames.push('total');
  }
  const detailMarkup = detail ? ` <span class="price-breakdown-detail">${detail}</span>` : '';
  return `<li class="${classNames.join(' ')}"><span class="price-breakdown-line-label">${label}${detailMarkup}</span><span class="price-breakdown-amount">${formattedAmount}</span></li>`;
}

function getPriceLineItems(source) {
  if (!source || !source.charges) {
    return null;
  }
  const { charges } = source;
  const currency = charges.currency || (appConfig && appConfig.currency) || 'USD';
  const prints = Number(source.prints ?? charges.prints ?? 0);
  const emails = Number(source.emailCount ?? charges.emails ?? 0);
  const sceneCount = Number(charges.sceneCount ?? source.sceneCount ?? 0);
  const includedScenes = Number(charges.includedScenes ?? source.includedScenes ?? 0);
  const extraSceneCount = Number(charges.extraSceneCount ?? source.extraSceneCount ?? 0);
  const extraSceneFee = Number(charges.extraSceneFee ?? getFeeValue('extraSceneFee', PRICING_DEFAULTS.extraSceneFee));
  const perPrintFee = Number(charges.perPrintFee ?? getFeeValue('printFee', PRICING_DEFAULTS.printFee));
  const perEmailFee = Number(charges.perEmailFee ?? getFeeValue('emailFee', PRICING_DEFAULTS.emailFee));
  const baseAmount = Number(charges.basePrice || 0);
  const multiAmount = Number(charges.multiBackgroundCost || 0);
  const multiFee = Number(charges.multiBackgroundFee ?? getFeeValue('multiBackgroundFee', PRICING_DEFAULTS.multiBackgroundFee));
  const multiSelected = multiAmount > 0 || Boolean(source.multipleBackgrounds);
  const sceneCost = Number(charges.sceneCost || 0);
  const printCost = Number(charges.printCost || 0);
  const emailCost = Number(charges.emailCost || 0);

  const baseDetail = includedScenes > 0
    ? `${includedScenes} scene${includedScenes === 1 ? '' : 's'} included`
    : 'No scenes included';
  const multiDetail = multiSelected
    ? `Selected (${formatCurrency(multiFee, currency)})`
    : `Not selected (${formatCurrency(multiFee, currency)})`;
  const sceneDetail = extraSceneCount > 0
    ? `${extraSceneCount} extra × ${formatCurrency(extraSceneFee, currency)}`
    : '0 extra scenes';
  const printDetail = `${prints} × ${formatCurrency(perPrintFee, currency)}`;
  const emailDetail = `${emails} × ${formatCurrency(perEmailFee, currency)}`;

  return {
    currency,
    total: Number(charges.total || 0),
    items: [
      { key: 'base', label: 'Base', amount: baseAmount, detail: baseDetail },
      { key: 'multi', label: 'Multi-background', amount: multiAmount, detail: multiDetail },
      { key: 'scenes', label: 'Scenes (extra)', amount: sceneCost, detail: sceneDetail },
      { key: 'prints', label: 'Prints (extra)', amount: printCost, detail: printDetail },
      { key: 'emails', label: 'Emails (extra)', amount: emailCost, detail: emailDetail }
    ]
  };
}

function showConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  modal.classList.remove('hidden');
}

function hideConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  modal.classList.add('hidden');
}

function finalizeTransaction() {
  hideConfirmModal();
  if (!pendingReceipt) return;
  renderReceipt();
  const receiptRecord = {
    customerNumber: pendingReceipt.photoID,
    name: pendingReceipt.partyName,
    payment: pendingReceipt.paymentMethod,
    emailCount: pendingReceipt.emailCount,
    prints: pendingReceipt.prints,
    photoID: pendingReceipt.photoID,
    status: {
      paid: false,
      emailed: false,
      printed: false,
      pickedUp: false,
      photoTaken: Boolean(state.selfieData)
    },
    delivery: pendingReceipt.deliveryMethod,
    emails: pendingReceipt.emails,
    total: pendingReceipt.total,
    totalRaw: pendingReceipt.totalRaw,
    charges: pendingReceipt.charges,
    multipleBackgrounds: pendingReceipt.multipleBackgrounds,
    customBackgroundRequest: pendingReceipt.customBackgroundRequest,
    createdAt: pendingReceipt.createdAt,
    people: pendingReceipt.peopleCount,
    sceneCount: pendingReceipt.sceneCount,
    extraSceneCount: pendingReceipt.extraSceneCount,
    selfieData: state.selfieData || null
  };
  logTransaction(receiptRecord);
  sendEmails(pendingReceipt.emails);
  showScreen('screen-receipt');
}

function logTransaction(receipt) {
  const existing = JSON.parse(localStorage.getItem('records') || '[]');
  existing.push(receipt);
  localStorage.setItem('records', JSON.stringify(existing));

  const blob = new Blob([JSON.stringify(existing, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'records.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
}

function sendEmails(addresses) {
  addresses.forEach(email => {
    console.log(`Email sent to ${email}`);
  });
}

function getNextPhotoIdFromStorage() {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  const stored = window.localStorage.getItem(PHOTO_ID_STORAGE_KEY);
  const parsed = stored ? Number.parseInt(stored, 10) : NaN;
  if (Number.isFinite(parsed)) {
    return parsed;
  }

  window.localStorage.removeItem(PHOTO_ID_STORAGE_KEY);
  return null;
}

function persistNextPhotoId(value) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(PHOTO_ID_STORAGE_KEY, String(value));
}

function getNextPhotoId() {
  if (nextPhotoIdCache == null) {
    const stored = getNextPhotoIdFromStorage();
    nextPhotoIdCache = Number.isFinite(stored) ? stored : 1000;
  }
  return nextPhotoIdCache;
}

function incrementPhotoId() {
  nextPhotoIdCache = getNextPhotoId() + 1;
  persistNextPhotoId(nextPhotoIdCache);
}

function generatePhotoID() {
  const nextId = getNextPhotoId();
  incrementPhotoId();
  return nextId;
}

function updateProgress(targetId) {
  const indicator = document.getElementById('progress-indicator');
  if (!indicator) {
    return;
  }

  const steps = indicator.querySelectorAll('.progress-step');
  const status = indicator.querySelector('.progress-status');
  const totalSteps = progressScreens.length;
  const activeIndex = progressScreens.indexOf(targetId);
  const isReceipt = targetId === 'screen-receipt';
  const highlightIndex = !isReceipt && activeIndex === -1 ? 0 : activeIndex;

  if (status) {
    if (activeIndex !== -1) {
      status.textContent = `Step ${activeIndex + 1} of ${totalSteps}`;
    } else if (isReceipt) {
      status.textContent = 'Receipt ready';
    } else {
      status.textContent = `Step 1 of ${totalSteps}`;
    }
  }

  steps.forEach(step => {
    const stepIndex = Number(step.dataset.index);
    const isActive = stepIndex === highlightIndex && !isReceipt;
    const isComplete = stepIndex < furthestProgressIndex || (isReceipt && stepIndex === furthestProgressIndex);
    const shouldForceEnable = highlightIndex === stepIndex && activeIndex === -1 && !isReceipt;
    step.classList.toggle('is-active', isActive);
    step.classList.toggle('is-complete', isComplete && !isActive);
    step.disabled = shouldForceEnable ? false : stepIndex > furthestProgressIndex;
    step.setAttribute('aria-current', isActive ? 'step' : 'false');
  });
}

function getBackgroundImage(background) {
  const gradient = backgroundGradients[background.id];
  if (gradient) {
    return gradient;
  }
  const file = background.file || '';
  if (!file) return gradient || '';
  const imagePath = file.startsWith('http') ? file : `./assets/backgrounds/${file}`;
  return `url(${imagePath})`;
}

function setupIdleTimer() {
  const idleModal = document.getElementById('idle-modal');
  if (!idleModal) {
    return;
  }
  ['click', 'touchstart', 'keydown', 'pointerdown'].forEach(eventName => {
    document.addEventListener(eventName, resetIdleTimer, { passive: true });
  });
  resetIdleTimer();
}

function resetIdleTimer() {
  const activeScreen = screenOrder[currentScreenIndex];
  if (activeScreen === 'screen-welcome') {
    if (idlePromptVisible) {
      hideIdlePrompt();
    }
    clearTimeout(idleTimeoutId);
    idleTimeoutId = null;
    return;
  }
  if (idlePromptVisible) {
    hideIdlePrompt();
  }
  clearTimeout(idleTimeoutId);
  idleTimeoutId = setTimeout(showIdlePrompt, IDLE_TIMEOUT);
}

function showIdlePrompt() {
  const idleModal = document.getElementById('idle-modal');
  if (!idleModal) {
    return;
  }
  idlePromptVisible = true;
  idleModal.classList.remove('hidden');
  let remaining = IDLE_PROMPT_DURATION / 1000;
  updateIdleCountdown(remaining);
  clearInterval(idleCountdownInterval);
  idleCountdownInterval = setInterval(() => {
    remaining -= 1;
    updateIdleCountdown(Math.max(remaining, 0));
    if (remaining <= 0) {
      clearInterval(idleCountdownInterval);
      idleCountdownInterval = null;
    }
  }, 1000);
  clearTimeout(idlePromptTimeoutId);
  idlePromptTimeoutId = setTimeout(() => {
    hideIdlePrompt();
    resetKiosk();
  }, IDLE_PROMPT_DURATION);
}

function hideIdlePrompt() {
  const idleModal = document.getElementById('idle-modal');
  if (!idleModal) {
    return;
  }
  idleModal.classList.add('hidden');
  idlePromptVisible = false;
  clearTimeout(idlePromptTimeoutId);
  idlePromptTimeoutId = null;
  clearInterval(idleCountdownInterval);
  idleCountdownInterval = null;
}

function updateIdleCountdown(value) {
  const countdown = document.getElementById('idle-countdown');
  if (countdown) {
    countdown.textContent = `${value}`;
  }
}

window.addEventListener('DOMContentLoaded', loadConfig);
