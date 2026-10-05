/**
 * STOŽER attendance aggregation (D-48, D-49).
 *
 * The percentage formula is LOCKED:
 *
 *   attendancePct = (present + late) / held * 100
 *
 * where `held` is the count of held (completed) trainings in the period that
 * occurred within the player's membership period [joined_on, left_on) for the
 * team. The caller computes that set (the per-player denominator) and passes it
 * as `heldTrainingIds`; this module only counts. `late` counts toward the
 * numerator but is exposed separately; excused / unexcused / unresolved
 * absences never count as attendance.
 */

export interface AttendanceRow {
  training_id: string;
  status: "present" | "absent" | "late";
  absence_resolution: "unresolved" | "excused" | "unexcused";
}

export interface AttendanceStats {
  held: number;
  present: number;
  late: number;
  absent: number;
  excused: number;
  unexcused: number;
  unresolved: number;
  attendancePct: number;
}

export function buildAttendanceStats(
  rows: AttendanceRow[],
  heldTrainingIds: Set<string>
): AttendanceStats {
  const held = heldTrainingIds.size;
  const eligible = rows.filter((row) => heldTrainingIds.has(row.training_id));

  const present = eligible.filter((row) => row.status === "present").length;
  const late = eligible.filter((row) => row.status === "late").length;
  const absent = eligible.filter((row) => row.status === "absent").length;
  const excused = eligible.filter(
    (row) => row.status === "absent" && row.absence_resolution === "excused"
  ).length;
  const unexcused = eligible.filter(
    (row) => row.status === "absent" && row.absence_resolution === "unexcused"
  ).length;
  const unresolved = eligible.filter(
    (row) => row.status === "absent" && row.absence_resolution === "unresolved"
  ).length;

  const attendancePct =
    held === 0 ? 0 : Math.round(((present + late) / held) * 1000) / 10;

  return {
    held,
    present,
    late,
    absent,
    excused,
    unexcused,
    unresolved,
    attendancePct,
  };
}
