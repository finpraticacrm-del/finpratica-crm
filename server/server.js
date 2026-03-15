const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const app  = express();
const PORT = process.env.PORT || 3000;

const sb = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ── Health check ─────────────────────────────────────────────
app.get("/", (req, res) => {
  res.json({ status: "ok", service: "finpratica-webhook" });
});

// ── POST /api/lead — landing page, Zapier, form generici ─────
app.post("/api/lead", async (req, res) => {
  try {
    const body = req.body;

    const lead = {
      nome:        body.nome || body.name || body.first_name || "",
      cognome:     body.cognome || body.last_name || body.surname || "",
      telefono:    body.telefono || body.phone || body.phone_number || "",
      email:       body.email || "",
      note:        body.note || body.message || body.messaggio || "",
      canale:      body.canale || body.source || "webhook",
      fonte:       body.fonte || body.utm_source || "api",
      stato:       "nuovo",
      data:        new Date().toISOString().split("T")[0],
    };

    const { data, error } = await sb
      .from("fp_clienti")
      .insert([lead])
      .select()
      .single();

    if (error) throw error;

    res.status(201).json({ success: true, id: data.id });
  } catch (err) {
    console.error("POST /api/lead error:", err.message);
    res.status(500).json({ success: false, error: err.message });
  }
});

// ── GET /api/meta-lead — verifica token Meta ─────────────────
app.get("/api/meta-lead", (req, res) => {
  const mode      = req.query["hub.mode"];
  const token     = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === process.env.META_VERIFY_TOKEN) {
    console.log("Meta webhook verified");
    res.status(200).send(challenge);
  } else {
    res.sendStatus(403);
  }
});

// ── POST /api/meta-lead — riceve lead da Facebook Lead Form Ads
app.post("/api/meta-lead", async (req, res) => {
  try {
    const body = req.body;

    // Meta invia un array di entry con array di changes
    const entries = body.entry || [];

    for (const entry of entries) {
      for (const change of entry.changes || []) {
        const value = change.value || {};
        const fields = value.field_data || [];

        const get = (name) =>
          (fields.find((f) => f.name === name)?.values?.[0] || "");

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

    res.sendStatus(200);
  } catch (err) {
    console.error("POST /api/meta-lead error:", err.message);
    res.sendStatus(500);
  }
});

app.listen(PORT, () => {
  console.log(`finpratica webhook server running on port ${PORT}`);
});
