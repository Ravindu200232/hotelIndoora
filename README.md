# hotelIndoora

The direct-booking website for hotelIndoora, a small hotel at 14 Harbour Lane,
Kinsale, Co. Cork, Ireland. Guests book a room here instead of through a booking
site, and the hotel keeps the whole booking: the dates, the price, the guest's
name and the money.

Three roles use it:

- **A visitor** browses the rooms, reads the hotel's details and prices a stay
  before signing in.
- **A guest** creates an account, confirms their email address, books a room,
  pays for it, changes or cancels the stay and manages their own details —
  including deleting the account, which cancels and refunds anything still ahead.
- **Hotel staff** sign in to the back office: today's arrivals and departures,
  every booking, taking a booking for a guest who phoned, sending a payment link,
  blocking nights out of service, editing the room types and the hotel's own
  details, and adding colleagues to the same single level of access.

## What it is built with

| Piece | What it is |
| --- | --- |
| `client/` | React 18 + Vite single-page app, Tailwind, the product's own stylesheet in `client/src/styles/app.css` |
| `packages/gateway/` | Express: the only public door. It serves the built client, holds the session cookie and proxies `/api/...` to the services |
| `packages/auth/` | Express + Mongoose: guest and staff accounts, email confirmation, invitations, the guest's own account |
| `packages/rooms/` | Express + Mongoose: room types, availability and the hotel's public details; room photographs live in a Supabase Storage bucket |
| `packages/bookings/` | Express + Mongoose: bookings, pricing, payments and refunds through PayPal |
| `packages/testing/` | shared test helpers (`connectTestDb`, `clearCollections`, `request`) |
| MongoDB | the hotel's data: room types, bookings, payments, accounts |

Every part is a real, separate service: the gateway is the only one with a public
door, and each of the other three runs on its own and is reached by address, never
by a hardcoded port. Locally they run on one machine; deployed they run on four
(see `deploy/aws/README.md`).

## Getting started

Prerequisites: Node 20 or newer (the packages ask for `>=20`) and npm with the
lockfile, plus a MongoDB it can reach — the hotel's own cluster, or a local one.

```bash
npm install                 # install from the lockfile
cp .env.example .env.local  # then fill it in (see the table below)
npm run dev                 # gateway on 4000, the services on 4001-4003
npm run seed                # optional: the prototype's sample data, for local demos only
npm run build               # production build of the client into client/dist
npm start                   # the gateway alone, serving the built client
```

Copy the values you need from `.env.example` into `.env.local`; nothing there is
committed, and no value in this README is a value.

### Environment variables

Set locally in `.env.local` (never committed). Deployed, they live in AWS Secrets
Manager under `/hotelindoora/prod/env`, and each instance's release writes only the
keys that service reads into `/etc/hotelindoora/env`.

| Name | Purpose | Required | Where it is set |
| --- | --- | --- | --- |
| `MONGODB_URI` | the database every service reads and writes | yes | server secret |
| `SESSION_SECRET` | signs the session cookie and the token the services use between themselves on `/internal` routes | yes in production | server secret, one per environment |
| `NODE_ENV` | `production` turns on secure cookies and TLS-aware settings | yes when deployed | server |
| `PORT` | the gateway's port (4000) | yes | server |
| `AUTH_PORT`, `ROOMS_PORT`, `BOOKINGS_PORT` | each service's own port (4001, 4002, 4003) | yes | server, per instance |
| `AUTH_URL`, `ROOMS_URL`, `BOOKINGS_URL` | where the services are reached from | yes when they are on separate hosts | server |
| `EMAIL_PROVIDER` | the transactional email service (`resend`) | yes | server |
| `EMAIL_API_KEY` | the key that service sends with | yes — without it every message reports a clear failure and nothing is sent | server secret |
| `MAIL_FROM` | the address the hotel's messages come from | yes | server |
| `HOTEL_NAME` | the hotel's name in email subjects and headings | yes | server |
| `SITE_URL` | the address the site is served on, with no trailing slash. Every link the app puts in an email (the confirmation link, the staff invitation, the payment link) and the address PayPal returns a guest to are built from it — unset, those links are relative and reach nobody | yes when deployed | server secret store; the CloudFront address of the deployment |
| `STAFF_EMAIL`, `STAFF_NAME` | the hotel's own first staff sign-in, used only by `scripts/seed-production.mjs` to create the invitation | for the first deployment | read on the `auth` instance from its own seed environment file |
| `SUPABASE_URL` | the Storage endpoint holding room-type photographs | for room photographs | server |
| `SUPABASE_SERVICE_ROLE_KEY` | server-side key for that bucket — never in the browser, never a `VITE_` name | for room photographs | server secret |
| `ROOM_PHOTOS_BUCKET` | the bucket's name (`room-type-photos`) | yes | server |
| `PAYPAL_ENV` | `sandbox` or `live` | for payments | server |
| `PAYPAL_CLIENT_ID`, `PAYPAL_CLIENT_SECRET` | the PayPal application's credentials | for payments | server secrets |
| `PAYPAL_WEBHOOK_ID` | set once the webhook is registered in PayPal, so notifications can be verified | for verified notifications | server secret |
| `FRAME_ANCESTORS` | the one origin the pages may be framed by; unset refuses framing outright | no | server |
| `TEST_MONGODB_URI` | the database the unit suites use; its name must end in `_test` | for the tests | local, and a repository secret in CI |
| `E2E_MONGODB_URI` | the database the end-to-end journeys use | for `npm run test:e2e` | local |
| `BASE_URL` | where the browser-facing checks point | for the QA layers | local |
| `VITE_SAMPLE_ACCOUNTS` | a build flag: `off` leaves the sample accounts and the review panel off the sign-in page, which is how a build for a real hotel is made. Unset, the local preview and the recorded visual baselines keep them | no | the build command (`VITE_SAMPLE_ACCOUNTS=off npm run build`) |

