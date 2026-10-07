require('dotenv').config();

const http = require('http');
const url = require('url');
const fs = require('fs');
const path = require('path');
const store = require('./db');

const getFbToken = () => (process.env.FB_ACCESS_TOKEN || '').trim();
const FB_API = 'https://graph.facebook.com/v20.0';
const PORT = process.env.PORT || 3001;
const VALID_PRESETS = {
  hoje: 'today',
  today: 'today',
  '7dias': 'last_7d',
  '7d': 'last_7d',
  '1mes': 'last_30d',
  '30d': 'last_30d',
  custom: null,
};

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.png': 'image/png',
  '.webp': 'image/webp',
};

async function fbFetch(endpoint) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 25000);
  try {
    const response = await fetch(`${FB_API}${endpoint}`, { signal: controller.signal });
    const json = await response.json();
    if (json.error) throw new Error(json.error.message);
    return json;
  } finally {
    clearTimeout(timer);
  }
}

function cleanName(raw) {
  return raw
    .replace(/^\[CA\]\s*/i, '')
    .replace(/^CA\s+\d+\s*[|\-]\s*/i, '')
    .replace(/^CONTA\s+\d+\s*[|\-]\s*/i, '')
    .replace(/^Conta\s+\d+\s*[|\-]\s*/i, '')
    .replace(/^\d+\s*[|\-]\s*/, '')
    .trim();
}

function getConversations(actions = []) {
  const conversation = actions.find((item) => item.action_type === 'onsite_conversion.messaging_conversation_started_7d')
    || actions.find((item) => item.action_type === 'onsite_conversion.messaging_conversation_started_1d');
  return conversation ? parseInt(conversation.value, 10) : 0;
}

function getActionValue(actions = [], actionType) {
  const action = actions.find((item) => item.action_type === actionType);
  return action ? parseInt(action.value, 10) : 0;
}

async function getAccounts() {
  const accounts = [];
  let next = '/me/adaccounts?fields=id,name&limit=100';
  while (next) {
    const json = await fbFetch(`${next}&access_token=${getFbToken()}`);
    accounts.push(...(json.data || []));
    next = json.paging?.next
      ? json.paging.next.replace(/^https:\/\/graph\.facebook\.com\/v\d+\.\d+/, '')
      : null;
  }
  return accounts;
}

function timeParam(period, start, end) {
  if (period === 'custom' && start && end) {
    return `time_range=${encodeURIComponent(JSON.stringify({ since: start, until: end }))}`;
  }
  return `date_preset=${VALID_PRESETS[period] || 'last_7d'}`;
}

