---
trigger: always_on
---

# Repository Layout

- **Project documentation:** Public project documents live in `docs/`. Keep only conventional repository entry points such as `README.md`, `CONTRIBUTING.md`, and `LICENSE` at the root.
- **Design notes:** Engineering context, subsystem explanations, implementation contracts, and exploratory packaging notes live in `docs/design-notes/`. They support both human contributors and coding agents, but do not override current code, tests, or rules in `.agents/rules/`.
