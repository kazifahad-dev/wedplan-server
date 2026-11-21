# WedPlan Server

REST API for **WedPlan**, a role-based wedding planning platform where customers discover and book wedding services, vendors publish services and manage booking requests, and admins moderate the platform.

This repository is the **server** (Express.js + MongoDB). The Next.js client lives in a separate repository.

## Live Links

| | Link |
|---|---|
| Live Website | `https://wedplan-client-puce.vercel.app/` |
| Live API | `https://wedplan-server-tau.vercel.app/` |
| Client Repository | https://github.com/kazifahad-dev/wedplan-client |
| Server Repository | https://github.com/kazifahad-dev/wedplan-server |

## Important Features

**Authentication and security**
- JWT verification middleware. Tokens issued by Better Auth are verified against its JWKS endpoint, including the issuer. Missing, invalid or expired tokens return `401`.
- Role-based middleware for `admin`, `vendor` and `customer`. Wrong role returns `403`.
- Blocked users are rejected on every protected route.
- Resource ownership is checked before any update, delete or status change. Vendors can only touch their own services and bookings, and customers can only cancel their own bookings.
- Request bodies are validated with Zod. Search input is regex-escaped.
- User ID and role always come from the verified token and database, never from the request body.
- Admin accounts cannot be created through public registration. An admin is assigned with a script (see below).

**Services**
- Public listing of approved and active services only, with search by name, category and location filters, price sorting (ascending and descending) and pagination.
- Featured services endpoint (latest 6) and category counts endpoint.
- Vendor CRUD with availability toggle. New services start as `pending` until an admin approves them.
- Free plan vendors can have at most 3 active services. Premium vendors have no limit.

**Bookings**
- Customers submit booking requests (event date, location, message).
- Prevents booking your own service and duplicate active requests for the same service and event date.
- Vendors can accept or reject only `pending` requests, and a processed request cannot be processed again.
- Customers can cancel only `pending` requests.

**Payments (Stripe, test mode)**
- Checkout Session is created on the server for the authenticated vendor only.
- Premium access is activated **only** by verified Stripe webhook events, never by the success redirect.
- Handles `checkout.session.completed`, `customer.subscription.updated` and `customer.subscription.deleted`, so cancellation and expiry move the vendor back to the Free plan.
- Transactions are written only by the webhook. There is no API for editing payment records.

**Admin**
- Platform statistics, user list with search and role filter, user details, block and unblock.
- Review, approve, reject, change status and delete any service.
- Paginated transaction list.

## Technology Stack

- Node.js, Express.js 5, TypeScript
- MongoDB (native driver)
- Better Auth JWT, verified with `jose`
- Stripe (Checkout and webhooks)
- Zod (validation)
- Deployed on Vercel (serverless)

## Database

Better Auth manages its own collections. The user collection (`user`) holds `name`, `email`, `image`, `role`, `isBlocked`, `businessName`, `subscriptionPlan` and `subscriptionExpiresAt`.

Business collections used by this server:

| Collection | Fields |
|---|---|
| `services` | `vendorId`, `serviceName`, `category`, `description`, `price`, `location`, `images`, `status`, `isActive`, `createdAt` |
| `bookings` | `serviceId`, `vendorId`, `customerId`, `eventDate`, `eventLocation`, `message`, `status`, `createdAt` |
| `transactions` | `vendorId`, `plan`, `amount`, `currency`, `stripeSessionId`, `stripeSubscriptionId`, `status`, `createdAt` |

Booking status values: `pending`, `accepted`, `rejected`, `cancelled`. Service status values: `pending`, `approved`, `rejected`.

## API Overview