async function getMetrics(period, start, end) {
  if (!getFbToken()) throw new Error('FB_ACCESS_TOKEN não configurado (defina a variável de ambiente ou o arquivo .env)');
  const accounts = await getAccounts();
  const range = timeParam(period, start, end);

  const results = await Promise.allSettled(accounts.map(async (account) => {
    const dailyRange = `${range}&time_increment=1`;
    const [totalResult, campaignsResult, dailyResult, dailyCampaignsResult] = await Promise.allSettled([
      fbFetch(`/${account.id}/insights?fields=spend,actions,impressions&${range}&level=account&access_token=${getFbToken()}`),
      fbFetch(`/${account.id}/insights?fields=instagram_profile_visits&${range}&level=campaign&limit=100&access_token=${getFbToken()}`),
      fbFetch(`/${account.id}/insights?fields=spend,actions,impressions,date_start&${dailyRange}&level=account&access_token=${getFbToken()}`),
      fbFetch(`/${account.id}/insights?fields=instagram_profile_visits,date_start&${dailyRange}&level=campaign&limit=100&access_token=${getFbToken()}`),
    ]);

    const total = totalResult.status === 'fulfilled' ? totalResult.value : null;
    const campaigns = campaignsResult.status === 'fulfilled' ? campaignsResult.value : { data: [] };
    const daily = dailyResult.status === 'fulfilled' ? dailyResult.value : { data: [] };
    const dailyCampaigns = dailyCampaignsResult.status === 'fulfilled' ? dailyCampaignsResult.value : { data: [] };

    const insight = total?.data?.[0] || {};
    const spend = parseFloat(insight?.spend || '0');
    if (!Number.isFinite(spend) || spend <= 0) return null;

    const conversations = getConversations(insight.actions || []);
    const newLeads = getActionValue(insight.actions || [], 'onsite_conversion.messaging_first_reply');
    const totalContacts = getActionValue(insight.actions || [], 'onsite_conversion.total_messaging_connection');
    const impressions = parseInt(insight.impressions || '0', 10);
    const profileVisits = (campaigns.data || []).reduce((sum, item) => sum + parseInt(item.instagram_profile_visits || '0', 10), 0);
    const visitByDate = (dailyCampaigns.data || []).reduce((map, item) => {
      map[item.date_start] = (map[item.date_start] || 0) + parseInt(item.instagram_profile_visits || '0', 10);
      return map;
    }, {});
    const dailyRows = (daily.data || []).map((item) => {
      const daySpend = parseFloat(item.spend || '0');
      const dayConversations = getConversations(item.actions);
      const dayVisits = visitByDate[item.date_start] || 0;
      return {
        date: item.date_start,
        spend: daySpend,
        conversations: dayConversations,
        new_leads: getActionValue(item.actions, 'onsite_conversion.messaging_first_reply'),
        total_contacts: getActionValue(item.actions, 'onsite_conversion.total_messaging_connection'),
        impressions: parseInt(item.impressions || '0', 10),
        cost_per_conversation: dayConversations ? Number((daySpend / dayConversations).toFixed(2)) : 0,
        profile_visits: dayVisits,
        cost_per_profile_visit: dayVisits ? Number((daySpend / dayVisits).toFixed(2)) : 0,
      };
    });

    const metricErrors = [];
    if (totalResult.status === 'rejected') metricErrors.push('account_insights');
    if (campaignsResult.status === 'rejected') metricErrors.push('profile_visits');
    if (dailyResult.status === 'rejected') metricErrors.push('daily_insights');
    if (dailyCampaignsResult.status === 'rejected') metricErrors.push('daily_profile_visits');

    return {
      id: account.id,
      account_name: account.name,
      client_name: cleanName(account.name),
      spend,
      conversations,
      new_leads: newLeads,
      total_contacts: totalContacts,
      impressions,
      cost_per_conversation: conversations ? Number((spend / conversations).toFixed(2)) : 0,
      profile_visits: profileVisits,
      cost_per_profile_visit: profileVisits ? Number((spend / profileVisits).toFixed(2)) : 0,
      daily: dailyRows,
      metric_errors: metricErrors,
    };
  }));

  return results
    .filter((result) => result.status === 'fulfilled' && result.value)
    .map((result) => result.value)
    .sort((a, b) => b.conversations - a.conversations);
}

function readJsonBody(request) {
  return new Promise((resolve, reject) => {
    let body = '';
    request.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1e6) {
        request.destroy();
        reject(new Error('Payload muito grande'));
      }
    });
    request.on('end', () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch (err) {
        reject(new Error('JSON inválido'));
      }
    });
    request.on('error', reject);
  });
}

function sendJson(response, statusCode, payload, extraHeaders = {}) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json; charset=utf-8');
  Object.entries(extraHeaders).forEach(([key, value]) => response.setHeader(key, value));
  response.end(JSON.stringify(payload));
}

function parseCookies(request) {
  const header = request.headers.cookie || '';
  return Object.fromEntries(
    header.split(';').map((part) => part.trim().split('=')).filter((pair) => pair[0])
  );
}

function clientIp(request) {
  return (request.headers['x-forwarded-for'] || '').split(',')[0].trim() || request.socket.remoteAddress;
}

const SESSION_COOKIE = 'empireads_session';

