import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

type Json = Record<string, unknown>;

const response = (body: Json, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json'
    }
  });

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return response({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return response({ error: 'Missing Authorization header' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const webhookUrl = Deno.env.get('DISCORD_WEBHOOK_URL');

  if (!supabaseUrl || !serviceRoleKey || !webhookUrl) {
    return response({ error: 'Server environment is not configured' }, 500);
  }

  const admin = createClient(supabaseUrl, serviceRoleKey);

  const token = authHeader.replace('Bearer ', '');
  const userResult = await admin.auth.getUser(token);
  if (userResult.error || !userResult.data.user) {
    return response({ error: 'Invalid token' }, 401);
  }

  const user = userResult.data.user;

  const profileResult = await admin
    .from('profiles')
    .select('aprovado, is_admin')
    .eq('id', user.id)
    .maybeSingle();

  if (profileResult.error || !profileResult.data || profileResult.data.aprovado !== true) {
    return response({ error: 'User is not approved' }, 403);
  }

  let body: Json;
  try {
    body = (await req.json()) as Json;
  } catch {
    return response({ error: 'Invalid JSON body' }, 400);
  }

  const bouIdsRaw = body.bou_ids;
  if (!Array.isArray(bouIdsRaw) || bouIdsRaw.length === 0) {
    return response({ error: 'bou_ids must be a non-empty array' }, 400);
  }

  const bouIds = bouIdsRaw
    .map((id) => Number(id))
    .filter((id) => Number.isFinite(id) && id > 0);

  if (!bouIds.length) {
    return response({ error: 'bou_ids has no valid numeric IDs' }, 400);
  }

  const bousResult = await admin
    .from('bous')
    .select('id, user_id, titulo, conteudo_completo, data_criacao')
    .in('id', bouIds);

  if (bousResult.error) {
    return response({ error: bousResult.error.message }, 400);
  }

  const bous = bousResult.data || [];
  if (!bous.length) {
    return response({ error: 'No BOU records found for informed IDs' }, 404);
  }

  // Usuario comum so pode enviar os proprios BOUs; admin aprovado pode enviar qualquer.
  const isAdmin = profileResult.data.is_admin === true;
  const unauthorized = bous.find((bou) => !isAdmin && bou.user_id !== user.id);
  if (unauthorized) {
    return response({ error: 'You can only send your own BOU records' }, 403);
  }

  let sentCount = 0;

  for (const bou of bous) {
    let payload: Json = {};
    if (typeof bou.conteudo_completo === 'string') {
      try {
        payload = JSON.parse(bou.conteudo_completo) as Json;
      } catch {
        payload = { texto_original: bou.conteudo_completo };
      }
    } else if (bou.conteudo_completo && typeof bou.conteudo_completo === 'object') {
      payload = bou.conteudo_completo as Json;
    }

    const campos = (payload.campos && typeof payload.campos === 'object' ? payload.campos : {}) as Record<string, string>;
    const textoOriginal = typeof payload.texto_original === 'string' ? payload.texto_original : '-';

    const content =
      `**BOU enviado**\n` +
      `**ID:** ${bou.id}\n` +
      `**Titulo:** ${campos.titulo || bou.titulo || '-'}\n` +
      `**Unidade:** ${campos.unidade || '-'}\n` +
      `**Equipe:** ${campos.equipe || '-'}\n` +
      `**Acusado:** ${campos.nome_acusado || '-'}\n` +
      `**Natureza:** ${campos.natureza || '-'}\n` +
      `**Data/Hora:** ${campos.datahora || '-'}\n` +
      `**Local:** ${campos.local || '-'}\n\n` +
      `**Texto Original:**\n${textoOriginal}`;

    const discordResult = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });

    if (!discordResult.ok) {
      const errText = await discordResult.text();
      return response({ error: `Discord webhook failed: ${discordResult.status} ${errText}` }, 502);
    }

    sentCount += 1;
  }

  return response({ success: true, sent_count: sentCount });
});
