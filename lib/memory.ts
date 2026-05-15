export const getMemoryKey = (email?: string | null) => {
  return `ai_user_memory_${email || 'guest'}`;
};

export type UserMemory = {
  firstName?: string;
  lastName?: string;
  designation?: string;
  englishLearner?: boolean;
  skills?: string[];
  interests?: string[];
  customInstruction?: string;
};

export function loadMemory(email?: string | null): UserMemory {
  if (typeof window === 'undefined') return {};

  try {
    const key = getMemoryKey(email);

    return JSON.parse(localStorage.getItem(key) || '{}');
  } catch {
    return {};
  }
}

export function saveMemory(
  email: string | null | undefined,
  memory: UserMemory
) {
  if (typeof window === 'undefined') return;

  const key = getMemoryKey(email);

  localStorage.setItem(key, JSON.stringify(memory));
}