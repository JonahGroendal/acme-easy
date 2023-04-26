const tests = []

function test (name, fn) {
  tests.push({ name, fn })
}

async function run (defineTests) {
  defineTests()

  let aTestFailed = false

  for (let i = 0; i < tests.length; i++) {
    try {
      // Wait for resolve if its a promise
      await (async () => tests[i].fn())()
      console.log('✅', tests[i].name)
    } catch (e) {
      aTestFailed = true
      console.log('❌', tests[i].name)
      // log the stack of the error
      console.log(e.stack)
    }
  }
  console.log()
  console.log('done.')

  if (aTestFailed) { process.exit(1) }
}

export { test, run }