Only variables meant for the browser may carry the framework's public prefix.
This application has none: the client is built before it is served, and no secret
is ever given a `VITE_` name.

## Tests

```bash
npm test                # the unit suites (services and client), one file at a time
npm run test:coverage   # the same, with coverage
npm run qa:e2e          # the end-to-end journeys, against a server the runner starts
npm run qa:visual       # the visual layer
npm run qa:a11y         # the accessibility layer
npm run qa:perf         # Lighthouse performance budgets
npm run qa:security     # an OWASP ZAP baseline scan
npm run qa:inventory    # which unit is untested
npm run audit           # dependency advisories at high severity
```

## Deploying

The site runs on four EC2 instances in AWS `ap-south-1` (Mumbai): the gateway, and
one instance each for accounts, rooms and bookings. Only the gateway is reachable
from outside, and only through CloudFront's own addresses on port 80; the other
three accept traffic only from the gateway. Administration is through AWS Systems
Manager — port 22 is never opened and there is no key pair.

```bash
# 1. everything the deployment needs, as code, in one stack
aws cloudformation deploy --template-file deploy/aws/ec2.yml --stack-name hotelindoora-prod \
  --capabilities CAPABILITY_NAMED_IAM --parameter-overrides file://deploy/aws/params.json \
  --tags app=hotelindoora env=prod managed-by=agentforge \
  --no-fail-on-empty-changeset --region ap-south-1 --profile agentforge-console

# 2. the production starting data: the hotel's own details and the room types it
#    sells, plus the first staff account as an emailed invitation
node scripts/seed-production.mjs

# 3. a release: the built client and the four packages go to S3, then each
#    instance is told to take it (release.sh downloads it, writes the environment
#    from Secrets Manager, switches the release and proves the health route)
aws s3 cp release-<sha>-<timestamp>.tar.gz s3://hotelindoora-prod-releases/releases/ \
  --region ap-south-1 --profile agentforge-console
aws ssm send-command --document-name AWS-RunShellScript --instance-ids <instance-id> \
  --parameters file://deploy/aws/release-params-<service>.json \
  --region ap-south-1 --profile agentforge-console
```

Going back is one command per instance, and the release script already does it by
itself when a new release fails its health check:

```bash
aws ssm send-command --document-name AWS-RunShellScript --instance-ids <instance-id> \
  --parameters file://deploy/aws/rollback-params.json --region ap-south-1 --profile agentforge-console
```

`deploy/aws/README.md` has the full picture, including how to remove the
deployment.

## Known limitations

Recorded honestly, from the build and test records and from this deployment:

- **Payments are switched off in this deployment.** `PAYPAL_CLIENT_ID`,
  `PAYPAL_CLIENT_SECRET` and `PAYPAL_WEBHOOK_ID` are not set, so the application
  refuses every PayPal call with its own clear message and no booking is ever
  reported as paid without PayPal. Adding a client id, a secret and one redeploy
  turns payments on; `PAYPAL_WEBHOOK_ID` is needed for notifications to be
  verified.
- **Email needs a sending address the provider allows.** Messages go out through
  Resend from `MAIL_FROM`; when the provider refuses one, the application reports
  that refusal rather than claiming a message was sent.
- **The hotel's published hours cannot be saved through Hotel Details.** The
  requirement refuses a check-out time at or before the check-in time, and the
  hotel's published hours are check-in 15:00 with check-out by 11:00. They are
  written straight into the database and every page shows them; a member of staff
  who opens the page and presses Save is refused on that field until the pair is
  changed. The rule is the requirement, so it is kept.
- **Twelve pages render their own `<main>` inside the shell's**, so those pages
  carry two main landmarks and a duplicated id. Nothing serious or critical is
  reported for it and the accessibility layer passes; it is recorded rather than
  quietly changed.
- **Room-photograph upload has not been exercised against the live bucket**: the
  type and size checks are covered by tests, but the last upload attempt answered
  502 from the Storage bucket and was never repeated end to end.
- **Dependency advisories**: the production dependency set carries two moderate
  advisories in `react-router` 6, whose only fix is the breaking 7.x upgrade, and
  the build and QA tooling (Lighthouse CI, Playwright, Vitest, Vite, Tailwind)
  carries the rest. None of the tooling ships to the server: the release contains
  production dependencies only.
