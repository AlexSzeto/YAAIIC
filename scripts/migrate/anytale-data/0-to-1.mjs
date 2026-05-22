export const fromVersion = 0;
export const toVersion = 1;

export function migrate(data) {
  data.genres = [];
  return data;
}
