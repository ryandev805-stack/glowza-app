const email = import.meta.env.VITE_ADMIN_EMAIL || 'admin@glowza.pk';
const password = import.meta.env.VITE_ADMIN_PASSWORD || 'admin123';
const key = 'glowza_admin_logged_in';

export function isAdminLoggedIn() {
  return localStorage.getItem(key) === 'true';
}

export function loginAdmin(inputEmail: string, inputPassword: string) {
  const ok = inputEmail.trim() === email && inputPassword === password;
  if (ok) {
    localStorage.setItem(key, 'true');
  }
  return ok;
}

export function logoutAdmin() {
  localStorage.removeItem(key);
}
