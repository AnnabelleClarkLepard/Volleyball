# Volleyball Lineup Planner Design System & UX Rules

This document is the source of truth for visual design, interaction patterns, and product rules in this codespace. It applies to the Volleyball Lineup Planner and should be used as the baseline for future UI changes, feature work, and QA reviews.

## 1. Product intent

The app is a fast, mobile-friendly lineup planning tool for volleyball captains. It must help users:

- manage a team roster,
- assign players to court positions,
- rotate bench players,
- review lineup fit and availability,
- share or export a lineup for quick communication.

The experience should feel calm, confident, and tactical, not cluttered or game-like.

## 2. Core design principles

1. Clarity over decoration
   - The interface should make the current lineup and next action obvious within seconds.
   - Do not add visual noise for the sake of personality.

2. Fast captain workflow
   - The app is used under time pressure before matches and practices.
   - Common actions like changing the lineup, toggling availability, and adding players must be friction-light.

3. Context before control
   - Controls should live next to the thing they affect.
   - If a user is editing a player, the form should be directly tied to that player card or row.

4. Predictable behavior
   - Buttons, forms, and selection states should behave consistently across the app.
   - If an action is destructive or changes the team state, it should be visibly and intentionally labeled.

5. Accessible by default
   - Touch targets must remain large enough for finger use.
   - Inputs must have labels, clear states, and sufficient contrast.
   - Focus states and keyboard access are mandatory.

## 3. Visual language

### 3.1 Color palette

Use this palette as the canonical theme for the app.

- Background: #F5F1EA
- Paper / elevated panel: #FBFAF7
- Primary Navy: #1A5068
- Secondary Aqua: #D8EFEC
- Accent Gold: #F4B85E
- Text: #1A2333
- Muted text: #667580
- Border / dividers: #DFE4E8
- Danger / error: #BC4B4B
- Success highlight / active state: #1A5068 with soft tint background

#### Color usage rules

- Primary navy is reserved for primary actions, active selections, and the main brand moments.
- Aqua is used for supporting backgrounds, subtle emphasis, and calm state indicators.
- Gold is used sparingly for highlights and important notations only.
- Red is only used for destructive actions, availability problems, or alerts.
- Backgrounds should stay light and low-contrast so court cards and roster entries remain readable.

### 3.2 Typography

- Base family: Inter, system-ui, sans-serif
- Line-height: 1.5 for body, 1.1-1.3 for headings
- Body text: 14-16px
- Small metadata / labels: 11-12px uppercase tracking
- Headings: 24-40px with tight letter spacing for major titles

#### Type rules

- Use bold weights for sections and labels, not for every element.
- Keep titles short and action-oriented.
- Avoid full sentences in headings.
- Use uppercase tracking sparingly for metadata, not as a decoration.

### 3.3 Spacing system

Use an 8px spacing scale.

- 4px: micro spacing
- 8px: default gap / padding between related elements
- 12px: compact controls
- 16px: standard card padding
- 20px: section separation
- 24px: card stack spacing
- 28px: topbar and major panel spacing
- 32px: large section rhythm

#### Spacing rules

- Group related controls with 8-12px vertical rhythm.
- Separate distinct sections with at least 16px and preferably 24px.
- Avoid arbitrary spacing values outside the scale unless there is a strong mobile reason.
- All layout patterns should still feel readable at 320px width.

### 3.4 Border radius and elevation

- Card radius: 12px-16px
- Control radius: 10px
- Pill / tag radius: 999px when appropriate
- Shadow: soft, low-opacity, not heavy

#### Shadow guidance

- Use soft elevation only for floating panels or elevated cards.
- Do not rely on shadows to create separation when borders can do the job.
- Keep shadows low and neutral to maintain a professional sports tool feel.

## 4. Layout system

### 4.1 Page structure

The planner should use a clear shell structure:

- left sidebar = team management / navigation
- main content area = active team workspace
- top bar = title + key actions and context
- content panels = roster, court, bench, and sharing features

This should remain stable across desktop and tablet layouts, with mobile stacking for narrow screens.

### 4.2 Panel and card behavior

- Panels should be visually grouped but not over-embellished.
- Cards should align to a consistent left-to-right rhythm.
- The active team and active lineup should always be clearly visible.
- Use subtle background tints rather than large color blocks.

### 4.3 Court layout

- Court positions should be arranged in a simple six-slot diagram with clear labels.
- Matching front/back pairs should stay visually grouped.
- The current active player should be easy to identify without scanning too much text.
- Use concise labels like FL, FM, FR, BL, BM, BR when space is tight.

### 4.4 Roster and bench layout

- Use simple rows with name, role, and availability state.
- Keep the most important information in the first line and secondary details below when needed.
- Bench items should feel like a queue, not a cluttered list.

## 5. Interaction and functional standards

### 5.1 Buttons and controls

