type AnsiParserState = 'text' | 'esc' | 'csi' | 'osc' | 'oscEsc' | 'st' | 'stEsc' | 'ss3';

export const isAnsiSafeBoundary = (text: string, index: number): boolean => {
  if (index <= 0 || index >= text.length) {
    return true;
  }

  let state: AnsiParserState = 'text';

  for (let position = 0; position < index; position += 1) {
    const char = text[position];

    switch (state) {
      case 'text':
        if (char === '\u001b') {
          state = 'esc';
        }
        break;
      case 'esc':
        if (char === '[') {
          state = 'csi';
        } else if (char === ']') {
          state = 'osc';
        } else if (char === 'P' || char === 'X' || char === '^' || char === '_') {
          state = 'st';
        } else if (char === 'O') {
          state = 'ss3';
        } else {
          state = 'text';
        }
        break;
      case 'csi':
        if (char >= '@' && char <= '~') {
          state = 'text';
        }
        break;
      case 'osc':
        if (char === '\u0007') {
          state = 'text';
        } else if (char === '\u001b') {
          state = 'oscEsc';
        }
        break;
      case 'oscEsc':
        state = char === '\\' ? 'text' : 'osc';
        break;
      case 'st':
        if (char === '\u001b') {
          state = 'stEsc';
        }
        break;
      case 'stEsc':
        state = char === '\\' ? 'text' : 'st';
        break;
      case 'ss3':
        state = 'text';
        break;
    }
  }

  return state === 'text';
};
