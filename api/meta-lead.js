exports.handler = async function(event) {const mode = event.queryStringParameters?.["hub.mode"];
  const token = event.queryStringParameters?.["hub.verify_token"];
  const challenge = event.queryStringParameters?.["hub.challenge"];if (event.httpMethod === "GET" && mode === "subscribe" && token === "finpratica2026") {
    return { statusCode: 200, body: challenge };
  }if (event.httpMethod === "POST") {
    const { createClient } = require("@supabase/supabase-js");
    const sb = createClient(
      "https://taxhjdmnchjbdinzqstd.supabase.co","sb_publishable_zy8OMf0OPQabS8Kp_6jPkA_ewyxtYZo"
    );
    const body = JSON.parse(event.body || "{}");const leads = body?.entry?.[0]?.changes?.[0]?.value?.leads || [];
    for (const lead of leads) {const fields = {};
      lead.field_data?.forEach(f => { fields[f.name] = f.values?.[0]; });await sb.from("fp_clienti").insert({
        id: lead.id || Date.now().toString(),
        data: { nome: fields.full_name, telefono: fields.phone_number, email: fields.email, fonte: "facebook_lead_ads", stato: "lead" } });
    }
    return { statusCode: 200, body: "OK" };}

  return { statusCode: 403, body: "Forbidden" };};
