import { PassThrough } from "node:stream";
import { describe, expect, it, vi } from "vitest";
import { PromptAbortedError, askHidden } from "../../scripts/lib/prompt.js";

// A stand-in for a TTY stdin: keypress parsing works on any readable stream.
const fakeTerminal = () => {
  const input = new PassThrough();
  input.isTTY = true;
  input.setRawMode = vi.fn();
  const output = new PassThrough();
  let written = "";
  output.on("data", (chunk) => {
    written += chunk;
  });
  return { input, output, written: () => written };
};

describe("askHidden", () => {
  it("reads a password without echoing it and restores the terminal", async () => {
    const terminal = fakeTerminal();
    const answer = askHidden("Password: ", terminal);
    terminal.input.write("s3cret pass\r");

    expect(await answer).toBe("s3cret pass");
    expect(terminal.written()).toBe("Password: \n");
    expect(terminal.input.setRawMode.mock.calls).toEqual([[true], [false]]);
  });

  it("handles backspace and ignores arrow keys", async () => {
    const terminal = fakeTerminal();
    const answer = askHidden("Password: ", terminal);
    terminal.input.write("abx\x7fc\x1b[Dd\b\b\x08e\r");
    expect(await answer).toBe("ae");
  });

  it("rejects with PromptAbortedError on Ctrl+C", async () => {
    const terminal = fakeTerminal();
    const answer = askHidden("Password: ", terminal);
    terminal.input.write("abc\x03");
    await expect(answer).rejects.toBeInstanceOf(PromptAbortedError);
    expect(terminal.input.setRawMode).toHaveBeenLastCalledWith(false);
  });
});
