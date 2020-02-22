// import and set global polyfills
global.fetch = require("node-fetch");
const WebCrypto = require("node-webcrypto-ossl");
global.window = {}
global.window.crypto = new WebCrypto()
global.window.btoa = require('btoa');


const assert = require('assert').strict
const { run, test } = require('./runTests.js')

const AcmeClient = require('./index.js')

run(() => {
  test('should create an AcmeClient object', async () => {
    const ac = await AcmeClient('letsencrypt-staging')

    assert.equal(typeof ac, 'object')
    assert.equal(typeof ac.exportJwk(), 'object')
  })

  test('should request a DNS challenge', async () => {
    const ac = await AcmeClient('letsencrypt-staging')
    const { recordName, recordText, order } = await ac.requestDnsChallenge('website.com');

    assert.equal(recordName, '_acme-challenge')
    assert.equal(typeof order, 'object')
    assert.equal(order.status, 'pending')
    assert.deepEqual(order.identifiers, [ { type: 'dns', value: 'website.com' } ])
  })

  // The rest of the process requires setting a dns record so cant really test
})
