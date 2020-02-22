const tests = []

function test(name, fn) {
  tests.push({ name, fn })
}

async function run(defineTests) {
  defineTests()

  for (let i=0; i<tests.length; i++) {
    try {
      // Wait for resolve if its a promise
			await (async () => tests[i].fn())()
			console.log('✅', tests[i].name)
		} catch (e) {
			console.log('❌', tests[i].name)
			// log the stack of the error
			console.log(e.stack)
		}
  }
  console.log()
  console.log('done.')
}

exports.run = run
exports.test = test
