# acme-easy
An ACME client for the browser that authenticates via DNS-01 challenge and supports LetsEncrypt by default.

## Use like so:
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

/* Close the app and set the DNS record to complete the challenge */

/* Then reopen the app */

// Get objects from storage
const { jwk, order } = getStore();
// Log back in to your account by passing its JWK to the constructor
const ac = await AcmeClient('letsencrypt', jwk);
// Submit, finalize, and return the signed certificate and its private key
const { pemCertChain, pkcs8Key } = await ac.submitDnsChallengeAndFinalize(order);
console.log(pemCertChain)
```

## Or, if you dont need persistence:
```javascript
import AcmeClient from 'acme-easy'

const domainName = 'example.com';

const ac = await AcmeClient('letsencrypt'); // You can also use 'letsencrypt-staging' for testing
const { recordName, recordText, order } = await ac.requestDnsChallenge(domainName);
console.log(`set a DNS record with host: ${recordName} and TXT: ${recordText}`);

/* Then set the DNS record to complete the challenge */

const { pemCertChain, pkcs8Key } = await ac.submitDnsChallengeAndFinalize(order);
console.log(pemCertChain)
```
