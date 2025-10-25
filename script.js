const screenOrder = [
  'screen-welcome',
  'screen-background',
  'screen-party',
  'screen-selfie',
  'screen-delivery',
  'screen-payment',
  'screen-review',
  'screen-receipt'
];

const progressScreens = [
  'screen-background',
  'screen-party',
  'screen-selfie',
  'screen-delivery',
  'screen-payment',
  'screen-review'
];

const progressLabels = {
  'screen-background': 'Background',
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
  customBackgroundData: null,
  partyName: '',
  peopleCount: null,
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
  multiBackgroundFee: 10
};

let currentScreenIndex = 0;
let currentKeyboardInput = null;
let keyboardValue = '';
let selfieStream = null;
let appConfig = null;
let pendingReceipt = null;
let furthestProgressIndex = -1;

const backgroundGradients = {
  'fsu-garnet': 'linear-gradient(135deg, #782F40, #9b4a54 55%, #CEB888)',
  'fsu-gold': 'linear-gradient(135deg, #CEB888, #fff1c1)',
  'fsu-spear': 'linear-gradient(140deg, #782F40 15%, #CEB888 85%)',
  'fsu-campus': 'linear-gradient(160deg, #1c2b4a, #782F40)',
  'fsu-stadium': 'linear-gradient(135deg, #0f1a30, #782F40 65%, #CEB888)',
  'fsu-warpath': 'linear-gradient(135deg, #782F40, #a63d40 60%, #CEB888)',
  'fsu-torch': 'linear-gradient(140deg, #ffb347 10%, #CEB888 55%, #782F40)',
  'fsu-heritage': 'linear-gradient(135deg, #1f2235, #782F40 55%, #CEB888)',
  'nature-forest': 'linear-gradient(135deg, #0b3d20, #2d6a4f)',
  'nature-ocean': 'linear-gradient(135deg, #0077b6, #00b4d8)',
  'nature-mountain': 'linear-gradient(135deg, #355070, #6d597a)',
  'nature-garden': 'linear-gradient(135deg, #6a994e, #a7c957)',
  'retro-grid': 'linear-gradient(135deg, #ff0080, #7928ca)',
  'city-night': 'linear-gradient(135deg, #0f2027, #203a43 60%, #2c5364)',
  neon: 'linear-gradient(135deg, #2d1b69, #f72585)',
  cosmic: 'linear-gradient(135deg, #120078, #9d0191)',
  beach: 'linear-gradient(135deg, #ffb347, #ffcc33)',
  stage: 'linear-gradient(135deg, #414141, #000000)'
};

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
      if (state.multipleBackgrounds) {
        if (state.backgroundSelections.length < 2) {
          alert('Please select two backgrounds to continue.');
          return false;
        }
      } else if (!state.background) {
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
  populateBackgrounds();
  setupBackgroundAddons();
  populateTouchSelectors();
  setupCustomBackground();
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
  updateProgress('screen-welcome');
}

function setupNavigation() {
  document.getElementById('start-btn').addEventListener('click', () => showScreen('screen-background'));
  document.querySelectorAll('[data-next]').forEach(btn => btn.addEventListener('click', goToNextScreen));
  document.querySelectorAll('[data-prev]').forEach(btn => btn.addEventListener('click', goToPreviousScreen));
}

function populateEventInfo() {
  const eventName = document.getElementById('event-name');
  if (eventName) {
    eventName.textContent = `${appConfig.eventName}`;
  }
  const headerName = document.getElementById('eventName');
  headerName.textContent = appConfig.eventName;
  const eventTagline = document.getElementById('eventTagline');
  if (eventTagline) {
    const taglineText =
      typeof appConfig.tagline === 'string' ? appConfig.tagline.trim() : '';
    eventTagline.textContent = taglineText;
    eventTagline.classList.toggle('hidden', !taglineText);
  }
  const priceInfo = document.getElementById('price-info');
  const headerPrice = document.getElementById('eventPrice');
  const baseFormatted = formatCurrency(Number(appConfig.price || 0), appConfig.currency);
  const printFeeText = formatCurrency(getFeeValue('printFee', PRICING_DEFAULTS.printFee), appConfig.currency);
  const emailFeeText = formatCurrency(getFeeValue('emailFee', PRICING_DEFAULTS.emailFee), appConfig.currency);
  const multiFeeText = formatCurrency(getFeeValue('multiBackgroundFee', PRICING_DEFAULTS.multiBackgroundFee), appConfig.currency);

  if (!appConfig.price) {
    priceInfo.textContent = `Today only: Free photo session! Add-ons: prints ${printFeeText} each, emails ${emailFeeText} each, multi-background add-on ${multiFeeText}.`;
    headerPrice.textContent = 'Free Event';
  } else {
    priceInfo.textContent = `Base package: ${baseFormatted}. Prints add ${printFeeText} each, emails add ${emailFeeText} each, multi-background add-on ${multiFeeText}.`;
    headerPrice.textContent = `Starting at ${baseFormatted}`;
  }

  updatePricingDisplay();
}

