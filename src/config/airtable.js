const Airtable = require('airtable');

Airtable.configure({
    endpointUrl: 'https://api.airtable.com',
    apiKey: process.env.AIRTABLE_PAT
});

const base = Airtable.base(process.env.BASE_ID);

module.exports = base;
