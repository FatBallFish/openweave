const CSI_FINAL_BYTE_PATTERN = /[\u0040-\u007e]/;
const ALTERNATE_SCREEN_SEQUENCE_PATTERN = /^\u001b\[\?(?:47|1047|1049)[hl]$/;
const ERASE_SCROLLBACK_SEQUENCE = '\u001b[3J';

export class TerminalOutputSanitizer {
  private pending = '';

  public sanitize(chunk: string): string {
    if (chunk.length === 0) {
      return '';
    }

    const input = `${this.pending}${chunk}`;
    this.pending = '';
    let output = '';
    let index = 0;

    while (index < input.length) {
      const escapeIndex = input.indexOf('\u001b', index);
      if (escapeIndex === -1) {
        output += input.slice(index);
        break;
      }

      output += input.slice(index, escapeIndex);

      if (escapeIndex + 1 >= input.length) {
        this.pending = input.slice(escapeIndex);
        break;
      }

      if (input[escapeIndex + 1] !== '[') {
        output += input.slice(escapeIndex, escapeIndex + 2);
        index = escapeIndex + 2;
        continue;
      }

      let sequenceEnd = escapeIndex + 2;
      while (sequenceEnd < input.length && !CSI_FINAL_BYTE_PATTERN.test(input[sequenceEnd] ?? '')) {
        sequenceEnd += 1;
      }

      if (sequenceEnd >= input.length) {
        this.pending = input.slice(escapeIndex);
        break;
      }

      const sequence = input.slice(escapeIndex, sequenceEnd + 1);
      if (!shouldDropCsiSequence(sequence)) {
        output += sequence;
      }
      index = sequenceEnd + 1;
    }

    return output;
  }

  public reset(): void {
    this.pending = '';
  }
}

const shouldDropCsiSequence = (sequence: string): boolean => {
  return sequence === ERASE_SCROLLBACK_SEQUENCE || ALTERNATE_SCREEN_SEQUENCE_PATTERN.test(sequence);
};

export const sanitizeTerminalOutputForScrollback = (chunk: string): string => {
  return new TerminalOutputSanitizer().sanitize(chunk);
};
