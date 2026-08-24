const CLI = new URL("../cli.ts", import.meta.url).pathname;
const decoder = new TextDecoder();

export async function runCli(
  args: string[],
  options: { cwd?: string; stdin?: string } = {},
) {
  const command = new Deno.Command(Deno.execPath(), {
    args: ["run", "--quiet", "--allow-read", "--allow-write", CLI, ...args],
    cwd: options.cwd,
    stdin: options.stdin === undefined ? "null" : "piped",
    stdout: "piped",
    stderr: "piped",
  });
  const child = command.spawn();
  if (options.stdin !== undefined) {
    const writer = child.stdin.getWriter();
    await writer.write(new TextEncoder().encode(options.stdin));
    await writer.close();
  }
  const output = await child.output();
  return {
    code: output.code,
    stdout: decoder.decode(output.stdout),
    stderr: decoder.decode(output.stderr),
  };
}
