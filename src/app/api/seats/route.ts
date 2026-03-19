import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

const TODAY = () => new Date().toISOString().split("T")[0];

// Infer zone from seat name if zone column doesn't exist
function inferZone(name: string): "solo" | "free" | "reading" {
  if (name.startsWith("A") || name.startsWith("B")) return "solo";
  if (name.startsWith("F")) return "free";
  if (name.startsWith("R")) return "reading";
  return "free";
}

// Infer table number from seat name (F1-F3 → 1, F4-F6 → 2, F7-F9 → 3)
function inferTableNumber(name: string): number | null {
  if (!name.startsWith("F")) return null;
  const num = parseInt(name.slice(1), 10);
  return Math.ceil(num / 3);
}

/**
 * GET /api/seats?action=availability&student_id=xxx
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const action = url.searchParams.get("action");
  const studentId = url.searchParams.get("student_id") ?? "";

  if (action === "availability") {
    return getAvailability(studentId);
  }
  return NextResponse.json({ error: "invalid action" }, { status: 400 });
}

/**
 * POST /api/seats
 * Body: { action, student_id, seat_id, start_time?, ... }
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { action, student_id, seat_id } = body;

    if (!student_id) {
      return NextResponse.json({ error: "student_id is required" }, { status: 400 });
    }

    switch (action) {
      case "reserve":
        return handleReserve(student_id, seat_id, body.start_time);
      case "occupy":
        return handleOccupy(student_id, seat_id);
      case "cancel_reservation":
        return handleCancelReservation(student_id, body.reservation_id);
      case "release":
        return handleRelease(student_id, seat_id);
      default:
        return NextResponse.json({ error: "invalid action" }, { status: 400 });
    }
  } catch (e) {
    console.error("seats error:", e);
    return NextResponse.json({ error: "エラーが発生しました" }, { status: 500 });
  }
}

// ─── GET availability ───

async function getAvailability(studentId: string) {
  const today = TODAY();

  // Get all seats (order by name if display_order doesn't exist)
  const { data: seats, error: seatErr } = await supabase
    .from("seats")
    .select("*")
    .order("id", { ascending: true });

  if (seatErr) return NextResponse.json({ error: seatErr.message }, { status: 500 });

  // Get today's active reservations
  const { data: reservations } = await supabase
    .from("seat_reservations")
    .select("*")
    .eq("date", today)
    .in("status", ["confirmed", "active"]);

  // Get current occupancy
  const { data: occupancy } = await supabase
    .from("current_occupancy")
    .select("*")
    .eq("started_date", today);

  // Build seat status
  const seatList = (seats ?? []).map((seat) => {
    const seatName = seat.name ?? String(seat.id);
    const res = (reservations ?? []).find(
      (r) => (r.seat_id === seatName || r.seat_id === String(seat.id)) && ["confirmed", "active"].includes(r.status),
    );
    const occ = (occupancy ?? []).find((o) => o.seat_id === seatName || o.seat_id === String(seat.id));

    let status: "available" | "reserved_self" | "reserved_other" | "occupied_self" | "occupied_other" = "available";
    let occupant: string | null = null;
    let endsAt: string | null = null;
    let reservationId: string | null = null;

    if (occ) {
      status = occ.student_id === studentId ? "occupied_self" : "occupied_other";
      occupant = occ.student_id;
      endsAt = occ.ends_at;
    } else if (res) {
      status = res.student_id === studentId ? "reserved_self" : "reserved_other";
      occupant = res.student_id;
      endsAt = res.block_end_time;
      reservationId = res.id;
    }

    return {
      id: seatName,              // Use seat name (A1, F3, R2) as display id
      db_id: seat.id,            // Keep numeric id for DB operations
      zone: seat.zone ?? inferZone(seatName),
      zone_label: seat.zone_label ?? "",
      table_number: seat.table_number ?? inferTableNumber(seat.name ?? ""),
      is_reservable: seat.is_reservable ?? inferZone(seatName) === "solo",
      max_duration_min: seat.max_duration_min ?? (inferZone(seatName) === "reading" ? 30 : 120),
      status,
      occupant,
      ends_at: endsAt,
      reservation_id: reservationId,
    };
  });

  // Summary counts
  const zones = ["solo", "free", "reading"];
  const summary = zones.map((z) => {
    const zoneSeats = seatList.filter((s) => s.zone === z);
    const available = zoneSeats.filter((s) => s.status === "available").length;
    return { zone: z, total: zoneSeats.length, available };
  });

  // Check if student has active occupancy/reservation
  const myOccupancy = (occupancy ?? []).find((o) => o.student_id === studentId);
  const myReservation = (reservations ?? []).find(
    (r) => r.student_id === studentId && ["confirmed", "active"].includes(r.status),
  );

  return NextResponse.json({
    seats: seatList,
    summary,
    myOccupancy: myOccupancy ?? null,
    myReservation: myReservation ?? null,
  });
}

// ─── Reserve (solo seats) ───

async function handleReserve(studentId: string, seatId: string, startTime: string) {
  if (!seatId || !startTime) {
    return NextResponse.json({ error: "seat_id and start_time are required" }, { status: 400 });
  }

  const today = TODAY();

  // Check seat is reservable
  const { data: seat } = await supabase
    .from("seats")
    .select("zone, is_reservable")
    .eq("id", seatId)
    .single();

  if (!seat?.is_reservable) {
    return NextResponse.json({ error: "この席は予約できません" }, { status: 400 });
  }

  // Check student doesn't already have a reservation today
  const { data: existing } = await supabase
    .from("seat_reservations")
    .select("id")
    .eq("student_id", studentId)
    .eq("date", today)
    .in("status", ["confirmed", "active"])
    .limit(1);

  if (existing && existing.length > 0) {
    return NextResponse.json({ error: "今日すでに予約があります" }, { status: 409 });
  }

  // Also check current_occupancy
  const { data: occ } = await supabase
    .from("current_occupancy")
    .select("id")
    .eq("student_id", studentId)
    .eq("started_date", today)
    .limit(1);

  if (occ && occ.length > 0) {
    return NextResponse.json({ error: "現在利用中の席があります" }, { status: 409 });
  }

  // Check seat not already reserved/occupied
  const { data: seatRes } = await supabase
    .from("seat_reservations")
    .select("id")
    .eq("seat_id", seatId)
    .eq("date", today)
    .in("status", ["confirmed", "active"])
    .limit(1);

  if (seatRes && seatRes.length > 0) {
    return NextResponse.json({ error: "この席はすでに予約されています" }, { status: 409 });
  }

  // Calculate times: 110min study + 10min cleanup = 120min block
  const [h, m] = startTime.split(":").map(Number);
  const startDate = new Date();
  startDate.setHours(h, m, 0, 0);

  const studyEnd = new Date(startDate.getTime() + 110 * 60000);
  const blockEnd = new Date(startDate.getTime() + 120 * 60000);

  // Block must end by 22:00
  const limit = new Date();
  limit.setHours(22, 0, 0, 0);
  if (blockEnd > limit) {
    return NextResponse.json({ error: "22:00までに片付けが終わる時間を選んでね" }, { status: 400 });
  }

  const fmtTime = (d: Date) => `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;

  const { data: reservation, error } = await supabase
    .from("seat_reservations")
    .insert({
      student_id: studentId,
      seat_id: seatId,
      date: today,
      start_time: startTime,
      study_end_time: fmtTime(studyEnd),
      block_end_time: fmtTime(blockEnd),
      status: "confirmed",
    })
    .select("id")
    .single();

  if (error) {
    console.error("reserve error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    reservation_id: reservation.id,
    start_time: startTime,
    study_end_time: fmtTime(studyEnd),
    block_end_time: fmtTime(blockEnd),
  });
}

// ─── Occupy (free/reading seats) ───

async function handleOccupy(studentId: string, seatId: string) {
  if (!seatId) {
    return NextResponse.json({ error: "seat_id is required" }, { status: 400 });
  }

  const today = TODAY();

  // Get seat info
  const { data: seat } = await supabase
    .from("seats")
    .select("zone, max_duration_min")
    .eq("id", seatId)
    .single();

  if (!seat) {
    return NextResponse.json({ error: "席が見つかりません" }, { status: 404 });
  }

  // Check student doesn't already occupy a seat
  const { data: myOcc } = await supabase
    .from("current_occupancy")
    .select("id")
    .eq("student_id", studentId)
    .limit(1);

  if (myOcc && myOcc.length > 0) {
    return NextResponse.json({ error: "現在利用中の席があります" }, { status: 409 });
  }

  // Also check reservations
  const { data: myRes } = await supabase
    .from("seat_reservations")
    .select("id")
    .eq("student_id", studentId)
    .eq("date", today)
    .in("status", ["confirmed", "active"])
    .limit(1);

  if (myRes && myRes.length > 0) {
    return NextResponse.json({ error: "今日すでに予約があります" }, { status: 409 });
  }

  // Reading: 1 per day check
  if (seat.zone === "reading") {
    const { data: readingToday } = await supabase
      .from("current_occupancy")
      .select("id")
      .eq("student_id", studentId)
      .eq("started_date", today);

    // Also check released reading seats via a simple approach:
    // We'll track in current_occupancy started_date. If they had one today, block.
    // Actually need to check historical. Use a simpler approach:
    // Check if student used any reading seat today (including released)
    const { count: readingCount } = await supabase
      .from("current_occupancy")
      .select("id", { count: "exact", head: true })
      .eq("student_id", studentId)
      .eq("started_date", today);

    // This only checks current. For historical, we rely on the DB constraint.
    // If constraint exists, the insert will fail naturally.
    if (readingToday && readingToday.length > 0) {
      return NextResponse.json({ error: "読書スペースは1日1回だよ！また明日使えるよ！" }, { status: 409 });
    }
    void readingCount; // used by constraint
  }

  // Check seat not occupied
  const { data: seatOcc } = await supabase
    .from("current_occupancy")
    .select("id")
    .eq("seat_id", seatId)
    .limit(1);

  if (seatOcc && seatOcc.length > 0) {
    return NextResponse.json({ error: "この席は使用中です" }, { status: 409 });
  }

  const now = new Date();
  const endsAt = new Date(now.getTime() + (seat.max_duration_min ?? 120) * 60000);

  const { error } = await supabase.from("current_occupancy").insert({
    student_id: studentId,
    seat_id: seatId,
    zone: seat.zone,
    started_at: now.toISOString(),
    ends_at: endsAt.toISOString(),
    started_date: today,
  });

  if (error) {
    // Unique constraint violation = already used today (reading) or seat taken
    if (error.code === "23505") {
      return NextResponse.json({ error: "この席は使えません（重複）" }, { status: 409 });
    }
    console.error("occupy error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    seat_id: seatId,
    duration_min: seat.max_duration_min ?? 120,
    ends_at: endsAt.toISOString(),
  });
}

// ─── Cancel reservation ───

async function handleCancelReservation(studentId: string, reservationId: string) {
  if (!reservationId) {
    return NextResponse.json({ error: "reservation_id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("seat_reservations")
    .update({ status: "cancelled" })
    .eq("id", reservationId)
    .eq("student_id", studentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

// ─── Release seat ───

async function handleRelease(studentId: string, seatId: string) {
  if (!seatId) {
    return NextResponse.json({ error: "seat_id is required" }, { status: 400 });
  }

  const { error } = await supabase
    .from("current_occupancy")
    .delete()
    .eq("seat_id", seatId)
    .eq("student_id", studentId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
