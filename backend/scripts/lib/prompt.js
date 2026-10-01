import { emitKeypressEvents } from "node:readline";
import { createInterface } from "node:readline/promises";

export class PromptAbortedError extends Error {
  constructor() {
    super("Cancelled");
    this.name = "PromptAbortedError";
  }
}

export const write = (text) => process.stdout.write(text);

export const ask = async (question, { input = process.stdin, output = process.stdout } = {}) => {
  const rl = createInterface({ input, output });
  const controller = new AbortController();
  rl.on("SIGINT", () => controller.abort());
  try {
    return await rl.question(question, { signal: controller.signal });
  } catch (error) {
    if (controller.signal.aborted) throw new PromptAbortedError();
    throw error;
  } finally {
    rl.close();
  }
};

const isTypedCharacter = (sequence, key) =>
  typeof sequence === "string" &&
  sequence >= " " &&
  !sequence.startsWith("\x1b") &&
  !key?.ctrl &&
  !key?.meta;

// Raw mode turns echo off, so the password never appears on screen; keypress events also split
// a pasted password into characters.
export const askHidden = (question, { input = process.stdin, output = process.stdout } = {}) =>
  new Promise((resolve, reject) => {
    let value = "";
    const finish = (error) => {
      input.off("keypress", onKeypress);
      input.setRawMode(false);
      input.pause();
      output.write("\n");
      if (error) reject(error);
      else resolve(value);
    };
    const onKeypress = (sequence, key) => {
      if (key?.ctrl && key.name === "c") finish(new PromptAbortedError());
      else if (key?.name === "return" || key?.name === "enter") finish();
      else if (key?.name === "backspace") value = value.slice(0, -1);
      else if (isTypedCharacter(sequence, key)) value += sequence;
    };

    output.write(question);
    emitKeypressEvents(input);
    input.setRawMode(true);
    input.on("keypress", onKeypress);
    input.resume();
  });

export const askValid = async (question, schema) => {
  while (true) {
    const result = schema.safeParse(await ask(question));
    if (result.success) return result.data;
    write(`  ${result.error.issues[0].message}\n`);
  }
};

export const askNewPassword = async (schema) => {
  while (true) {
    const password = await askHidden("Password (hidden): ");
    const result = schema.safeParse(password);
    if (!result.success) {
      write(`  ${result.error.issues[0].message}\n`);
    } else if ((await askHidden("Repeat the password: ")) === password) {
      return password;
    } else {
      write("  The passwords don't match. Try again.\n");
    }
  }
};
