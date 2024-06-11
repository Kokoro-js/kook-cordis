export function parseArgsStringToArgv(value: string) {
  const args = [];
  let inQuotes = false;
  let escape = false;
  let arg = '';

  for (const current of value) {
    if (escape) {
      arg += current;
      escape = false;
    } else if (current === '\\') {
      escape = true;
    } else if (current === '"') {
      inQuotes = !inQuotes;
    } else if (current === ' ' && !inQuotes) {
      if (arg) {
        args.push(arg);
        arg = '';
      }
    } else {
      arg += current;
    }
  }

  if (arg) args.push(arg);

  return args;
}
