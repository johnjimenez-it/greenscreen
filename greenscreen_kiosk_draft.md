# Green Screen Photo Kiosk – Draft Design

## 1. Vision & Experience Principles
- **Fun-first impression:** every screen uses large imagery, playful gradients, and rounded cards to convey a party-friendly tone while remaining ADA compliant.
- **Touch-first ergonomics:** all actionable elements exceed 44×44 px and avoid keyboard usage unless text entry is unavoidable.
- **Guided simplicity:** the flow uses breadcrumbs, progress indicators, and contextual helper bubbles so guests can finish in under two minutes without assistance.
- **Single-language clarity:** all copy is in plain English with short verbs and confirmation icons for universal recognition.

## 2. Primary User Flow
1. **Welcome / Event Branding**
   - Displays event name from config, looping background video, and “Start Photo Session” button.
   - Secondary buttons: “Operator Tools” (PIN locked), “Accessibility Options” (toggle high contrast / audio prompts).
2. **Party Name Entry**
   - Step indicator shows “1 of 7”.
   - Guests enter party name via large on-screen keyboard (predictive chips of common prefixes).
   - Inline validation prevents empty submissions; “Done” advances automatically.
3. **Guest Count**
   - Step indicator updates to “2 of 7”.
   - Quick selector for number of people (1–10 chips, plus “More” to open keypad to the configured maximum).
   - Accessibility cue announces the selected count aloud when audio prompts enabled.
4. **Background Selection**
   - Carousel of backgrounds sourced from config file with thumbnail preview, category chips (e.g., “Winter Magic”).
   - “Custom Background?” card explains USB upload / QR instructions; selecting opens instructions modal and allows operator scan.
   - Live preview window shows user silhouette overlay with chosen background.
5. **Delivery & Prints**
   - Toggle between “Digital” and “Prints”.
   - For digital: slider to choose emails (1 to max), each email field displayed sequentially with domain suggestions and microphone icon for voice dictation.
   - For prints: stepper control with max defined in config, cost updates in real time.
   - Summary chip shows running subtotal (price × quantity) pulled from pricing table.
6. **Payment Method**
   - Grid of payment cards (cash, tap to pay, debit, credit) filtered by config; selecting one reveals contextual instructions (e.g., “Hold near reader when prompted”).
   - If price is $0, auto-selects “No Payment Required” but still includes stamp placeholder on receipt.
7. **Review & Confirm**
   - Card list summarizing Party, Background, Delivery, Prints, Payment, Total.
   - “Retake Details” button for each section, “Take Identification Photo” optional but encouraged (uses embedded webcam with capture + retake).
   - “Confirm & Continue” triggers capture workflow with on-screen countdown.
8. **Capture & Approval**
   - Large viewfinder, progress ring, and instructions to look at main camera.
   - After capture: preview with “Retake” / “Looks Great”.
   - Confirmation screen shows processing animation, digital delivery status, and print pickup instructions.
9. **Receipt & Finish**
   - Split-screen receipt view: customer copy stylized, operator copy plain text.
   - “Print Receipt” button, plus QR code and “Email Receipt” toggle (optional if payment requires record).
   - Step-by-step instructions for pickup, contact, and confirmation of digital delivery timeline.

## 3. Configurable Elements (External Config File)
- `event_name`
- `backgrounds` array with `id`, `thumbnail_path`, `display_name`, optional `category`.
- `pricing` object mapping `prints`, `emails` to costs; allows free flag.
- `payment_methods` list (subset of {cash, tap_to_pay, debit, credit, none}).
- `delivery_methods` list (digital, print, both) including maximum counts.
- `max_prints`, `max_emails` integers.
- `operator_contact` info (support email, hotline number).
- `custom_background_instructions` text or media reference.
- `stamp_labels` (Paid, Email Sent, Prints Ready, Picked Up, Photo Taken) for receipts.

Config is validated on boot; kiosk displays maintenance screen if invalid.

## 4. Screen-specific UI & Copy Guidelines
### 4.1 Welcome Screen
- Large “Tap to Start” bubble; subtext: “Create your green screen photo in 3 fun steps.”
- Idle mode cycles through backgrounds with event branding overlay.
- Accessibility toggle persists session-wide.

### 4.2 Party Name Entry
- On-screen keyboard: QWERTY layout with chunky keys, backspace, clear, and “Done”.
- Inline validation prevents empty party names; helper text appears beneath field.
- Predictive chips surface common prefixes (e.g., “The”, “Team”).

### 4.3 Guest Count
- Number-of-people chips with emoji icons for quick comprehension.
- Chips support swipeable carousel for large parties; “More” opens keypad entry.
- Audio prompt reads back the chosen count when accessibility mode is active.

### 4.4 Background Selection
- Grid with 3 columns, big previews, selected state adds glow border.
- Preview area updates instantly, with optional ambient animation.
- “Custom Background” instructions include: plug in USB with PNG/JPG, or scan QR to upload; operator confirmation required before continuing.

