import { spawn } from "child_process";

export interface ExecResult {
  stdout: string;
  stderr: string;
  code: number;
}

export interface ExecOptions {
  cwd?: string;
  env?: NodeJS.ProcessEnv;
  input?: string;
  timeout?: number;
  onStderr?: (chunk: string) => void;
}

export function exec(
  command: string,
  args: string[],
  opts: ExecOptions = {}
): Promise<ExecResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: opts.cwd,
      env: opts.env ? { ...process.env, ...opts.env } : process.env,
    });

    let stdout = "";
    let stderr = "";
    let timer: NodeJS.Timeout | undefined;

    if (opts.timeout) {
      timer = setTimeout(() => {
        child.kill("SIGKILL");
        reject(new Error(`Timeout after ${opts.timeout}ms: ${command}`));
      }, opts.timeout);
    }

    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });

    child.stderr.on("data", (d: Buffer) => {
      const chunk = d.toString();
      stderr += chunk;
      if (opts.onStderr) opts.onStderr(chunk);
    });

    child.on("error", (err) => {
      if (timer) clearTimeout(timer);
      reject(err);
    });

    child.on("close", (code) => {
      if (timer) clearTimeout(timer);
      const result: ExecResult = { stdout, stderr, code: code ?? -1 };
      if (code !== 0) {
        const err = new Error(
          `${command} exited with code ${code}\nstderr: ${stderr.slice(-2000)}`
        );
        (err as Error & { result?: ExecResult }).result = result;
        reject(err);
        return;
      }
      resolve(result);
    });

    if (opts.input) {
      child.stdin.write(opts.input);
      child.stdin.end();
    }
  });
}
