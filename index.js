const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());
const path = require('path');
app.use(express.static(path.join(__dirname, 'public')));
app.post('/search', async (req, res) => {
  try {
    const { username, password, criteria } = req.body;

    // Login to SugarCRM
    const loginRes = await fetch('https://mnccapital.sugarondemand.com/rest/v11_1/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'password',
        client_id: 'sugar',
        client_secret: '',
        username,
        password,
        platform: 'base'
      })
    });

    const loginData = await loginRes.json();
    if (!loginData.access_token) throw new Error('SugarCRM login failed');

    // Fetch accounts
    let all = [];
    let offset = 0;
    while (true) {
      const r = await fetch(`https://mnccapital.sugarondemand.com/rest/v11_1/Accounts?max_num=100&offset=${offset}&fields=name,industry,annual_revenue,billing_address_country,billing_address_city,ownership,date_modified,employees,description,account_type`, {
        headers: { 'OAuth-Token': loginData.access_token }
      });
      const d = await r.json();
      if (!d.records || d.records.length === 0) break;
      all = all.concat(d.records);
      if (d.records.length < 100) break;
      offset += 100;
    }

    // Call Claude
    const claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': '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',
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4000,
        messages: [{
          role: 'user',
          content: `You are a senior M&A analyst at MNC Capital. Analyse these companies against the criteria and return a ranked shortlist.

CRITERIA: ${criteria}

COMPANIES: ${JSON.stringify(all.map(a => ({
  name: a.name,
  industry: a.industry,
  revenue: a.annual_revenue,
  location: `${a.billing_address_city || ''} ${a.billing_address_country || ''}`.trim(),
  ownership: a.ownership || a.account_type,
  lastModified: a.date_modified,
  employees: a.employees,
  description: a.description
})))}

Return ONLY valid JSON, no other text:
{"results":[{"rank":1,"name":"","score":85,"industry":"","revenue":"","location":"","ownership":"","lastContact":"","employees":"","matchReasons":"","redFlags":"","outreachMessage":""}],"summary":""}`
        }]
      })
    });

    const claudeData = await claudeRes.json();
    const text = claudeData.content[0].text;
    const clean = text.replace(/```json|```/g, '').trim();
    res.json(JSON.parse(clean));

  } catch (err) {
    res.status(500).json({ error: err.message });
    
  }
});

app.listen(process.env.PORT || 3000, () => console.log('MNC Intel proxy running'));
