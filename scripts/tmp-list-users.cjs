const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    take: 15,
    select: {
      id: true,
      telegramId: true,
      firstName: true,
      username: true,
      createdAt: true,
      updatedAt: true,
    },
  });
  console.log(
    JSON.stringify(
      users.map((u) => ({ ...u, telegramId: u.telegramId.toString() })),
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
