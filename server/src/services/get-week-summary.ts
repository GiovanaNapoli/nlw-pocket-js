import dayjs from 'dayjs';
import { db } from '../db';
import { goalCompletions, goals } from '../db/schema';
import { and, eq, gte, lte, sql } from 'drizzle-orm';

export async function getWeekSummary() {
  const firstDayOfWeek = dayjs().startOf('week').toDate();
  const lastDayOfWeek = dayjs().endOf('week').toDate();

  const goalsCreatedUpToWeek = db.$with('goals_created_up_to_week').as(
    db
      .select({
        id: goals.id,
        title: goals.title,
        desiredWeeklyFrequency: goals.desiredWeeklyFrequency,
        createdAt: goals.createdAt,
      })
      .from(goals)
      .where(lte(goals.createdAt, lastDayOfWeek)),
  );
  const goalCompletedInWeek = db.$with('goal_completed_week').as(
    db
      .select({
        id: goals.id,
        title: goals.title,
        completedAt: goalCompletions.createdAt,
        completedAtDate: sql /*sql*/`DATE(${goalCompletions.createdAt})`.as('completedDate'),
      })
      .from(goalCompletions)
      .innerJoin(goals, eq(goals.id, goalCompletions.goalId))
      .where(and(gte(goalCompletions.createdAt, firstDayOfWeek), lte(goalCompletions.createdAt, lastDayOfWeek))),
  );
  const goalCompletedByWeekDay = db.$with('goals_completed_by_week').as(
    db
      .select({
        completedAtDate: goalCompletedInWeek.completedAtDate,
        completions: sql /*sql*/`
          JSON_AGG(
            JSON_BUILD_OBJECT(
              'id', ${goalCompletedInWeek.id},
              'title', ${goalCompletedInWeek.title},
              'completedAt', ${goalCompletedInWeek.completedAt}
            )
          )
        `.as('completions'),
      })
      .from(goalCompletedInWeek)
      .groupBy(goalCompletedInWeek.completedAtDate),
  );

  const result = await db
    .with(goalsCreatedUpToWeek, goalCompletedInWeek, goalCompletedByWeekDay)
    .select({
      completed: sql /*sql*/`(SELECT COUNT(*) FROM ${goalCompletedInWeek})`.mapWith(Number),
      total:
        sql /*sql*/`(SELECT SUM(${goalsCreatedUpToWeek.desiredWeeklyFrequency}) FROM ${goalsCreatedUpToWeek})`.mapWith(
          Number,
        ),
      goalsPerDay: sql /*sql*/`JSON_OBJECT_AGG(
        ${goalCompletedByWeekDay.completedAtDate},${goalCompletedByWeekDay.completions}
      )`,
    })
    .from(goalCompletedByWeekDay);

  return {
    summary: result,
  };
}
