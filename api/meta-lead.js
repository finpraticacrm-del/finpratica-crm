exports.handler = async function(event, context) {
  if (event.httpMethod === "GET") {
    const mode = event.queryStringParameters["hub.mode"];const token = event.queryStringParameters["hub.verify_token"];
    const challenge = event.queryStringParameters["hub.challenge"];
    if (mode === "subscribe" && token === "finpratica2026") {  return { statusCode: 200, body: challenge };
    }
    return { statusCode: 403, body: "Forbidden" }; }
  if (event.httpMethod === "POST") {
    try {const body = JSON.parse(event.body);
      const SUPABASE_URL = "https://taxhjdmnchjbdinzqstd.supabase.co";
      const SUPABASE_KEY = "sb_publishable_zy8OMf0OPQabS8Kp_6jPkA_ewyxtYZo";const { createClient } = require("@supabase/supabase-js");
      const sb = createClient(SUPABASE_URL, SUPABASE_KEY);
      const leads = body.entry?.[0]?.changes?.[0]?.value?.leads || [];for (const lead of leads) {
        const fields = {};
        lead.field_data?.forEach(f => { fields[f.name] = f.values?.[0]; });await sb.from("fp_clienti").insert({
          id: lead.id || Date.now().toString(),
          data: { nome: fields.full_name || fields.nome, telefono: fields.phone_number || fields.telefono, email: fields.email, fonte: "facebook_lead_ads", stato: "lead", data_creazione: new Date().toISOString() } });
      }
      return { statusCode: 200, body: "OK" };} catch(e) {
      return { statusCode: 500, body: e.message }; }
  }return { statusCode: 405, body: "Method not allowed" };
};
