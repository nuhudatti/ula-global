/** Strong password rules for platform operators and privileged accounts. */
export function validateStrongPassword(password, { label = 'Password' } = {}) {
  const value = String(password || '');
  const errors = [];

  if (value.length < 12) {
    errors.push(`${label} must be at least 12 characters`);
  }
  if (!/[a-z]/.test(value)) {
    errors.push(`${label} must include a lowercase letter`);
  }
  if (!/[A-Z]/.test(value)) {
    errors.push(`${label} must include an uppercase letter`);
  }
  if (!/[0-9]/.test(value)) {
    errors.push(`${label} must include a number`);
  }
  if (!/[^A-Za-z0-9]/.test(value)) {
    errors.push(`${label} must include a special character`);
  }

  return { valid: errors.length === 0, errors };
}

export function strongPasswordHelpText() {
  return 'At least 12 characters with uppercase, lowercase, a number, and a special character.';
}
