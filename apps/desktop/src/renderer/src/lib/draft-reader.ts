/** Reads the typed cells, collecting a message per cell that isn't what it should be. */
export function reader() {
  const errors: Record<string, string> = {};
  return {
    errors,
    number(key: string, text: string): number {
      const value = Number(text.trim());
      if (text.trim() === '' || !Number.isFinite(value)) errors[key] = 'Enter a number';
      return value;
    },
    clock(key: string, text: string): number {
      const match = /^(\d+):([0-5]\d)$/.exec(text.trim());
      if (!match) errors[key] = 'Enter a time like 1:30';
      return match ? Number(match[1]) * 60 + Number(match[2]) : 0;
    },
    text(key: string, text: string): string {
      if (text.trim() === '') errors[key] = 'Enter a name';
      return text.trim();
    },
  };
}

export type Reader = ReturnType<typeof reader>;