### 4.5 Delivery & Prints
- Delivery toggle defaults to both digital + print if price allows.
- Email entry uses stacked cards labelled Email #1, Email #2, etc.
- A speech bubble explains digital delivery timeframe (configurable text).
- Print count uses +/- buttons with large numbers and feedback.

### 4.6 Payment
- Payment cards show icon + label. Disabled methods appear greyed with tooltip “Unavailable for this event”.
- If cash is selected, instructions display: “Present payment to attendant now.” Tap to pay shows: “Hold your card or phone near the reader.”
- Credit/debit selection integrates with payment terminal (out of scope but placeholder instructions).

### 4.7 Review
- Summary arranged as checklist; each row has “Edit” button returning to relevant step.
- Consent checkbox acknowledging Terms (if required) with link to PDF.
- Capture photo button initiates countdown overlay (3…2…1).

### 4.8 Receipt Screen
- **Customer Copy (Left):**
  - Party name, Event name, Date & Time (auto).
  - Payment method, totals, number of prints/emails.
  - Stamp boxes labelled Paid / Prints Picked Up / Prints Ready / Email Sent / Photo Taken.
  - Instruction text: “Pick up prints after 9 PM at the photo desk.” (from config).
  - Support block: email, hotline, “If you don’t receive your email within 2 business days…”
  - Customer number in bold (e.g., `C-1042`).
- **Operator Copy (Right):**
  - Tabular list: Customer name, Delivery method, Date/Time, Number of people, Background ID, Print count, Email count, Individual emails.
  - Notes field (lined area) plus large photo number (e.g., `Photo #1042`).
  - Stamp boxes repeated in monochrome.
- Buttons: “Print Both Copies”, “Email Receipt to Customer”, “Finish Session”.
  - After print: success toast “Receipt printing… done! Ready for next guest.”

## 5. Receipt Layout Details
- Format as 2-up receipt on 80 mm thermal paper; dashed divider between customer/operator copies.
- Fonts: Title 24 pt, body 16 pt; high contrast black on white.
- Include QR code linking to digital gallery (optional config flag).
- Customer number increments sequentially per session; stored with metadata.

## 6. System Architecture Overview
- **Frontend:** React (or Flutter) kiosk app running fullscreen, offline-first with service worker caching backgrounds.
- **Config Loader:** Reads JSON from secure operator USB or network share; exposes typed schema.
- **State Machine:** Steps managed by finite-state machine to prevent skipping mandatory fields.
- **Receipt Generator:** Uses HTML-to-PDF/thermal template with data binding; prints via networked thermal printer.
- **Storage:** Local encrypted cache storing session metadata until synced; nightly sync to operator portal.
- **Photo Handling:** Identification photo stored locally with session ID; final edited photo matched via customer number.

## 7. Accessibility & Heuristic Considerations
- **Visibility of system status:** progress bar, confirmation toasts, delivery status icons.
- **Match between system & real world:** uses familiar metaphors (cards, toggles), plain language instructions.
- **User control:** retake options, edit buttons, cancel/back accessible on every step.
- **Consistency:** consistent placement of primary button bottom-right, secondary bottom-left.
- **Error prevention:** inline validation on emails, configurable maximums enforced, countdown confirmation before capture.
- **Recognition over recall:** thumbnails, icons, chips show choices; summary card uses icons.
- **Flexibility:** quick chips for common counts plus keypad for edge cases; audio prompts via accessibility menu.
- **Help & documentation:** “Need help?” button opens overlay with contact instructions.

## 8. Edge Cases & Operations
- **Free event:** Payment step auto-skips to confirmation but receipt still includes “Paid” stamp area marked “Complimentary”.
- **Large parties:** Additional instructions prompt attendant to reposition.
- **Custom background failure:** If upload invalid, kiosk displays friendly error and reverts to default backgrounds.
- **Email bounce handling:** system flags undeliverable emails and sends operator alert via nightly report.
- **Offline mode:** kiosk queues emails for delivery when connection restored; receipts note “Emails will be sent once reconnected”.
- **Operator override:** PIN-protected menu to reopen last session, reprint receipts, adjust config, test printer, view diagnostics.

## 9. Presentation & Mockup Plan
- High-fidelity Figma mockups for each screen, using branded color palette and iconography.
- Animated prototype of capture countdown to demonstrate motion.
- Receipt template designed in Illustrator to show both halves and stamp areas.
- Slide deck structure: Overview → Flow Diagram → Screen Mockups → Config & System Diagram → Heuristic Justification → QA & Next Steps.
- Include persona vignette (“Grandma Rosa”) walking through flow to address grandma test.

## 10. Spicy Extras
- **Photo Memory Game:** While waiting for prints, optional on-screen mini-game featuring event backgrounds.
- **Digital keepsake:** Auto-generate shareable postcard with event branding accessible via QR.
- **Operator dashboard:** Tablet companion app for live queue management and stamp verification logging.

