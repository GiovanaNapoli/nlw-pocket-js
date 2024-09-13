import { client, db } from '.';
import { goalCompletions, goals } from './schema';
import dayjs from 'dayjs';

async function seed() {
  // @ts-ignore
  await db.delete(goalCompletions);
  // @ts-ignore
  await db.delete(goals);

  const result = await db
    // @ts-ignore
    .insert(goals)
    .values([
      { title: 'Acordar cedo', desiredWeeklyFrequency: 5 },
      { title: 'Me exercitar', desiredWeeklyFrequency: 3 },
      { title: 'Meditar', desiredWeeklyFrequency: 1 },
    ])
    .returning();

  const startOfWeek = dayjs().startOf('week');

  // @ts-ignore
  await db.insert(goalCompletions).values([
    { goalId: result[0].id, createdAt: startOfWeek.toDate() },
    { goalId: result[1].id, createdAt: startOfWeek.add(1, 'day').toDate() },
  ]);
}

seed().finally(() => {
  client.end();
});
