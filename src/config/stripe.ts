import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) throw new Error("STRIPE_SECRET_KEY .env ফাইলে নেই");

export const stripe = new Stripe(key);


export const PREMIUM_PRICE_CENTS = 1999;