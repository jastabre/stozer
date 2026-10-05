import { describe, expect, it } from "vitest";
import { buildAttendanceStats, type AttendanceRow } from "@/lib/attendance";

function row(
  training_id: string,
  status: AttendanceRow["status"],
  absence_resolution: AttendanceRow["absence_resolution"] = "unresolved"
): AttendanceRow {
  return { training_id, status, absence_resolution };
}

describe("buildAttendanceStats", () => {
  it("counts present + late toward attendance and exposes late separately", () => {
    const stats = buildAttendanceStats(
      [
        row("t1", "present"),
        row("t2", "late"),
        row("t3", "absent", "unresolved"),
      ],
      new Set(["t1", "t2", "t3"])
    );
    expect(stats.held).toBe(3);
    expect(stats.present).toBe(1);
    expect(stats.late).toBe(1);
    expect(stats.attendancePct).toBe(66.7); // (1 + 1) / 3 * 100
  });

  it("does not count excused/unexcused/unresolved as attendance", () => {
    const stats = buildAttendanceStats(
      [
        row("t1", "present"),
        row("t2", "absent", "excused"),
        row("t3", "absent", "unexcused"),
        row("t4", "absent", "unresolved"),
      ],
      new Set(["t1", "t2", "t3", "t4"])
    );
    expect(stats.present).toBe(1);
    expect(stats.excused).toBe(1);
    expect(stats.unexcused).toBe(1);
    expect(stats.unresolved).toBe(1);
    expect(stats.attendancePct).toBe(25); // 1 / 4
  });

  it("excludes rows whose training is outside the held denominator", () => {
    const stats = buildAttendanceStats(
      [row("held", "present"), row("cancelled", "absent", "unresolved")],
      new Set(["held"])
    );
    expect(stats.held).toBe(1);
    expect(stats.present).toBe(1);
    expect(stats.absent).toBe(0);
    expect(stats.attendancePct).toBe(100);
  });

  it("returns 0% when the held denominator is empty", () => {
    const stats = buildAttendanceStats([], new Set());
    expect(stats.held).toBe(0);
    expect(stats.attendancePct).toBe(0);
  });
});
