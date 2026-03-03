// /js/api.js
import { supabase } from "./supabaseClient.js";

/* -----------------------------
   EVENTS
------------------------------ */

export async function listEvents() {
  const { data, error } = await supabase.from("events").select("*").order("date", { ascending: true });

  if (error) {
    console.error("listEvents error:", error);
    throw error;
  }

  return data || [];
}

export async function getEventBySlug(slug) {
  const { data, error } = await supabase.from("events").select("*").eq("slug", slug).single();

  if (error) {
    console.error("getEventBySlug error:", error);
    throw error;
  }

  return data;
}

export async function getEventById(eventId) {
  const { data, error } = await supabase.from("events").select("*").eq("id", eventId).single();

  if (error) throw error;
  return data;
}

/* -----------------------------
   TASKS
------------------------------ */

export async function listTasksForEvent(eventId) {
  const { data, error } = await supabase.from("tasks").select("id,title,short_description,description,slug,event_id,created_at").eq("event_id", eventId).order("created_at", { ascending: true });

  if (error) {
    console.error("listTasksForEvent error:", error);
    throw error;
  }

  return data || [];
}

export async function getTaskBySlug(slug) {
  const { data, error } = await supabase.from("tasks").select("*").eq("slug", slug).single();

  if (error) throw error;
  return data;
}

/* -----------------------------
   COUNTS (RPC)
------------------------------ */

export async function listSlotsWithCountsForTask(taskId) {
  const { data, error } = await supabase.rpc("get_task_slots_with_counts", {
    p_task_id: taskId,
  });

  if (error) {
    console.error("listSlotsWithCountsForTask error:", error);
    throw error;
  }

  return (data || []).map((s) => ({
    id: s.id,
    capacity: s.capacity,
    start_time: s.start_time,
    end_time: s.end_time,
    registered: s.registered ?? 0,
  }));
}

export async function listTasksWithCountsForEvent(eventId) {
  const { data, error } = await supabase.rpc("get_tasks_with_counts", {
    p_event_id: eventId,
  });

  if (error) throw error;
  return data || [];
}

/* -----------------------------
   REGISTRATION (RPC)
------------------------------ */

export async function registerForSlot({ slotId, name, phone, note }) {
  const { data, error } = await supabase.rpc("register_for_slot", {
    p_slot_id: slotId,
    p_name: name,
    p_phone: phone ?? null,
    p_note: note ?? null,
  });

  if (error) throw error;
  return data; // registration_id
}

/* -----------------------------
   IMAGES (Storage)
------------------------------ */

export function getPublicImageUrl(imagePath) {
  if (!imagePath) return null;

  const { data } = supabase.storage.from("event-images").getPublicUrl(imagePath);

  return data?.publicUrl ?? null;
}

export async function uploadEventCover(eventId, file) {
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `events/${eventId}/cover.${ext}`;

  const { data, error } = await supabase.storage.from("event-images").upload(path, file, { upsert: true });

  if (error) throw error;
  return { path: data.path };
}

/* -----------------------------
   CRUD (Admin)
------------------------------ */

export async function createEvent(payload) {
  const { data, error } = await supabase.from("events").insert([payload]).select("*").single();

  if (error) throw error;
  return data;
}

export async function updateEvent(id, patch) {
  const { data, error } = await supabase.from("events").update(patch).eq("id", id).select("*").single();

  if (error) throw error;
  return data;
}

export async function deleteEvent(id) {
  const { error } = await supabase.from("events").delete().eq("id", id);
  if (error) throw error;
}

export async function createTask(payload) {
  const { data, error } = await supabase.from("tasks").insert([payload]).select("*").single();

  if (error) throw error;
  return data;
}

export async function updateTask(id, patch) {
  const { data, error } = await supabase.from("tasks").update(patch).eq("id", id).select("*").single();

  if (error) throw error;
  return data;
}

export async function deleteTask(id) {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  if (error) throw error;
}

export async function listSlotsForTask(taskId) {
  const { data, error } = await supabase.from("task_slots").select("id,task_id,start_time,end_time,capacity,created_at").eq("task_id", taskId).order("start_time", { ascending: true });

  if (error) throw error;
  return data || [];
}

export async function createSlot(payload) {
  const { data, error } = await supabase.from("task_slots").insert([payload]).select("*").single();

  if (error) throw error;
  return data;
}

export async function deleteSlot(id) {
  const { error } = await supabase.from("task_slots").delete().eq("id", id);
  if (error) throw error;
}

export async function listRegistrationsForTask(taskId) {
  const { data, error } = await supabase.rpc("get_registrations_for_task", {
    p_task_id: taskId,
  });

  if (error) throw error;

  // Gruppér tilbage til samme format som admin.js forventer: slots[] med registrations[]
  const bySlot = new Map();

  for (const row of data || []) {
    if (!bySlot.has(row.slot_id)) {
      bySlot.set(row.slot_id, {
        id: row.slot_id,
        start_time: row.start_time,
        end_time: row.end_time,
        capacity: row.capacity,
        registrations: [],
      });
    }

    if (row.reg_id) {
      bySlot.get(row.slot_id).registrations.push({
        id: row.reg_id,
        name: row.name,
        email: row.email,
        phone: row.phone,
      });
    }
  }

  return Array.from(bySlot.values());
}

export async function deleteRegistration(id) {
  const { error } = await supabase.from("registrations").delete().eq("id", id);
  if (error) throw error;
}

export async function listMyRegistrations() {
  const { data, error } = await supabase.rpc("get_my_registrations");
  if (error) throw error;
  return data || [];
}

export async function cancelMyRegistration(registrationId) {
  // RLS sørger for at man kun kan slette sin egen
  const { error } = await supabase.from("registrations").delete().eq("id", registrationId);

  if (error) throw error;
}

export async function isAdmin() {
  const { data, error } = await supabase.rpc("is_admin");
  if (error) throw error;
  return !!data;
}
