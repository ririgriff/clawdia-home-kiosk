# Changelog

All notable changes to this project will be documented here.

## [Unreleased]

### Added
- **Schedule agent: `mode=range` delete** — `DELETE /api/agent/schedule?id=EVENT_ID&mode=range&from=YYYY-MM-DD&to=YYYY-MM-DD` adds every date in the range to the event's `exceptions[]` array in a single call. Useful for suppressing recurring events during a multi-day absence (e.g. class trips) without deleting the whole series. Agent skill prompt updated to offer this as a fourth scope option.
