# Changelog

## Unreleased

- A dashboard card of one printer's check: the verdict, the trend above the
  print's baseline, the newest picture with the flagged regions, and the
  latest incident. It shows the first printer LayerWatch AI follows until
  one is picked, and leaves out the picture, then the figures, when it is
  made small.
- A LayerWatch AI section at the foot of a printer's Status tab, and one line
  on its card in the printer listing while it prints.
- All three read one shared status, which is read again a few seconds after
  each stored snapshot and when a print starts or settles. They open no
  stream of their own and poll nothing, as the core asks of a card.
- The page draws its verdict badge and trend bar from the same components.

## 0.3.0

- Renamed from Print Guard to LayerWatch AI, so it is not confused with the
  independent PrintGuard project. New repository and extension id
  (`com.github.aux.leotrax3d.layerwatch-ai`); install it fresh and remove
  Print Guard. Settings and incidents do not carry over.

## 0.2.3

- Same code as 0.2.2, whose release was tagged on the wrong commit.
- README: a record backend and the operator role are needed before the
  first start (#2).

## 0.2.2

- module.yaml publishes the sensitivity and warmup_frames defaults as text,
  which Connect's manifest schema requires; the module reads both as a number
  or as text.

## 0.2.1

- The Obico installer no longer installs Docker by piping a remote script
  into a shell; it asks for Docker instead. It is now downloaded and run as
  a file rather than piped into `sh`.
- The setup code is plain text (`pg1 <obico address> <frame address>`)
  instead of base64.

## 0.2.0

- One-command Obico installer (`scripts/install-obico.sh`): hardware check,
  Docker, Obico's ML API on port 3333 and a setup code for the page.
- Setup code field in the Setup card.
- Flagged regions drawn as boxes over camera pictures, test results and
  incident frames.
- Setup assistant on the page: detector, Obico address and token, frame
  address and action, saved through the core's resource route (the same one
  the extension settings screen uses), then a connection test. Shown only to
  people who may read the extension's configuration.
- A LayerWatch AI page in the Connect web app: every camera with its live
  picture, verdict and trend, a "False alarm" button, and the incidents with
  the frame each was judged on. In English and German.
- Detector status on the page: analyses, failures, last successful analysis,
  response time and the last error, plus a "Test connection" button
  (`GET /check`, Obico's `/hc/` health endpoint).
- "Test analysis" per printer (`POST /printers/{printer}/test`): scores the
  newest frame and shows the result, never pausing the print.
- Trial run by default: `action` now defaults to `notify`. Set it to `pause`
  once the test analyses look right.

## 0.1.0

- First release. Follows every camera with periodic capture, scores each new
  snapshot while its printer prints, and pauses the print when it looks failed.
- Two detectors: a built-in heuristic and a self-hosted Obico ML API.
- Routes `GET /status`, `GET /incidents` and `POST /printers/{printer}/reset`,
  and the `failure.detected` event.