- Minimum touch target: 44px height
- Primary buttons should be visually distinct from secondary actions
- Each view should have one clear primary action
- Secondary actions should be visually lighter and lower emphasis
- Disabled states must be obvious and intentional, not silent

### 5.2 Form behaviors

- Inputs should have clear labels or context
- Placeholders should not replace labels in critical fields
- Validation should appear near the field, not only in a modal toast
- Keep forms compact but not cramped
- Use one entry point for the same task, not multiple equivalents

### 5.3 State and feedback

- Show active, disabled, and selected states clearly
- Feedback should feel immediate and subtle
- Confirm destructive actions before committing
- Use loading or saving states only when an action genuinely takes time

## 6. UX rules for this codespace

These are the non-negotiable rules for product decisions and implementation work.

### Rule 1: One action, one place

No buttons that do the same thing in two places.

- If a team can be saved in the main top bar, do not also repeat the same save action in a sidebar or card footer.
- If a player can be removed from the team, do not provide a duplicate remove action in both the roster row and a detail modal.
- Duplicate controls create confusion and make accidental actions more likely.

### Rule 2: Keep actions anchored to context

Controls should appear where the user expects them.

- Add roster actions in the roster area.
- Add lineup actions where the court or bench is being edited.
- Add share/export controls in the top bar or team-level actions area, not buried inside a player row.

### Rule 3: Default to the shortest path

The user's main goal is to plan the lineup quickly.

- Avoid multi-step flows for common actions.
- Prefer inline editing when it keeps momentum.
- Do not make captain tasks require a modal unless there is a real need for focus.

### Rule 4: Label for clarity, not cleverness

- Use labels like Add player, Save lineup, Share view, Remove player
- Do not use vague naming like “Do it” or “Go”
- Keep language consistent across forms and actions

### Rule 5: Visual emphasis must match task importance

- Most important action = highest emphasis
- Secondary action = lower emphasis
- Danger action = clearly styled as danger, never hidden in a neutral button

### Rule 6: Preserve user mental model

- A player should stay in the same logical place when their status changes.
- Court assignments should be understandable at a glance.
- Bench order should remain consistent and predictable.

### Rule 7: Respect mobile-first use

This app is used by people moving quickly on a phone or tablet.

- Keep controls tap-friendly
- Minimize stacked complexity
- Prefer single-column or compact card layouts on narrow screens
- Maintain clear spacing even when the layout compresses

### Rule 8: Make obvious what is selected, active, unavailable, or warned

- Selected team, current court slot, and active bench item must always be visually obvious.
- Availability states should be clear without requiring interpretation.
- Use semantic styling; never rely on color alone when text or iconography can help.

### Rule 9: Avoid redundant information

- Do not show the same status in multiple competing ways.
- If a player row already shows availability, do not repeat the same status in a large banner elsewhere unless it is genuinely actionable.
- Prefer one source of truth for each state.

### Rule 10: Design for the captain, not the product team

The app should feel like a tool used under acute decision-making pressure, not a marketing dashboard.

- Keep interfaces fast and readable.
- Favor confidence and function over visual flourish.
- Reduce cognitive load in every screen.

## 7. Accessibility standards

- Meet WCAG AA contrast standards for text and controls.
- Require a minimum contrast ratio of 4.5:1 for normal text and 3:1 for large text.
- Require a minimum contrast ratio of 3:1 for non-text UI elements that convey meaning, such as focus indicators, state markers, and iconography used to communicate status.
- Ensure focus rings are visible on interactive elements.
- Do not depend on color alone to communicate role, selection, or error state.
- Use semantic buttons for actions and labels for inputs.
- Keep keyboard navigation logical and complete.
- Provide action names that make sense when read by a screen reader.

### Contrast rule summary

- Normal text: 4.5:1 minimum
- Large text (18pt+ or 14pt bold+): 3:1 minimum
- UI components and meaningful icons: 3:1 minimum
- When in doubt, test with a contrast checker before shipping UI color updates.

## 8. Implementation mapping to current app

The existing app already reflects a useful baseline for this system:

- background tones in soft warm neutrals,
- navy used for primary actions and active items,
- soft aqua surfaces used for secondary grouping,
- repeated panel-based layout for roster and lineups,
- 44px minimum control height,
- compact spacing scale aligned to 8px increments.

Future updates should preserve these patterns rather than introducing a new visual language.

## 9. Review checklist

Before shipping any UI change, verify:

- Does it follow the spacing system?
- Does it use the approved palette?
- Is there a single clear primary action per section?
- Are there duplicate controls for the same behavior?
- Is the layout still readable on mobile?
- Are active, disabled, and destructive states clear?
- Does it work with keyboard and readable contrast?

## 10. Final rule set

The product should feel like a confident, practical volleyball team tool:

- neat,
- calm,
- fast,
- obvious,
- consistent,
- and usable under pressure.

If a feature or design choice does not make the captain’s job easier, it should be removed or simplified.
