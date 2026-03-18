const VALID_EMAIL_DOMAINS = [
  // Gmail
  'gmail.com',
  'googlemail.com',
  // Outlook / Hotmail / Live
  'outlook.com',
  'hotmail.com',
  'live.com',
  'msn.com',
  // iCloud
  'icloud.com',
  'me.com',
  'mac.com',
  // Yahoo
  'yahoo.com',
  'ymail.com',
  // Corporate / Other popular
  'protonmail.com',
  'proton.me',
  'gmx.com',
  'gmx.de',
  'gmx.net',
  'mail.com',
  'zoho.com',
  'yandex.com',
  'yandex.ru',
  'fastmail.com',
  'tutanota.com',
  'tuta.io',
  'hey.com',
  'pm.me',
];

export function isValidEmailDomain(email: string): { valid: boolean; domain?: string; message?: string } {
  const domain = email.toLowerCase().split('@')[1];
  
  if (!domain) {
    return { valid: false, message: 'Correo electrónico inválido' };
  }
  
  if (!VALID_EMAIL_DOMAINS.includes(domain)) {
    return { 
      valid: false, 
      domain,
      message: `El dominio "${domain}" no está permitido. Usa Gmail, Outlook, iCloud o Yahoo.` 
    };
  }
  
  return { valid: true, domain };
}

export function isValidEmailFormat(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}

export interface PasswordValidation {
  valid: boolean;
  errors: string[];
}

export function validatePassword(password: string): PasswordValidation {
  const errors: string[] = [];
  
  if (password.length < 8) {
    errors.push('La contraseña debe tener al menos 8 caracteres');
  }
  
  if (!/[A-Z]/.test(password)) {
    errors.push('La contraseña debe contener al menos una letra mayúscula');
  }
  
  if (!/[0-9]/.test(password)) {
    errors.push('La contraseña debe contener al menos un número');
  }
  
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
    errors.push('La contraseña debe contener al menos un carácter especial (!@#$%^&*...)');
  }
  
  return {
    valid: errors.length === 0,
    errors,
  };
}
