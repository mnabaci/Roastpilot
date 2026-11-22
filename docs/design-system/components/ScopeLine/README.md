# ScopeLine

Under a sidebar's title, what its list is of. History: the roaster whose roasts it lists, as a quiet picker ("Skywalker ▾"). Profiles: the roaster whose profiles these are, as text, since Profiles follows the active roaster. Shown only when there is more than one roaster (History: or roasts with none).

## Anatomy

- One line, 24px high, `label` style in `ink-muted`, 2px under the title; truncates at its end.
- **Picker:** the choice, then a 14px chevron that turns while open; hover `ink`. It opens the app's Select panel, each choice with a detail ("12 roasts").
- **Text:** the name alone; with a tooltip on hover ("Profiles follow the active roaster · change it in Roasters"), which screen readers hear after the name.

## Rules

- It says whose list this is, not a filter: it never turns ember like a FilterSelect chip, and never sits in the filter row.
- Screen readers hear what it picks first ("Roaster: Skywalker").
