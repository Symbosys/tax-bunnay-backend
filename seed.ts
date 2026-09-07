import "dotenv/config";
import bcrypt from "bcrypt";
import { prisma } from "./src/db/prisma";

/**
 * Platform Administrator & Default Data Seeder
 * 
 * Usage:
 *   npx tsx platformSeed.ts
 *   npx tsx platformSeed.ts [email] [password]
 */
async function seedPlatformAdmin() {
  console.log("======================================================");
  console.log("🚀 Starting Platform Administrator Seeding...");
  console.log("======================================================\n");

  // 1. Determine admin credentials from CLI args, ENV, or production defaults
  const cliEmail = process.argv[2];
  const cliPassword = process.argv[3];

  const adminEmail = (cliEmail || process.env.ADMIN_EMAIL || "admin@platform-billing.com").toLowerCase().trim();
  const adminPassword = cliPassword || process.env.ADMIN_PASSWORD || "Admin@123";
  const adminName = process.env.ADMIN_NAME || "Platform Super Administrator";
  const adminPhone = process.env.ADMIN_PHONE || "+919876543210";

  console.log(`📌 Primary Target Admin Email: ${adminEmail}`);

  // 2. Hash the password using bcrypt with 10 salt rounds
  const saltRounds = 10;
  const passwordHash = await bcrypt.hash(adminPassword, saltRounds);

  // 3. Upsert Primary Platform Admin
  const primaryAdmin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      fullName: adminName,
      passwordHash: passwordHash,
      phone: adminPhone,
      isPlatformAdmin: true,
      isActive: true,
      isEmailVerified: true,
    },
    create: {
      fullName: adminName,
      email: adminEmail,
      passwordHash: passwordHash,
      phone: adminPhone,
      isPlatformAdmin: true,
      isActive: true,
      isEmailVerified: true,
    },
  });

  console.log(`✅ Platform Admin successfully provisioned!`);
  console.log(`   - ID: ${primaryAdmin.id}`);
  console.log(`   - Name: ${primaryAdmin.fullName}`);
  console.log(`   - Email: ${primaryAdmin.email}`);
  console.log(`   - isPlatformAdmin: ${primaryAdmin.isPlatformAdmin}`);
  console.log(`   - isActive: ${primaryAdmin.isActive}`);
  console.log(`   - isEmailVerified: ${primaryAdmin.isEmailVerified}\n`);

  // 4. Ensure any existing admin accounts (like saif@gmail.com) maintain active admin privileges
  const secondaryAdmins = ["saif@gmail.com"];
  for (const secEmail of secondaryAdmins) {
    if (secEmail !== adminEmail) {
      const existingUser = await prisma.user.findUnique({
        where: { email: secEmail },
      });
      if (existingUser) {
        await prisma.user.update({
          where: { email: secEmail },
          data: {
            isPlatformAdmin: true,
            isActive: true,
            isEmailVerified: true,
          },
        });
        console.log(`🛡️  Verified existing admin permissions for: ${secEmail} (isPlatformAdmin: true)`);
      }
    }
  }

  // 5. Seed default SaaS Subscription Plans if missing
  console.log("\n📦 Checking SaaS Subscription Plans...");
  const defaultPlans = [
    {
      name: "Starter",
      description: JSON.stringify({
        tagline: "Essential billing & inventory for single-store retailers",
        priceYearly: 7990,
        features: [
          "Up to 3 Team Members",
          "500 Invoices / month",
          "1 Warehouse / Store",
          "Basic GST Invoicing (B2B, B2C)",
          "Standard Reports",
        ],
      }),
      price: 799.0,
      billingCycle: "MONTHLY" as const,
      maxUsers: 3,
      maxInvoicesPerMonth: 500,
      maxWarehouses: 1,
      hasPOS: true,
      hasManufacturing: false,
      hasAdvancedReports: false,
      hasApiAccess: false,
      isActive: true,
    },
    {
      name: "Growth",
      description: JSON.stringify({
        tagline: "Advanced multi-branch ERP with POS, GST & automated reporting",
        priceYearly: 19990,
        features: [
          "Up to 10 Team Members",
          "Unlimited Invoices",
          "3 Warehouses / Branches",
          "High-Speed Retail POS Counter",
          "GSTR-1, GSTR-3B Auto Reports",
          "E-Way Bill & E-Invoice Integration",
          "24/7 WhatsApp & Priority Support",
        ],
      }),
      price: 1999.0,
      billingCycle: "MONTHLY" as const,
      maxUsers: 10,
      maxInvoicesPerMonth: null,
      maxWarehouses: 3,
      hasPOS: true,
      hasManufacturing: false,
      hasAdvancedReports: true,
      hasApiAccess: true,
      isActive: true,
    },
    {
      name: "Enterprise",
      description: JSON.stringify({
        tagline: "Unlimited multi-tenant enterprise control with custom workflows",
        priceYearly: 49990,
        features: [
          "Unlimited Team Members",
          "Unlimited Invoices & Warehouses",
          "Complete Manufacturing & BOM",
          "Double-Entry General Ledger",
          "Custom API & Webhooks Access",
          "Dedicated Account Manager",
          "99.9% Uptime SLA",
        ],
      }),
      price: 4999.0,
      billingCycle: "MONTHLY" as const,
      maxUsers: null,
      maxInvoicesPerMonth: null,
      maxWarehouses: null,
      hasPOS: true,
      hasManufacturing: true,
      hasAdvancedReports: true,
      hasApiAccess: true,
      isActive: true,
    },
  ];

  for (const planData of defaultPlans) {
    const plan = await prisma.plan.upsert({
      where: { name: planData.name },
      update: {
        description: planData.description,
        price: planData.price,
        billingCycle: planData.billingCycle,
        maxUsers: planData.maxUsers,
        maxInvoicesPerMonth: planData.maxInvoicesPerMonth,
        maxWarehouses: planData.maxWarehouses,
        hasPOS: planData.hasPOS,
        hasManufacturing: planData.hasManufacturing,
        hasAdvancedReports: planData.hasAdvancedReports,
        hasApiAccess: planData.hasApiAccess,
        isActive: true,
      },
      create: planData,
    });
    console.log(`   -> Plan "${plan.name}" (₹${plan.price}/mo) ready.`);
  }

  // 6. Summary and next steps
  console.log("\n======================================================");
  console.log("🎉 Seeding Completed Successfully!");
  console.log("======================================================");
  console.log("🔑 PLATFORM ADMIN LOGIN CREDENTIALS:");
  console.log(`   - Portal: Platform Admin Portal`);
  console.log(`   - Email:    ${adminEmail}`);
  console.log(`   - Password: ${adminPassword}`);
  console.log("------------------------------------------------------");
  console.log("🖥️  HOW TO ACCESS:");
  console.log("   1. In Flutter App, go to Login screen (/login)");
  console.log("   2. Switch to 'Platform Admin' tab");
  console.log("   3. Enter the email & password above");
  console.log("   4. You will be redirected to /platform-admin Dashboard!");
  console.log("======================================================\n");
}

seedPlatformAdmin()
  .catch((error) => {
    console.error("❌ Seeding failed with error:", error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