const server = http.createServer(async (request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (request.method === 'OPTIONS') return response.writeHead(204).end();

  const { pathname, query } = url.parse(request.url, true);

  // ---------- AUTENTICAÇÃO ----------
  if (pathname === '/api/login' && request.method === 'POST') {
    try {
      const { email, password } = await readJsonBody(request);
      const user = store.authenticate(email || '', password || '');
      if (!user) return sendJson(response, 401, { error: 'E-mail ou senha inválidos.' });
      const token = store.createSession(user.id);
      store.logLogin(user, clientIp(request), request.headers['user-agent']);
      return sendJson(response, 200, { user }, {
        'Set-Cookie': `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 3600}; SameSite=Lax`,
      });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (pathname === '/api/register' && request.method === 'POST') {
    try {
      const { name, email, password } = await readJsonBody(request);
      if (!name || !email || !password) return sendJson(response, 400, { error: 'Preencha nome, e-mail e senha.' });
      if (String(password).length < 6) return sendJson(response, 400, { error: 'A senha precisa ter pelo menos 6 caracteres.' });
      const user = store.createUser(name, email, password);
      if (!user) return sendJson(response, 409, { error: 'Este e-mail já está cadastrado.' });
      const token = store.createSession(user.id);
      store.logLogin(user, clientIp(request), request.headers['user-agent']);
      return sendJson(response, 201, { user }, {
        'Set-Cookie': `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; Max-Age=${7 * 24 * 3600}; SameSite=Lax`,
      });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  if (pathname === '/api/logout' && request.method === 'POST') {
    const token = parseCookies(request)[SESSION_COOKIE];
    store.destroySession(token);
    return sendJson(response, 200, { ok: true }, {
      'Set-Cookie': `${SESSION_COOKIE}=; HttpOnly; Path=/; Max-Age=0`,
    });
  }

  if (pathname === '/api/me' && request.method === 'GET') {
    const token = parseCookies(request)[SESSION_COOKIE];
    const user = store.getSessionUser(token);
    if (!user) return sendJson(response, 401, { error: 'Sessão expirada.' });
    return sendJson(response, 200, { user: { id: user.id, name: user.name, email: user.email } });
  }

  // ---------- COMENTÁRIOS ----------
  if (pathname === '/api/comments' && request.method === 'GET') {
    const client = String(query.client || '').trim();
    if (!client) return sendJson(response, 400, { error: 'Parâmetro client obrigatório.' });
    return sendJson(response, 200, { data: store.listComments(client) });
  }

  if (pathname === '/api/comments' && request.method === 'POST') {
    try {
      const { client, author, text } = await readJsonBody(request);
      if (!client || !String(text || '').trim()) return sendJson(response, 400, { error: 'Cliente e comentário são obrigatórios.' });
      const token = parseCookies(request)[SESSION_COOKIE];
      const sessionUser = store.getSessionUser(token);
      const data = store.addComment(
        String(client).trim(),
        String(author || sessionUser?.name || '').trim() || 'Anônimo',
        String(text).trim(),
        sessionUser?.id || null
      );
      return sendJson(response, 201, { data });
    } catch (error) {
      return sendJson(response, 400, { error: error.message });
    }
  }

  // ---------- MÉTRICAS ----------
  if (pathname === '/api/metrics') {
    response.setHeader('Content-Type', 'application/json');
    try {
      const data = await getMetrics(query.period || '7d', query.start, query.end);
      return response.end(JSON.stringify({ data, updated_at: new Date().toISOString() }));
    } catch (error) {
      response.statusCode = 500;
      return response.end(JSON.stringify({ error: error.message }));
    }
  }

  if (request.method === 'GET') {
    const requestedPath = pathname === '/' ? '/index.html' : pathname;
    const filePath = path.resolve(__dirname, `.${requestedPath}`);
    if (filePath.startsWith(__dirname) && fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const extension = path.extname(filePath).toLowerCase();
      response.statusCode = 200;
      response.setHeader('Content-Type', MIME_TYPES[extension] || 'application/octet-stream');
      response.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
      return fs.createReadStream(filePath).pipe(response);
    }
  }

  response.setHeader('Content-Type', 'application/json');
  response.statusCode = 404;
  response.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`EmpireAds API em http://localhost:${PORT}`);
  if (!getFbToken()) console.warn('FB_ACCESS_TOKEN ausente. Defina a variável de ambiente (ou o arquivo .env local).');
});
