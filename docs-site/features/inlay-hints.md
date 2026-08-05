# Inlay Hints

Inlay hints show schema-backed parameter names inline for positional IFC entity arguments. IFC STEP lines can be hard to read because most entity data is encoded by argument order, so hints make long lines easier to inspect without changing the file text.

They are useful when reading unfamiliar entities, checking which attribute a value belongs to, or teaching IFC STEP syntax.

## Enable or Disable

Inlay hints use VS Code's built-in inlay hint setting:

```json
{
  "editor.inlayHints.enabled": "offUnlessPressed"
}
```

The recommended mode is `offUnlessPressed`. This keeps the source file visually clean by default and shows hints only while you hold VS Code's inlay-hint modifier key.

Other useful values are:

- `"on"`: always show inlay hints
- `"off"`: never show inlay hints
- `"onUnlessPressed"`: show hints by default and hide them while pressing the modifier key

![IFC parameter inlay hints](/assets/inlay-hints.png)
