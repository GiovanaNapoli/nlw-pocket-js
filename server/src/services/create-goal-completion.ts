import { and, count, eq, gte, lte, sql } from 'drizzle-orm';
import { db } from '../db';
import { goalCompletions, goals } from '../db/schema';
import dayjs from 'dayjs';

interface CreateGoalCompletionRequest {
  goalId: string;
}

export async function createGoalCompletion({ goalId }: CreateGoalCompletionRequest) {
  const firstDayOffWeek = dayjs().startOf('week').toDate();
  const lastDayOfWeek = dayjs().endOf('week');

  const goalCompletionCount = db.$with('goal_completion_count').as(
    db
      .select({
        goalId: goalCompletions.goalId,
        completionCount: count(goalCompletions.goalId).as('completionCount'),
      })
      .from(goalCompletions)
      .where(
        and(
          gte(goalCompletions.createdAt, firstDayOffWeek),
          lte(goalCompletions.createdAt, lastDayOfWeek),
          eq(goalCompletions.goalId, goalId),
        ),
      )
      .groupBy(goalCompletions.goalId),
  );

  const result = await db
    .with(goalCompletionCount)
    .select({
      desiredWeeklyFrequency: goals.desiredWeeklyFrequency,
      completionCount: sql /*sql*/`COALESCE(${goalCompletionCount.completionCount}, 0)`.mapWith(Number),
    })
    .from(goals)
    .leftJoin(goalCompletionCount, eq(goalCompletionCount.goalId, goals.id))
    .where(eq(goals.id, goalId));

  const { completionCount, desiredWeeklyFrequency } = result[0];

  if (completionCount >= desiredWeeklyFrequency) {
    throw new Error('Goal already completed this week!');
  }

  const insertResult = await db.insert(goalCompletions).values({ goalId }).returning();
  const goalCompletion = insertResult[0];

  return {
    goalCompletion,
  };
}
