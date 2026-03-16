const express = require('express');
const fetch = require('node-fetch');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.post('/search', async (req, res) => {
  try {
    const { username, password, criteria, testOnly } = req.body;

    const loginRes = await fetch('https://mnccapital.sugarondemand.com/rest/v11_1/oauth2/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        grant_type: 'password',
        client_id: 'sugar',
        client_secret: '',
        username: username,
        password: password,
        platform: 'base'
      })
    });

    const loginData = await loginRes.json();
    if (!loginData.access_token) throw new Error('SugarCRM login failed');
    if (testOnly) return res.json({ ok: true });

    let all = [];
    let offset = 0;
    let keepGoing = true;

    while (keepGoing && all.length < 150) {
      const r = await fetch('https://mnccapital.sugarondemand.com/rest/v11_1/Accounts?max_num=50&offset=' + offset + '&fields=name,industry,annual_revenue,billing_address_country,billing_address_city,ownership,date_modified,employees,account_type', {
        headers: { 'OAuth-Token': loginData.access_token }
      });
      const d = await r.json();
      if (!d.records || d.records.length === 0) break;
      all = all.concat(d.records);
      if (d.records.length < 50) keepGoing = false;
