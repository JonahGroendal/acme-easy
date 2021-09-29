![tests](https://github.com/JonahGroendal/acme-easy/actions/workflows/node.js.yml/badge.svg)
# acme-easy
An ACME client for the browser that authenticates via DNS-01 challenge and supports LetsEncrypt by default.

## Use like so:
```javascript
import AcmeClient from 'acme-easy'

const domainName = 'example.com';

const ac = await AcmeClient('letsencrypt'); // You can also use 'letsencrypt-staging' for testing
const { recordName, recordText, order } = await ac.requestDnsChallenge(domainName);
console.log(`set a DNS record with host: ${recordName} and TXT: ${recordText}`);

/* Then set the DNS record and wait ~10 minutes */

const { pemCertChain, pkcs8Key } = await ac.submitDnsChallengeAndFinalize(order);
console.log(pemCertChain)
```

## Or, if you need persistence:
```javascript
import AcmeClient from 'acme-easy'

const domainName = 'example.com';

// Generate a JWK and create a new account at LetsEncrypt
const ac = await AcmeClient('letsencrypt'); // You can also use 'letsencrypt-staging' for testing
// Generate and submt an new CSR then return the challenge text
const { recordName, recordText, order } = await ac.requestDnsChallenge(domainName);
// Save `jwk` and `order` objects (`setStore` is not a real function)
setStore({ jwk: ac.exportJwk(), order });
console.log(`set a DNS record with host: ${recordName} and TXT: ${recordText}`);

/* Close the app, set the DNS record and wait ~10 minutes */

/* Then reopen the app */

// Get objects from storage
const { jwk, order } = getStore();
// Log back in to your account by passing its JWK to the constructor
const ac = await AcmeClient('letsencrypt', jwk);
// Submit, finalize, and return the signed certificate and its private key
const { pemCertChain, pkcs8Key } = await ac.submitDnsChallengeAndFinalize(order);
console.log(pemCertChain)
```

tests requrire >=Nodev16