function composeAsync(...fns) {
  return async function compAsyncExec(arg) {
    return fns.reduce((res, currFn) => res.then(currFn), Promise.resolve(arg))
  }
}

function isUndefined (val) {
  return val === undefined
}

module.exports = {
  composeAsync,
  isUndefined
}
