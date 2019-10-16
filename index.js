import forge from 'node-forge'

const authorities = {
  "letsencrypt": "https://acme-v02.api.letsencrypt.org",
  "letsencrypt-staging": "https://acme-staging-v02.api.letsencrypt.org"
}

export default async function AcmeClient(authority, jwk=null) {
  let directory;
  let nonce;
  let accountUrl;

  if (Object.keys(authorities).includes(authority.toLowerCase()))
    authority = authorities[authority.toLowerCase()]
  directory = await (await fetch(authority + '/directory')).json();
  nonce = await getNewNonce(directory);
  if (jwk === null) {
    jwk = await generateJwk();
    ({ nonce, accountUrl } = await postNewAccount(nonce, jwk, directory)); // Create new account
  } else {
    ({ nonce, accountUrl } = await postNewAccount(nonce, jwk, directory, { onlyReturnExisting: true })); // Login to existing account
  }
  // Public functions:
  return {
    async requestDnsChallenge(domainName) {
      let order;
      let authorization;
      ({ nonce, order } = await postNewOrder(nonce, jwk, directory, accountUrl, domainName));
      ({ nonce, authorization } = await getOrderAuthorization(nonce, jwk, accountUrl, order));
      const challenge = authorization.challenges.filter(c => c.type === "dns-01")[0];
      return {
        recordName: '_acme-challenge',
        recordText: await calculateRecordText(challenge.token, jwk),
        order
      };
    },
    async submitDnsChallengeAndFinalize(order) {
      let authorization;
      ({ nonce, authorization } = await getOrderAuthorization(nonce, jwk, accountUrl, order));
      const challenge = authorization.challenges.filter(c => c.type === "dns-01")[0]
      nonce = await postOrderChallenge(nonce, jwk, directory, accountUrl, challenge, order);
      const domainName = authorization.identifier.value;
      const { csr, pkcs8Key } = generateCsr(domainName);
      let certUrl;
      ({ nonce, certUrl } = await postOrderFinalize(nonce, jwk, accountUrl, order, csr));
      return { certUrl, pkcs8Key };
    },
    exportJwk() {
      return jwk;
    }
  }
}

async function getNewNonce(directory) {
  const res = await fetch(directory.newNonce, {
    method: "HEAD"
  })
  return res.headers.get('Replay-Nonce')
}


async function getOrderAuthorization(nonce, jwk, accountUrl, order) {
  const header = {
    alg: "ES256",
    kid: accountUrl,
    nonce: nonce,
    url: order.authorizations[0]
  }
  const payload = ""

  const jwt = await jwtFromJson(jwk, header, payload)

  const res = await fetch(order.authorizations[0], {
    method: "POST", // A POST-AS-GET request
    headers: { "Content-Type": "application/jose+json" },
    body: JSON.stringify(parseJwt(jwt))
  })
  const authorization = await res.json()

  throwIfErrored(authorization)

  return {
    nonce: res.headers.get('Replay-Nonce'),
    authorization
  }
}


async function postNewAccount(nonce, jwk, directory, options={ onlyReturnExisting: false }) {
  const pubJwk = {
    "crv": jwk.crv,
    "kty": jwk.kty,
    "x": jwk.x,
    "y": jwk.y,
  }
  const header = {
    nonce: nonce,
    url: directory.newAccount,
    alg: 'ES256',
    jwk: pubJwk
  }
  const payload = {
    termsOfServiceAgreed: true,
    onlyReturnExisting: options.onlyReturnExisting
  }
  const jwt = await jwtFromJson(jwk, header, payload)

  const res = await fetch(directory.newAccount, {
    mode: "cors",
    method: "POST",
    headers: { "Content-Type": "application/jose+json" },
    body: JSON.stringify(parseJwt(jwt))
  })

  throwIfErrored(await res.json())

  return {
    nonce: res.headers.get('Replay-Nonce'),
    accountUrl: res.headers.get('Location')
  }
}




async function postNewOrder(nonce, jwk, directory, accountUrl, domainName) {
  const header = {
    alg: "ES256",
    kid: accountUrl,
    nonce: nonce,
    url: directory.newOrder
  }
  const payload = {
    identifiers: [{ "type": "dns", "value": domainName }]
  }
  const jwt = await jwtFromJson(jwk, header, payload)

  let res = await fetch(directory.newOrder, {
    method: "POST",
    headers: { "Content-Type": "application/jose+json" },
    body: JSON.stringify(parseJwt(jwt))
  })
  const order = await res.json()

  throwIfErrored(order)

  return {
    nonce: res.headers.get('Replay-Nonce'),
    order
  }
}


