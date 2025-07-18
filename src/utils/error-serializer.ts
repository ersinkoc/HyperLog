export class ErrorSerializer {
  serialize(err: Error | any): any {
    if (!err) {
      return err;
    }
    
    if (typeof err !== 'object') {
      return err;
    }

    const serialized: any = {
      message: err.message || 'Unknown error',
      name: err.name || 'Error',
      stack: err.stack
    };

    if ('code' in err) {
      serialized.code = err.code;
    }

    if ('errno' in err) {
      serialized.errno = err.errno;
    }

    if ('syscall' in err) {
      serialized.syscall = err.syscall;
    }

    if ('path' in err) {
      serialized.path = err.path;
    }

    if ('address' in err) {
      serialized.address = err.address;
    }

    if ('port' in err) {
      serialized.port = err.port;
    }

    for (const key of Object.keys(err)) {
      if (!(key in serialized) && key !== 'constructor' && key !== '__proto__') {
        const value = err[key];
        if (value !== undefined) {
          serialized[key] = value;
        }
      }
    }

    if (err.cause) {
      serialized.cause = this.serialize(err.cause);
    }

    return serialized;
  }

  enhanceStack(stack: string): string {
    if (!stack) return stack;

    const lines = stack.split('\n');
    const enhanced = lines.map(line => {
      if (line.includes('node_modules')) {
        return `\x1b[90m${line}\x1b[0m`;
      }
      if (line.includes('at ')) {
        return `\x1b[33m${line}\x1b[0m`;
      }
      return line;
    });

    return enhanced.join('\n');
  }
}