import type { GetJson } from "../../http/request.ts";
import type { LocalDate } from "../../local-date.ts";
import {
  mapDailyBloodOxygen,
  mapDailyBodyBattery,
  mapDailyBodyComposition,
  mapDailyHrv,
  mapDailyRespiration,
  mapDailyStress,
} from "./map.ts";
import type {
  DailyBloodOxygen,
  DailyBodyBattery,
  DailyBodyComposition,
  DailyHrv,
  DailyRespiration,
  DailyStress,
} from "./model.ts";

export async function getDailyHrv(
  getJson: GetJson,
  input: { date: LocalDate },
): Promise<DailyHrv | null> {
  return mapDailyHrv(await getJson({ path: `/hrv-service/hrv/${input.date}` }));
}

export async function getDailyStress(
  getJson: GetJson,
  input: { date: LocalDate },
): Promise<DailyStress> {
  return mapDailyStress(
    await getJson({
      path: `/wellness-service/wellness/dailyStress/${input.date}`,
    }),
  );
}

export async function getDailyBodyBattery(
  getJson: GetJson,
  input: { date: LocalDate },
): Promise<DailyBodyBattery | null> {
  return mapDailyBodyBattery(
    await getJson({
      path: "/wellness-service/wellness/bodyBattery/reports/daily",
      query: { startDate: input.date, endDate: input.date },
    }),
  );
}

export async function getDailyRespiration(
  getJson: GetJson,
  input: { date: LocalDate },
): Promise<DailyRespiration> {
  return mapDailyRespiration(
    await getJson({
      path: `/wellness-service/wellness/daily/respiration/${input.date}`,
    }),
  );
}

export async function getDailyBloodOxygen(
  getJson: GetJson,
  input: { date: LocalDate },
): Promise<DailyBloodOxygen> {
  return mapDailyBloodOxygen(
    await getJson({
      path: `/wellness-service/wellness/daily/spo2/${input.date}`,
    }),
  );
}

export async function getDailyBodyComposition(
  getJson: GetJson,
  input: { date: LocalDate },
): Promise<DailyBodyComposition> {
  return mapDailyBodyComposition(
    input.date,
    await getJson({
      path: "/weight-service/weight/dateRange",
      query: { startDate: input.date, endDate: input.date },
    }),
  );
}