| Method | Route | Access |
|---|---|---|
| GET | `/api/services` (`search`, `category`, `location`, `sort`, `page`, `limit`) | Public |
| GET | `/api/services/featured` | Public |
| GET | `/api/services/categories` | Public |
| GET | `/api/services/:id` | Public |
| POST | `/api/services` | Vendor |
| GET | `/api/services/mine` | Vendor |
| PATCH | `/api/services/:id` | Vendor (owner) |
| PATCH | `/api/services/:id/availability` | Vendor (owner) |
| DELETE | `/api/services/:id` | Vendor (owner) |
| POST | `/api/bookings` | Customer |
| GET | `/api/bookings/mine` | Customer |
| PATCH | `/api/bookings/:id/cancel` | Customer (owner) |
| GET | `/api/bookings/vendor` | Vendor |
| PATCH | `/api/bookings/:id/status` | Vendor (owner) |
| POST | `/api/payments/create-checkout-session` | Vendor |
| GET | `/api/payments/status` | Vendor |
| GET | `/api/payments/my-subscription` | Vendor |
| POST | `/api/payments/webhook` | Stripe (signature verified) |
| GET | `/api/admin/stats` | Admin |
| GET | `/api/admin/users`, `/api/admin/users/:id` | Admin |
| PATCH | `/api/admin/users/:id/block` | Admin |
| GET | `/api/admin/services` | Admin |
| PATCH | `/api/admin/services/:id/status` | Admin |
| DELETE | `/api/admin/services/:id` | Admin |
| GET | `/api/admin/transactions` | Admin |

## Installation Instructions

Requirements: Node.js 20 or newer, a MongoDB database (Atlas or local) and a Stripe account in test mode.

```bash
git clone https://github.com/kazifahad-dev/wedplan-server.git
cd wedplan-server
npm install
```

Create a `.env` file in the project root (see **Environment Variables** below). Never commit this file.

## How to Run the Project Locally

```bash
npm run dev      # development server with auto reload (default port 5000)
npm run build    # compile TypeScript to dist/
npm start        # run the compiled server
```

The server expects the **client** to be running too, because the client hosts Better Auth (sign up, sign in and the JWKS endpoint used to verify tokens). Start the client first, then the server.

### Create an admin account

Admins cannot register publicly. Sign up normally from the client, then promote that account:

```bash
npm run make-admin -- admin@example.com
```

### Seed sample services (optional)

```bash
npm run seed -- vendor@example.com
```

This adds sample services for the given vendor account. Approve them from the admin dashboard to show them on the public pages.

### Test the Stripe webhook locally

```bash
stripe listen --forward-to localhost:5000/api/payments/webhook
```

Copy the `whsec_...` value it prints into `STRIPE_WEBHOOK_SECRET`. Use the test card `4242 4242 4242 4242` with any future expiry date and any CVC.

## Environment Variables

Create a `.env` file:

```env
# Server
PORT=5000
CLIENT_URL=http://localhost:3000

# MongoDB (use the same database as the client)
MONGODB_URI=your_mongodb_connection_string

# Better Auth (URL of the client app, which hosts Better Auth)
BETTER_AUTH_URL=http://localhost:3000

# Stripe (test mode)
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_WEBHOOK_SECRET=your_stripe_webhook_signing_secret
```

| Variable | Purpose |
|---|---|
| `PORT` | Local server port (default `5000`) |
| `CLIENT_URL` | Client origin. Used for CORS and Stripe success and cancel redirects |
| `MONGODB_URI` | MongoDB connection string. Must point to the same database the client's Better Auth uses |
| `BETTER_AUTH_URL` | Base URL of the client app. The server fetches `/api/auth/jwks` from here and checks the token issuer |
| `STRIPE_SECRET_KEY` | Stripe secret key (kept on the server only) |
| `STRIPE_WEBHOOK_SECRET` | Signing secret used to verify webhook events |

All secrets are read from environment variables. `.env` is listed in `.gitignore` and must never be pushed.

## Required Application URLs

| Item | URL |
|---|---|
| Local client | `http://localhost:3000` |
| Local server | `http://localhost:5000` |
| Stripe webhook endpoint (production) | `https://YOUR-SERVER-URL.vercel.app/api/payments/webhook` |
| Stripe webhook events to enable | `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted` |

## Deployment Notes (Vercel)

- `vercel.json` routes all requests to `src/server.ts`. The database connection is created lazily, which suits serverless.
- Set every variable from the table above in the Vercel project settings.
- Set `CLIENT_URL` to the exact deployed client URL (no trailing slash) to avoid CORS errors.
- Create the Stripe webhook endpoint in the Stripe dashboard and paste its signing secret into `STRIPE_WEBHOOK_SECRET`.
