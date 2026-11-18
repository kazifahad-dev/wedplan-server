import { Request, Response } from "express";
import { ObjectId } from "mongodb";
import Stripe from "stripe";
import { getDB } from "../config/db.js";
import { stripe, PREMIUM_PRICE_CENTS } from "../config/stripe.js";

const users = () => getDB().collection("user");
const transactions = () => getDB().collection("transactions");


function isActivePremium(vendor: { subscriptionPlan?: string; subscriptionExpiresAt?: Date } | null) {
  return (
    vendor?.subscriptionPlan === "premium" &&
    !!vendor.subscriptionExpiresAt &&
    new Date(vendor.subscriptionExpiresAt) > new Date()
  );
}


function getPeriodEnd(sub: Stripe.Subscription): Date {
  const legacy = (sub as unknown as { current_period_end?: number }).current_period_end;
  const end = legacy ?? sub.items.data[0]?.current_period_end;
  return new Date((end as number) * 1000);
}


// ─────────────────────────────────────────────
export async function createCheckoutSession(req: Request, res: Response) {
  const vendorId = req.user!.id; 

  const vendor = await users().findOne({ _id: new ObjectId(vendorId) });
  if (isActivePremium(vendor as never)) {
    return res.status(409).json({ message: "You already have an active Premium plan" });
  }

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer_email: req.user!.email,
    client_reference_id: vendorId,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: PREMIUM_PRICE_CENTS,
          recurring: { interval: "month" },
          product_data: { name: "WedPlan Premium Vendor" },
        },
      },
    ],
    
    metadata: { vendorId },
    subscription_data: { metadata: { vendorId } },
    success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.CLIENT_URL}/payment/cancel`,
  });

  res.json({ url: session.url });
}

// ─────────────────────────────────────────────
// GET /api/payments/status?session_id=... 
// ─────────────────────────────────────────────
export async function getPaymentStatus(req: Request, res: Response) {
  const sessionId = String(req.query.session_id || "");
  if (!sessionId) {
    return res.status(400).json({ message: "session_id is required" });
  }

  
  const tx = await transactions().findOne({
    stripeSessionId: sessionId,
    vendorId: req.user!.id,
  });

  if (!tx) {
   
    return res.json({ confirmed: false });
  }
  res.json({
    confirmed: true,
    plan: tx.plan,
    amount: tx.amount,
    currency: tx.currency,
    status: tx.status,
  });
}

// ─────────────────────────────────────────────
// GET /api/payments/my-subscription (Vendor Subscription )
// ─────────────────────────────────────────────
export async function getMySubscription(req: Request, res: Response) {
  const vendor = await users().findOne({ _id: new ObjectId(req.user!.id) });
  const premium = isActivePremium(vendor as never);

  res.json({
    plan: premium ? "premium" : "free",
    expiresAt: premium ? vendor?.subscriptionExpiresAt : null,
  });
}

// ─────────────────────────────────────────────
// POST /api/payments/webhook (Stripe )
// ─────────────────────────────────────────────
export async function handleWebhook(req: Request, res: Response) {
  const signature = req.headers["stripe-signature"];
  if (!signature || !process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(400).send("Missing signature");
  }

  
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(
      req.body, 
      signature,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return res.status(400).send("Invalid signature");
  }

  try {
    switch (event.type) {
      
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        if (session.mode !== "subscription" || session.payment_status !== "paid") break;

        const vendorId = session.metadata?.vendorId;
        const subscriptionId =
          typeof session.subscription === "string"
            ? session.subscription
            : session.subscription?.id;
        if (!vendorId || !subscriptionId || !ObjectId.isValid(vendorId)) break;

        const sub = await stripe.subscriptions.retrieve(subscriptionId);

        
        await transactions().updateOne(
          { stripeSessionId: session.id },
          {
            $setOnInsert: {
              vendorId,
              plan: "premium",
              amount: (session.amount_total ?? 0) / 100,
              currency: session.currency ?? "usd",
              stripeSessionId: session.id,
              stripeSubscriptionId: subscriptionId,
              status: "paid",
              createdAt: new Date(),
            },
          },
          { upsert: true }
        );

        await users().updateOne(
          { _id: new ObjectId(vendorId) },
          { $set: { subscriptionPlan: "premium", subscriptionExpiresAt: getPeriodEnd(sub) } }
        );
        break;
      }

      
      case "customer.subscription.updated": {
        const sub = event.data.object as Stripe.Subscription;
        const vendorId = sub.metadata?.vendorId;
        if (!vendorId || !ObjectId.isValid(vendorId)) break;

        if (sub.status === "active" || sub.status === "trialing") {
          
          await users().updateOne(
            { _id: new ObjectId(vendorId) },
            { $set: { subscriptionPlan: "premium", subscriptionExpiresAt: getPeriodEnd(sub) } }
          );
        } else if (["canceled", "unpaid", "incomplete_expired"].includes(sub.status)) {
          await users().updateOne(
            { _id: new ObjectId(vendorId) },
            { $set: { subscriptionPlan: "free" }, $unset: { subscriptionExpiresAt: "" } }
          );
        }
        break;
      }

      
      case "customer.subscription.deleted": {
        const sub = event.data.object as Stripe.Subscription;
        const vendorId = sub.metadata?.vendorId;
        if (!vendorId || !ObjectId.isValid(vendorId)) break;

        await users().updateOne(
          { _id: new ObjectId(vendorId) },
          { $set: { subscriptionPlan: "free" }, $unset: { subscriptionExpiresAt: "" } }
        );
        break;
      }
    }

    res.json({ received: true });
  } catch (err) {
    console.error("Webhook handling failed", err);
    
    res.status(500).send("Webhook handler failed");
  }
}