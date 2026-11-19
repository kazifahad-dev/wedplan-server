import "dotenv/config";
import { connectDB } from "../config/db.js";

const email = process.argv[2];

// প্রতিটা সার্ভিসে ৩টা করে ছবি (Service Details পেজের গ্যালারির জন্য)
const img = (seed: string) => [
  `https://picsum.photos/seed/${seed}-1/800/600`,
  `https://picsum.photos/seed/${seed}-2/800/600`,
  `https://picsum.photos/seed/${seed}-3/800/600`,
];

const SAMPLES = [
  {
    serviceName: "Golden Hour Wedding Photography",
    category: "Photography & Videography",
    description:
      "Full-day wedding photography with two photographers, candid and portrait coverage, and a edited gallery of 400+ photos delivered within three weeks.",
    price: 1200,
    location: "Dhaka",
    images: img("photo-a"),
  },
  {
    serviceName: "Cinematic Wedding Films",
    category: "Photography & Videography",
    description:
      "Cinematic highlight film, full ceremony recording and drone footage, with licensed music and a 5-minute teaser for social media.",
    price: 1800,
    location: "Chattogram",
    images: img("film-b"),
  },
  {
    serviceName: "Royal Garden Banquet Hall",
    category: "Wedding Venues",
    description:
      "Elegant banquet hall with an attached garden lawn for up to 600 guests, air conditioning, bridal suite and ample parking.",
    price: 4500,
    location: "Dhaka",
    images: img("venue-c"),
  },
  {
    serviceName: "Lakeside Resort Wedding Venue",
    category: "Wedding Venues",
    description:
      "A scenic lakeside resort for destination weddings with on-site accommodation for 80 guests, sunset ceremony deck and event coordination.",
    price: 6000,
    location: "Sylhet",
    images: img("venue-d"),
  },
  {
    serviceName: "Bloom & Petal Stage Decoration",
    category: "Decoration & Florist",
    description:
      "Custom stage, entrance gate and table decoration with fresh flowers, fairy lights and a themed colour palette matched to your wedding.",
    price: 900,
    location: "Dhaka",
    images: img("deco-e"),
  },
  {
    serviceName: "Signature Wedding Feast Catering",
    category: "Catering Services",
    description:
      "Traditional and continental menu options for 100 to 1000 guests with live counters, professional serving staff and complete cleanup.",
    price: 2500,
    location: "Rajshahi",
    images: img("food-f"),
  },
  {
    serviceName: "Bridal Glow Makeup & Styling",
    category: "Makeup & Styling",
    description:
      "Professional bridal makeup, hair styling and saree draping by a certified artist, including a free trial session before the big day.",
    price: 350,
    location: "Dhaka",
    images: img("makeup-g"),
  },
  {
    serviceName: "Heritage Bridal Couture",
    category: "Wedding Fashion",
    description:
      "Handcrafted bridal lehengas, sherwanis and matching accessories with free fittings and alterations for the whole wedding party.",
    price: 1500,
    location: "Chattogram",
    images: img("fashion-h"),
  },
];

async function main() {
  if (!email) {
    console.error("Usage: npm run seed -- <vendor-email>");
    process.exit(1);
  }

  const db = await connectDB();
  const vendor = await db.collection("user").findOne({ email, role: "vendor" });

  if (!vendor) {
    console.error("No vendor found with that email. Sign up as a Vendor first.");
    process.exit(1);
  }

  const services = db.collection("services");

  // আগের নমুনা মুছে নতুন করে বসাই, যাতে বারবার চালালে ডুপ্লিকেট না হয়
  await services.deleteMany({ isSample: true });

  const docs = SAMPLES.map((s, i) => ({
    ...s,
    vendorId: vendor._id.toString(),
    status: "approved",
    isActive: true,
    isSample: true,
    createdAt: new Date(Date.now() - i * 60 * 60 * 1000), // এক ঘণ্টা করে ফারাক
  }));

  await services.insertMany(docs);
  console.log(`Added ${docs.length} sample services for ${email}`);
  process.exit(0);
}

main();