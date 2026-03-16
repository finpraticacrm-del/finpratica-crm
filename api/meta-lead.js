import { createClient } from "@supabase/supabase-js";

export const handler = async (event) => {
  const sb = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );
  // ── GET — verifica token Meta ─────────────────────────────
  if (event.httpMethod === "GET") {
    const p         = event.queryStringParameters || {};
    const mode      = p["hub.mode"];
    const token     = p["hub.verify_token"];
    const challenge = p["hub.challenge"];

    if (mode === "subscribe" && token === "finpratica2026") {
      return { statusCode: 200, body: challenge };
    }
    return { statusCode: 403, body: "Forbidden" };
  }

  // ── POST — riceve lead da Facebook Lead Form Ads ──────────
  if (event.httpMethod === "POST") {
    try {
      const body    = JSON.parse(event.body || "{}");
      const entries = body.entry || [];

      for (const entry of entries) {
        for (const change of entry.changes || []) {
          const value  = change.value || {};
          const fields = value.field_data || [];

          const get = (name) =>
            fields.find((f) => f.name === name)?.values?.[0] || "";

          const lead = {
            nome:     get("first_name") || get("full_name").split(" ")[0] || "",
            cognome:  get("last_name")  || get("full_name").split(" ").slice(1).join(" ") || "",
            telefono: get("phone_number") || get("phone") || "",
            email:    get("email") || "",
            note:     `Lead da Facebook Lead Ads · Form ID: ${value.form_id || ""} · Ad ID: ${value.ad_id || ""}`,
            canale:   "facebook",
            fonte:    "meta_lead_ads",
            stato:    "nuovo",
            data:     new Date().toISOString().split("T")[0],
          };

          const { error } = await sb.from("fp_clienti").insert([lead]);
          if (error) console.error("Supabase insert error:", error.message);
        }
      }

      return { statusCode: 200, body: "OK" };
    } catch (err) {
      console.error("POST /api/meta-lead error:", err.message);
      return { statusCode: 500, body: err.message };
    }
  }

  return { statusCode: 405, body: "Method Not Allowed" };
};
