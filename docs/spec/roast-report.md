# Roast report

What a finished roast's numbers say, in a roaster's words: how the roast split into its phases, what the rate of rise did that is worth a look, and how an Auto roast kept to its plan. It is read from the saved readings and events, so every roast has one, old and imported ones too, and nothing new is stored. The analysis is `roastReport` in `packages/core/src/history/roast-report`; its numbers are `REPORT` there.

## Where it shows

- **History:** a "Roast report" card under Roast details that folds to one line: the phase shares, then the first thing worth a look ("+ 2 more"), the number of notes, or "Nothing stood out". Open or folded is one choice for every roast (`historyReportOpen` in `settings.json`), open by default.
- **Pointing at a finding (History):** each finding with a time is a button. Hovering or focusing it picks out its stretch on the Roast curve and the outputs strip (a faint fill, edged; a moment is a thin line); a click keeps it and brings the chart into view, a second click lets it go. Opening another roast clears it. The stretches: a crash its minute from the peak, a flick from where it rose to drop, a stall its length, missing readings the gap, development first crack to drop, a takeover from then to the end; the rest their moment.
- **Roast just finished:** the same report, without the plan table, above the weights and notes.
- No report until the roast has dropped or was stopped with Stop roast, nor for one shorter than 2:00 or with fewer than 30 BT readings: there is too little to say anything.

## Phases

From charge to drop (or Stop roast):

- **Drying** to dry end, **Maillard** to first crack, **Development** to drop. With no first crack, Maillard runs to the end.
- Dry end as Auto marked it; else where BT first reached the profile's dry-end temperature (150 °C without a profile) after the turning point, shown as "≈" with a line saying where it was taken. A marked dry end after first crack doesn't count.
- BT never reached dry end: **Before first crack** and Development.
- The turning point is Auto's mark, else the lowest BT in the first 3 minutes.
- Each phase shows its length and share under its own segment, and BT where it ended (dry end, first crack, drop); the shares shown add up to 100 %. The bar is neutral: a longer phase isn't better or worse.

## Rate of rise

RoR is BT's least-squares slope over 30 s, the same as the chart's, once a second from charge. A window with a gap in its readings is skipped.

| Finding     | Worth a look | When                                                                                                                        |
| ----------- | ------------ | --------------------------------------------------------------------------------------------------------------------------- |
| Crash       | yes          | After first crack, RoR falls by half or more from a peak, and by 4 °C/min or more, within 60 s                              |
| Flick       | yes          | From 30 s after first crack (past the crack's own bump), RoR rises 1.5 °C/min or more above its lowest since and holds 15 s |
| Stall       | yes          | Between dry end (else turning point + 1:30) and first crack, RoR under 3 °C/min for 30 s or more; the longest one           |
| Stall guard | no           | Auto's stall guard added heat and no stall followed; how many times                                                         |

A stall during which the stall guard tripped says so: Auto tried.

## Other findings

| Finding                  | Worth a look | When                                                                                       |
| ------------------------ | ------------ | ------------------------------------------------------------------------------------------ |
| Readings missing         | yes          | BT readings more than 10 s apart                                                           |
| No first crack marked    | yes          | Dropped without one: development can't be measured                                         |
| Short / long development | no           | Development under 10 % or over 25 % of the roast, as its whole percentage shows            |
| Stopped before drop      | no           | Stop roast with no drop; the report runs to there                                          |
| You took over            | no           | An Auto roast switched to Manual, or an output overridden; the plan comparison stops there |
| BT ran off the plan      | no           | Auto: BT 5 °C or more from the planned curve, from a minute past the turning point         |
| Dropped at the BT cap    | no           | Auto dropped at the profile's cap (within 0.5 °C), more than 5 s short of its development  |

What is worth a look comes first, then notes, each in time order. Each line says what happened, the numbers, and what it can taste like; never a verdict on the roast. Temperatures and RoR in the screen's unit: a RoR or a difference is ×1.8 in °F, never + 32.

## Against the plan

An Auto roast with its profile: this roast, the plan and the difference for dry end, first crack, development and drop, as History's comparison table shows them. The planned first crack is the planned drop less the development time; the planned dry end is where the curve reaches the profile's dry-end temperature. After you took over, this roast's side is blank. Manual roasts, and Auto ones whose profile wasn't saved, have no plan.
