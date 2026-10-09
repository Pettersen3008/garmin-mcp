import { createGarminClient, parseLocalDate } from "../packages/garmin-connect/src/index.ts";

if (process.env.GARMIN_E2E !== "1") {
  throw new Error("Set GARMIN_E2E=1 to run the live Garmin check");
}

const localDate = (value: Date) =>
  [
    value.getFullYear(),
    String(value.getMonth() + 1).padStart(2, "0"),
    String(value.getDate()).padStart(2, "0"),
  ].join("-");
const date = parseLocalDate(process.argv[2] ?? localDate(new Date()));
const garmin = await createGarminClient({
  diagnostics: (event) => console.error(JSON.stringify(event)),
});
const activities = await garmin.activities.list({ limit: 1 });
const activity = activities[0];
if (!activity) {
  throw new Error("The account has no activity available for the activity detail check");
}

const workouts = await garmin.workouts.list({ limit: 1 });
await Promise.all([
  garmin.activities.get({ id: activity.id }),
  garmin.dailySummary.get({ date }),
  garmin.heartRate.get({ date }),
  garmin.health.getHrv({ date }),
  garmin.health.getStress({ date }),
  garmin.health.getBodyBattery({ date }),
  garmin.health.getRespiration({ date }),
  garmin.health.getBloodOxygen({ date }),
  garmin.health.getBodyComposition({ date }),
  garmin.sleep.get({ date }),
  garmin.training.getStatus({ date }),
  garmin.training.getReadiness({ date }),
  ...(workouts[0] ? [garmin.workouts.get({ id: workouts[0].id })] : []),
]);

let operationsChecked = workouts[0] ? 15 : 14;
if (process.env.GARMIN_E2E_WRITES === "1") {
  await garmin.activities.edit({ id: activity.id, name: activity.name });
  operationsChecked += 1;

  const workout = await garmin.workouts.create({
    name: `garmin-mcp live check ${Date.now()}`,
    sport: "running",
    steps: [{ kind: "warmup", end: { kind: "time", seconds: 60 } }],
  });
  operationsChecked += 1;
  try {
    await garmin.workouts.edit({
      id: workout.id,
      workout: {
        name: `${workout.name} edited`,
        sport: "running",
        steps: [{ kind: "warmup", end: { kind: "time", seconds: 90 } }],
      },
    });
    operationsChecked += 1;
    const schedule = await garmin.workouts.schedule({
      workoutId: workout.id,
      date: parseLocalDate(
        process.env.GARMIN_E2E_SCHEDULE_DATE ?? localDate(new Date(Date.now() + 86_400_000)),
      ),
    });
    operationsChecked += 1;
    await garmin.workouts.unschedule({ id: schedule.id });
    operationsChecked += 1;
  } finally {
    await garmin.workouts.delete({ id: workout.id });
    operationsChecked += 1;
  }

  const deleteActivityId = process.env.GARMIN_E2E_DELETE_ACTIVITY_ID;
  if (deleteActivityId !== undefined) {
    await garmin.activities.delete({ id: deleteActivityId });
    operationsChecked += 1;
  }
}

console.error(JSON.stringify({ date, operationsChecked, result: "ok" }));
