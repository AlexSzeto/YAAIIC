import { randomUUID } from 'crypto';

export const fromVersion = 0;
export const toVersion = 1;

export function migrate(data) {
  if (Array.isArray(data.workflows)) {
    data.workflows = data.workflows.map(w => w.uid ? w : { uid: randomUUID(), ...w });
  }
  return data;
}