async function postOrderChallenge(nonce, jwk, directory, accountUrl, challenge, order) {
  const header = {
    alg: 'ES256',
    kid: accountUrl,
    nonce: nonce,
    url: challenge.url
  }
  const payload = {}

  const jwt = await jwtFromJson(jwk, header, payload)

  let res = await fetch(challenge.url, {
    method: "POST",
    headers: { "Content-Type": "application/jose+json" },
    body: JSON.stringify(parseJwt(jwt))
  })

  throwIfErrored(await res.json())

  return res.headers.get('Replay-Nonce')
}


async function postOrderFinalize(nonce, jwk, accountUrl, order, csr) {
  const header = {
    alg: "ES256",
    kid: accountUrl,
    nonce: nonce,
    url: order.finalize
  }
  const payload = { csr }
  const jwt = await jwtFromJson(jwk, header, payload)

  const res = await fetch(order.finalize, {
    method: "POST",
    headers: { "Content-Type": "application/jose+json" },
    body: JSON.stringify(parseJwt(jwt))
  })
  const body = await res.json()

  throwIfErrored(body)

  return {
    nonce: res.headers.get('Replay-Nonce'),
    certUrl: body.certificate
  }
}




async function generateJwk() {
  const keyPair = await window.crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    [ 'sign', 'verify' ]
  )
  return await window.crypto.subtle.exportKey('jwk', keyPair.privateKey)
}

async function calculateRecordText(token, jwk) {
  const keyAuthorization = token + '.' + (await thumbprint(jwk))
  const hash = await window.crypto.subtle.digest(
    { name: "SHA-256", },
    (new TextEncoder()).encode(keyAuthorization)
  )
  return arrayBufferToBase64Url(hash)
}

async function thumbprint(jwk) {
  const pubJwk = {
    crv: jwk.crv,
    kty: jwk.kty,
    x: jwk.x,
    y: jwk.y
  }
  const hash = await window.crypto.subtle.digest(
    { name: "SHA-256" },
    (new TextEncoder()).encode(JSON.stringify(pubJwk))
  )

  return arrayBufferToBase64Url(hash);
}

function generateCsr(domainName) {
  let keys = forge.pki.rsa.generateKeyPair(2048);

  let csr = forge.pki.createCertificationRequest();
  csr.publicKey = keys.publicKey;
  csr.setSubject([{
    name: 'commonName',
    value: domainName
  }]);
  csr.setAttributes([{
    name: 'extensionRequest',
    extensions: [{
      name: 'subjectAltName',
      altNames: [{
        // 2 is DNS type
        type: 2,
        value: domainName
      }]
    }]
  }])
  csr.sign(keys.privateKey, forge.md.sha256.create())
  const derBase64Url = forge.pki.certificationRequestToPem(csr).split(/\r\n|\r|\n/)
    .slice(1, -2)
    .join('')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
  // const der = forge.asn1.toDer(forge.pki.certificationRequestToAsn1(csr))
  // const base64UrlDer2 = arrayBufferToBase64Url(Buffer.from(der.toHex(), 'hex').buffer)

  return {
    csr: derBase64Url,
    pkcs8Key: forge.pki.privateKeyInfoToPem(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(keys.privateKey)))
  }
}

async function jwtFromJson(jwk, header, payload) {
  const privateKey = await window.crypto.subtle.importKey(
    'jwk', jwk, { name: "ECDSA", namedCurve: "P-256"}, false, ['sign']
  )
  const base64Header = jsonToBase64Url(header)
  const base64Payload = payload === '' ? "" : jsonToBase64Url(payload)
  const base64Signature = arrayBufferToBase64Url(await window.crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    privateKey,
    (new TextEncoder()).encode(base64Header + '.' + base64Payload)
  ))

  return base64Header + '.' + base64Payload + '.' + base64Signature
}

function parseJwt(jwt) {
  const jwtParts = jwt.split('.')
  return {
    protected: jwtParts[0],
    payload: jwtParts[1],
    signature: jwtParts[2]
  }
}

function jsonToBase64Url(json) {
  return window.btoa(JSON.stringify(json))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function arrayBufferToBase64Url(buf) {
  return window.btoa(Array.prototype.map.call(
    new Uint8Array(buf),
    (ch) => String.fromCharCode(ch)
  ).join(''))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '')
}

function throwIfErrored(resJson) {
  if (typeof resJson.status === 'number' && resJson.status >= 400)
    throw new Error(resJson.detail)
}
