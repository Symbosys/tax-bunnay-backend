import { prisma } from './src/db/prisma';

async function main() {
  const users = await prisma.user.findMany({
    select: {
      id: true,
      email: true,
      fullName: true,
      isPlatformAdmin: true,
      ownedBusinesses: { select: { id: true, businessName: true } },
      businessMemberships: { select: { id: true, businessId: true, role: true } },
    },
  });
  console.log('=== USERS IN DATABASE ===');
  console.log(JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

main().catch(console.error);
