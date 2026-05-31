const { PrismaClient } = require("@prisma/client");

const userId = process.argv[2] || "cmptg3cnm0000ii04xtkbnp11";

const prisma = new PrismaClient();

async function main() {
  const memberships = await prisma.householdMember.findMany({
    where: { userId },
    include: { household: true },
  });
  console.log(JSON.stringify(memberships, null, 2));
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