function populateBackgrounds() {
  const template = document.getElementById('background-option-template');
  const grid = document.getElementById('background-grid');
  grid.innerHTML = '';
  appConfig.backgrounds.forEach((background, index) => {
    const option = template.content.firstElementChild.cloneNode(true);
    option.style.backgroundImage = getBackgroundImage(background);
    option.querySelector('.label').textContent = background.name;
    option.title = `Tap to choose ${background.name}`;
    const optionId = background.id || `background-${index}`;
    option.dataset.backgroundId = optionId;
    option.addEventListener('click', () => selectBackground(background, optionId));
    grid.appendChild(option);
  });

  updateBackgroundOptionSelectionClasses();
  updateBackgroundPreview();
}

function selectBackground(background, optionId) {
  const backgroundImage = getBackgroundImage(background);
  const selectionId = optionId || background.id || background.name || 'custom';
  const selection = { ...background, id: selectionId, image: backgroundImage };

  state.backgroundSource = 'preset';
  state.customBackgroundData = null;

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
}

function updateBackgroundOptionSelectionClasses() {
  const selectedIds = new Set(state.backgroundSelections.map(item => item.id));
  document.querySelectorAll('.background-option').forEach(btn => {
    const id = btn.dataset.backgroundId;
    btn.classList.toggle('selected', selectedIds.has(id));
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

  preview.classList.toggle('multi', state.multipleBackgrounds);

  if (primarySlot) {
    if (firstSelection) {
      primarySlot.style.backgroundImage = firstSelection.image;
      primarySlot.textContent = '';
    } else {
      primarySlot.style.backgroundImage = '';
      primarySlot.textContent = 'Choose a background';
    }
  }

  if (secondarySlot) {
    if (state.multipleBackgrounds) {
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
  const selections = getSelectedBackgrounds();
  if (selections.length) {
    return selections.map(item => item.name).join(' + ');
  }
  if (state.customBackgroundData) {
    return 'Custom Background';
  }
  return 'Not selected';
}

function getBackgroundIdSummary() {
  const selections = getSelectedBackgrounds();
  if (selections.length) {
    return selections.map(item => item.id || 'custom').join(', ');
  }
  if (state.customBackgroundData) {
    return 'custom';
  }
  return 'none';
}

function getBackgroundLabel() {
  return getSelectedBackgrounds().length > 1 ? 'Backgrounds' : 'Background';
}

function populateTouchSelectors() {
  createTouchSelector(
    document.getElementById('people-count'),
    buildRange(1, 8),
    value => `${value}`,
    value => {
      state.peopleCount = Number(value);
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
    value => value,
    value => {
      state.paymentMethod = value;
    }
  );
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
    btn.textContent = labelFormatter(value);
    btn.addEventListener('click', () => {
      container.querySelectorAll('.touch-option').forEach(option => option.classList.remove('selected'));
      btn.classList.add('selected');
      onSelect(value);
    });
    container.appendChild(btn);
  });
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
  updateBackgroundOptionSelectionClasses();
  updateBackgroundPreview();
}

function setupCustomBackground() {
  const helpButton = document.getElementById('custom-background-help');
  const modal = document.getElementById('custom-background-modal');
  const modalClose = document.getElementById('modal-close');
  const fileInput = document.getElementById('custom-background-input');
  const useButton = document.getElementById('custom-background-use');
  if (!helpButton || !modal || !modalClose || !fileInput || !useButton) {
    return;
  }
  useButton.disabled = true;

  helpButton.addEventListener('click', () => modal.classList.remove('hidden'));
  modalClose.addEventListener('click', () => modal.classList.add('hidden'));
  modal.addEventListener('click', event => {
    if (event.target === modal) {
      modal.classList.add('hidden');
    }
  });

  fileInput.addEventListener('change', event => {
    const file = event.target.files[0];
    if (!file) {
      useButton.disabled = true;
      return;
    }
    const reader = new FileReader();
    reader.onload = e => {
      state.customBackgroundData = e.target.result;
      useButton.disabled = false;
    };
    reader.readAsDataURL(file);
  });

  useButton.addEventListener('click', () => {
    if (!state.customBackgroundData) return;
    document.querySelectorAll('.background-option').forEach(btn => btn.classList.remove('selected'));
    state.background = {
      id: 'custom',
      name: 'Custom Background',
      image: `url(${state.customBackgroundData})`
    };
    state.backgroundSource = 'custom';
    state.backgroundSelections = [state.background];
    state.multipleBackgrounds = false;
    updatePricingDisplay();
    alert('Custom background ready!');
  });
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
  const previewReceipt = {
    charges: priceDetails,
    prints: state.prints,
    emailCount: state.emailCount,
    multipleBackgrounds: state.multipleBackgrounds
  };
  return `
    <h3>You're all set!</h3>
    <p><strong>Party:</strong> ${state.partyName}</p>
    <p><strong>${getBackgroundLabel()}:</strong> ${getBackgroundSummaryText()}</p>
    <p><strong>People in photo:</strong> ${state.peopleCount}</p>
    <p><strong>Delivery:</strong> ${state.deliveryMethod}</p>
    <p><strong>Prints:</strong> ${state.prints}</p>
    <p><strong>Email count:</strong> ${state.emailCount}</p>
    <p><strong>Multi-background add-on:</strong> ${state.multipleBackgrounds ? 'Yes' : 'No'}</p>
    <p><strong>Payment:</strong> ${state.paymentMethod}</p>
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
    multipleBackgrounds: state.multipleBackgrounds
  };
}

function renderReceipt() {
  const receipt = document.getElementById('receipt-output');
  if (!pendingReceipt) return;
  const emails = pendingReceipt.emails.length ? pendingReceipt.emails.map(email => `<li>${email}</li>`).join('') : '<li>No emails requested</li>';
  const breakdownMarkup = buildPriceBreakdownMarkup(pendingReceipt);
  const multiBackgroundText = pendingReceipt.multipleBackgrounds ? 'Yes' : 'No';
  const backgroundCount = Array.isArray(pendingReceipt.backgroundSelections) ? pendingReceipt.backgroundSelections.length : 0;
  const backgroundLabel = backgroundCount > 1 ? 'Backgrounds' : 'Background';
  const backgroundIdLabel = backgroundCount > 1 ? 'Background IDs' : 'Background ID';

  receipt.innerHTML = `
    <section class="receipt-section">
      <h3>Customer Copy</h3>
      <p><strong>Name:</strong> ${pendingReceipt.partyName}</p>
      <p><strong>Event:</strong> ${appConfig.eventName}</p>
      <p><strong>Date:</strong> ${pendingReceipt.date}</p>
      <p><strong>Time:</strong> ${pendingReceipt.time}</p>
      <p><strong>Prints:</strong> ${pendingReceipt.prints}</p>
      <p><strong>Emails:</strong> ${pendingReceipt.emailCount}</p>
      <p><strong>Delivery:</strong> ${pendingReceipt.deliveryMethod}</p>
      <p><strong>Payment Method:</strong> ${pendingReceipt.paymentMethod}</p>
      <p><strong>Total:</strong> ${pendingReceipt.total}</p>
      <p><strong>Multi-background add-on:</strong> ${multiBackgroundText}</p>
      ${breakdownMarkup}
      <p><strong>Photo ID:</strong> ${pendingReceipt.photoID}</p>
      <div class="stamp-grid">
        <div class="stamp-area">Paid</div>
        <div class="stamp-area">Email Sent</div>
        <div class="stamp-area">Printed</div>
        <div class="stamp-area">Picked Up</div>
        <div class="stamp-area">Photo Taken</div>
      </div>
      <div class="notes-section">
        <p><strong>Notes:</strong> ____________________________</p>
      </div>
      <p class="instruction">Come back at the end of the night to pick up your prints. If you do not receive your email within 2 business days, contact ${pendingReceipt.supportEmail}. Questions? Call ${pendingReceipt.hotline}.</p>
    </section>
    <section class="receipt-section">
      <h3>Operator Copy</h3>
      <p><strong>Name:</strong> ${pendingReceipt.partyName}</p>
      <p><strong>Delivery:</strong> ${pendingReceipt.deliveryMethod}</p>
      <p><strong>Date:</strong> ${pendingReceipt.date}</p>
      <p><strong>Time:</strong> ${pendingReceipt.time}</p>
      <p><strong>People:</strong> ${pendingReceipt.peopleCount}</p>
      <p><strong>${backgroundLabel}:</strong> ${pendingReceipt.background}</p>
      <p><strong>${backgroundIdLabel}:</strong> ${pendingReceipt.backgroundId}</p>
      <p><strong>Emails:</strong></p>
      <ul>${emails}</ul>
      <p><strong>Email Count:</strong> ${pendingReceipt.emailCount}</p>
      <p><strong>Prints:</strong> ${pendingReceipt.prints}</p>
      <p><strong>Total:</strong> ${pendingReceipt.total}</p>
      <p><strong>Multi-background add-on:</strong> ${multiBackgroundText}</p>
      ${breakdownMarkup}
      <p><strong>Photo ID:</strong> <span class="large-photo-id">${pendingReceipt.photoID}</span></p>
      <div class="notes-section">
        <p><strong>Notes:</strong> ____________________________</p>
      </div>
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
    customBackgroundData: null,
    partyName: '',
    peopleCount: null,
    deliveryMethod: null,
    prints: 0,
    emailCount: 0,
    emails: [],
    paymentMethod: null,
    selfieData: null,
    multipleBackgrounds: false
  });

  furthestProgressIndex = -1;
  document.querySelectorAll('.background-option').forEach(btn => btn.classList.remove('selected'));
  updateBackgroundOptionSelectionClasses();
  updateBackgroundPreview();
  document.querySelectorAll('.touch-selector').forEach(selector => selector.querySelectorAll('.touch-option').forEach(btn => btn.classList.remove('selected')));
  document.getElementById('party-name').value = '';
  document.getElementById('emailInputs').innerHTML = '';
  document.getElementById('review-summary').innerHTML = '';
  document.getElementById('custom-background-input').value = '';
  document.getElementById('custom-background-use').disabled = true;
  pendingReceipt = null;
  reflectMultiBackgroundState();
  updatePricingDisplay();
  updateProgress('screen-welcome');
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

  const prints = Math.max(Number(state.prints || 0), 0);
  const emails = Math.max(Number(state.emailCount || 0), 0);

  const printCost = prints * perPrintFee;
  const emailCost = emails * perEmailFee;
  const multiBackgroundCost = state.multipleBackgrounds ? multiBackgroundFee : 0;
  const total = basePrice + printCost + emailCost + multiBackgroundCost;

  return {
    currency,
    basePrice,
    perPrintFee,
    perEmailFee,
    multiBackgroundFee,
    prints,
    emails,
    printCost,
    emailCost,
    multiBackgroundCost,
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

  const headerPrice = document.getElementById('eventPrice');
  if (headerPrice) {
    if (details.basePrice) {
      headerPrice.textContent = `Starting at ${formatCurrency(details.basePrice, details.currency)}`;
    } else {
      headerPrice.textContent = 'Free Event';
    }
  }

  const priceInfo = document.getElementById('price-info');
  if (priceInfo) {
    const priceMessage = appConfig.price
      ? `Base package: ${formatCurrency(details.basePrice, details.currency)}. Prints add ${formatCurrency(details.perPrintFee, details.currency)} each, emails add ${formatCurrency(details.perEmailFee, details.currency)} each, multi-background add-on ${formatCurrency(details.multiBackgroundFee, details.currency)}.`
      : `Today only: Free photo session! Add-ons: prints ${formatCurrency(details.perPrintFee, details.currency)} each, emails ${formatCurrency(details.perEmailFee, details.currency)} each, multi-background add-on ${formatCurrency(details.multiBackgroundFee, details.currency)}.`;
    priceInfo.textContent = priceMessage;
  }

  const runningTotal = document.getElementById('running-total');
  if (runningTotal) {
    const totalText = details.total > 0 ? formatCurrency(details.total, details.currency) : 'Free';
    const breakdownParts = [];
    if (details.basePrice > 0) {
      breakdownParts.push(`Base package ${formatCurrency(details.basePrice, details.currency)}`);
    }
    if (details.prints > 0) {
      breakdownParts.push(`${details.prints} print${details.prints === 1 ? '' : 's'} ${formatCurrency(details.printCost, details.currency)}`);
    }
    if (details.emails > 0) {
      breakdownParts.push(`${details.emails} email${details.emails === 1 ? '' : 's'} ${formatCurrency(details.emailCost, details.currency)}`);
    }
    if (state.multipleBackgrounds) {
      breakdownParts.push(`Multi-background ${formatCurrency(details.multiBackgroundCost, details.currency)}`);
    }
    runningTotal.textContent = breakdownParts.length
      ? `Current total: ${totalText} (${breakdownParts.join(' + ')})`
      : `Current total: ${totalText}`;
  }

  const paymentNote = document.getElementById('payment-note');
  if (paymentNote) {
    const extras = [];
    extras.push(`Base package ${formatCurrency(details.basePrice, details.currency)}`);
    if (details.prints > 0) {
      extras.push(`${details.prints} print${details.prints === 1 ? '' : 's'} = ${formatCurrency(details.printCost, details.currency)}`);
    } else {
      extras.push(`${formatCurrency(details.perPrintFee, details.currency)} per print`);
    }
    if (details.emails > 0) {
      extras.push(`${details.emails} email${details.emails === 1 ? '' : 's'} = ${formatCurrency(details.emailCost, details.currency)}`);
    } else {
      extras.push(`${formatCurrency(details.perEmailFee, details.currency)} per email`);
    }
    extras.push(state.multipleBackgrounds
      ? `Multi-background add-on = ${formatCurrency(details.multiBackgroundCost, details.currency)}`
      : `Add-on available for ${formatCurrency(details.multiBackgroundFee, details.currency)}`);
    paymentNote.textContent = `Current total: ${formatCurrency(details.total, details.currency)}. ${extras.join(' • ')}`;
  }

  const reviewSummary = document.getElementById('review-summary');
  if (reviewSummary && reviewSummary.innerHTML.trim()) {
    reviewSummary.innerHTML = generateSummaryHTML();
  }

  reflectMultiBackgroundState();
}

function buildPriceBreakdownMarkup(source) {
  if (!source || !source.charges) {
    return '';
  }
  const { charges } = source;
  const currency = charges.currency || (appConfig && appConfig.currency) || 'USD';
  const prints = Number(source.prints || 0);
  const emails = Number(source.emailCount || 0);
  const multiSelected = Boolean(source.multipleBackgrounds);

  const lines = [
    priceBreakdownLine('Base package', charges.basePrice, currency),
    priceBreakdownLine(`Prints (${prints} × ${formatCurrency(charges.perPrintFee, currency)})`, charges.printCost, currency),
    priceBreakdownLine(`Emails (${emails} × ${formatCurrency(charges.perEmailFee, currency)})`, charges.emailCost, currency)
  ];

  const multiLabel = multiSelected ? 'Multi-background add-on' : 'Multi-background add-on (not selected)';
  const multiAmount = multiSelected ? charges.multiBackgroundCost : 0;
  lines.push(priceBreakdownLine(multiLabel, multiAmount, currency));
  lines.push(priceBreakdownLine('Total', charges.total, currency, true));

  return `<div class="price-breakdown"><h4>Price Breakdown</h4><ul>${lines.join('')}</ul></div>`;
}

function priceBreakdownLine(label, amount, currency, isTotal = false) {
  const formattedAmount = formatCurrency(Number(amount || 0), currency);
  return `<li${isTotal ? ' class="total"' : ''}><span>${label}</span><span>${formattedAmount}</span></li>`;
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
    createdAt: pendingReceipt.createdAt,
    people: pendingReceipt.peopleCount,
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

function generatePhotoID() {
  return Math.floor(1000 + Math.random() * 9000);
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
    const isActive = stepIndex === activeIndex && !isReceipt;
    const isComplete = stepIndex < furthestProgressIndex || (isReceipt && stepIndex === furthestProgressIndex);
    step.classList.toggle('is-active', isActive);
    step.classList.toggle('is-complete', isComplete && !isActive);
    step.disabled = stepIndex > furthestProgressIndex;
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
