import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';

function readEnv(name) {
  if (process.env[name]) {
    return process.env[name];
  }

  const envPath = path.join(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) {
    return undefined;
  }

  const contents = fs.readFileSync(envPath, 'utf8');
  const line = contents
    .split(/\r?\n/)
    .find((entry) => entry.trim().startsWith(`${name}=`));

  if (!line) {
    return undefined;
  }

  return line.slice(line.indexOf('=') + 1).trim().replace(/^["']|["']$/g, '');
}

function credentialFromEnv() {
  const json = readEnv('FIREBASE_SERVICE_ACCOUNT_JSON');
  if (json) {
    try {
      return admin.credential.cert(JSON.parse(json));
    } catch (error) {
      throw new Error(
        `FIREBASE_SERVICE_ACCOUNT_JSON is not valid one-line JSON: ${
          error instanceof Error ? error.message : 'parse failed'
        }`,
      );
    }
  }

  const projectId = readEnv('FIREBASE_PROJECT_ID');
  const clientEmail = readEnv('FIREBASE_CLIENT_EMAIL');
  const privateKey = readEnv('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    return admin.credential.cert({ projectId, clientEmail, privateKey });
  }

  return admin.credential.applicationDefault();
}

export function getAdminApp() {
  if (admin.apps.length > 0) {
    return admin.apps[0];
  }
  return admin.initializeApp({
    credential: credentialFromEnv(),
    projectId: readEnv('FIREBASE_PROJECT_ID'),
  });
}

export function getAdminFirestore() {
  getAdminApp();
  return admin.firestore();
}

export function getAdminMessaging() {
  getAdminApp();
  return admin.messaging();
}

export const adminFieldValue = admin.firestore.FieldValue;
