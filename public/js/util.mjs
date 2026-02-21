/**
 * Backfill missing album covers with a default image.
 * @param {*} data 
 * @returns 
 */
export function backfillMissingProperties(data) {
  const defaultAlbumCover = 'media/default-album.png';
  return data.map(item => ({
    ...item,
    imageUrl: item.imageUrl || defaultAlbumCover
  }));
}