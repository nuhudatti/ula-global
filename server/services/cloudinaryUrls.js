/** Cloudinary signed/authenticated URLs — never alter the path */
function isSignedCloudinaryUrl(fileUrl) {
  return Boolean(fileUrl && /\/upload\/s--[^/]+--\//.test(fileUrl));
}

/** Strip forced-download flag for inline preview (unsigned URLs only) */
export function cloudinaryInlineUrl(fileUrl) {
  if (!fileUrl || !fileUrl.includes('cloudinary.com') || !fileUrl.includes('/upload/')) {
    return fileUrl;
  }
  if (isSignedCloudinaryUrl(fileUrl)) return fileUrl;
  return fileUrl
    .replace('/upload/fl_attachment/', '/upload/')
    .replace(/\/upload\/([^/]*fl_attachment[^/]*)\//, '/upload/');
}

/** Force download for unsigned public URLs only */
export function cloudinaryAttachmentUrl(fileUrl) {
  if (!fileUrl || !fileUrl.includes('cloudinary.com') || !fileUrl.includes('/upload/')) {
    return fileUrl;
  }
  if (isSignedCloudinaryUrl(fileUrl)) return fileUrl;
  if (fileUrl.includes('/upload/fl_attachment')) return fileUrl;
  return fileUrl.replace('/upload/', '/upload/fl_attachment/');
}
