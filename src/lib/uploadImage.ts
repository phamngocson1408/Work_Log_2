import { v4 as uuidv4 } from 'uuid';
import { supabase } from './supabase';

const BUCKET = 'notes-images';

/**
 * Upload an image File to Supabase Storage and return its public URL.
 * Falls back to base64 data URL if upload fails (e.g. bucket not configured).
 */
export async function uploadImage(file: File): Promise<string> {
  const ext = file.name.split('.').pop() ?? 'png';
  const path = `${uuidv4()}.${ext}`;

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });

  if (error) {
    console.warn('uploadImage: Storage upload failed, falling back to base64.', error.message);
    return fileToBase64(file);
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
