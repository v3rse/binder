export function composeAsync(...fns: any) {
  return async function compAsyncExec(arg: any) {
    return fns.reduce((res: any, currFn: any) => res.then(currFn), Promise.resolve(arg))
  }
}

export function isUndefined (val: any) {
  return val === undefined
}
