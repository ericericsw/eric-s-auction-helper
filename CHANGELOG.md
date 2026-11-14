# Changelog

All notable changes to **eric's Auction Helper** (`auction-helper.user.js`) are documented in this file.

> **Latest Install Link (Auto-Updating):**
> <https://raw.githubusercontent.com/ericericsw/eric-s-auction-helper/main/auction-helper.user.js>

---

## [Unreleased]

### Added
- _None yet_

### Changed
- _None yet_

### Fixed
- _None yet_

---

## [1.4.1] - 2026-11-14

- **Install / Snapshot URL:** <https://raw.githubusercontent.com/ericericsw/eric-s-auction-helper/v1.4.1/auction-helper.user.js>

### Fixed
- Prevented duplicate checkboxes and orphaned inline badges when Hentaiverse localization scripts strip `<span>` wrappers in posts (switched internal row/badge wrappers from `<span>` to custom elements `hv-auc-row`, `hv-auc-badge`, `hv-auc-label`, `hv-auc-status`, added orphaned node cleanup, and deduplicated checkboxes/badges during DOM reconciliation).
- Preserved the previous/fallback equipment color when localization scripts modify equipment link styling.

---

## [1.4.0] - 2026-11-14

- **Install / Snapshot URL:** <https://raw.githubusercontent.com/ericericsw/eric-s-auction-helper/v1.4.0/auction-helper.user.js>

### Added
- Made the inline bid badge next to each selected item in forum posts directly editable (`<input>` inside the badge) with real-time two-way sync to the floating panel cards.
- Clicking anywhere on an inline badge focuses and selects its input; pressing `Enter` or `Escape` blurs the input to finish editing.

---

## [1.3.1] - 2026-11-14

- **Install / Snapshot URL:** <https://raw.githubusercontent.com/ericericsw/eric-s-auction-helper/v1.3.1/auction-helper.user.js>

### Fixed
- Prevented equipment selection and parsing failures when other userscripts (such as localization or equipment enhancers) rewrite post DOM via `innerHTML`, wrap equipment links, or inject quality tags/spans.
- Added `MutationObserver` reconciliation and `document`-level event delegation so checkboxes and inline badges survive post DOM re-renders.
- Added fallback matching for localized `start` / `Lv` / `Seller` / `Result` text, filtered out black-on-bright quality badge colors when extracting equipment colors, and synced live item names/colors to the floating panel.

---

## [1.3.0] - 2026-11-11

- **Install / Snapshot URL:** <https://raw.githubusercontent.com/ericericsw/eric-s-auction-helper/v1.3.0/auction-helper.user.js>

### Added
- Automatic thread phase detection (`Intake`, `Bidding`, `Pending`, `Close`) from thread title tags, official status posts (`Session Status:` / `Current Phase:`), and item rows (`Result:` / temporary numeric IDs).
- Phase warning banners and automatic freezing of **Copy Rcpt**, **Copy Subject**, **Copy Bid**, and **Auto fill in MoogleMail** buttons during `Intake`, `Pending`, and `Close` phases to prevent unnecessary MoogleMails while keeping item selection and price calculation active.

### Fixed
- Preserved trailing inline nodes (such as `Result:` and `Bidders:` text in settled rows) inside the wrapped item row so the inline bid badge renders cleanly at the end of the line.

---

## [1.2.0] - 2026-11-09

- **Install / Snapshot URL:** <https://raw.githubusercontent.com/ericericsw/eric-s-auction-helper/v1.2.0/auction-helper.user.js>

### Added
- Initial GitHub release of **eric's Auction Helper** (extracted from `hv-auto-shop-equiprental` commit `1efae5a` with `@updateURL` and `@downloadURL` support).
- Thread verification (`eric's Auto Equip Auction` title pattern or official shop account `HVEquipAuction` / UID `10151793`) so the script only activates on official auction threads containing listed items.
- Per-item selection checkboxes and row highlighting with inline bid badges in forum posts.
- Collapsible floating **Auction Bid Helper** panel with persisted collapsed state, per-thread draft saving in `localStorage`, and English / 中文 UI language toggle.
- Real-time bid input validation supporting whole Credits, `k` / `m` / `b` shorthand, `start` / `cancel` / `mybid` commands, reserve price checks, and total Credits calculation.
- One-click **Copy Rcpt**, **Copy Subject** (`Auction Bid`), **Copy Bid**, **Select All**, **Clear**, and **Auto fill in MoogleMail** (`&hvut=disabled`, also compatible with HV Utils' compose UI).
