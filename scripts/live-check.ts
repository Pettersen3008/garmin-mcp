import {
  createGarminClient,
  parseLocalDate,
} from "../packages/garmin-connect/src/index.ts";

if (process.env.GARMIN_E2E !== "1") {
  throw new Error("Set GARMIN_E2E=1 to run the live Garmin check");
}

const now = new Date();
const defaultDate = [
  now.getFullYear(),
  String(now.getMonth() + 1).padStart(2, "0"),
  String(now.getDate()).padStart(2, "0"),
].join("-");
const date = parseLocalDate(process.argv[2] ?? defaultDate);
const garmin = await createGarminClient({
  diagnostics: (event) => console.error(JSON.stringify(event)),
});
const activities = await garmin.activities.list({ limit: 1 });
const activity = activities[0];
if (!activity) {
  throw new Error(
    "The account has no activity available for the activity detail check",
  );
}

await Promise.all([
  garmin.activities.get({ id: activity.id }),
  garmin.dailySummary.get({ date }),
  garmin.sleep.get({ date }),
  garmin.training.getStatus({ date }),
  garmin.training.getReadiness({ date }),
]);

console.error(JSON.stringify({ date, operationsChecked: 6, result: "ok" }));
