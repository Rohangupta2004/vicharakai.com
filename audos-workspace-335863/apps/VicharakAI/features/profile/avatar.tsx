/**
 * Profile avatar — photo upload with initials fallback. Device-local by
 * design (a compact data URI in localStorage). Extracted from App.tsx.
 */
import { Camera } from 'lucide-react';
import { BRAND_GRADIENT, ON_AMBER } from '../../theme';

export const PROFILE_AVATAR_KEY = 'profile_avatar';

export function readStoredAvatar(): string | null {
  try {
    const raw = localStorage.getItem(PROFILE_AVATAR_KEY);
    return raw && raw.startsWith('data:image/') ? raw : null;
  } catch {
    return null;
  }
}

/** Downscale the picked photo to a small square JPEG data URI that fits localStorage. */
export async function fileToAvatarDataUrl(file: File): Promise<string | null> {
  try {
    const raw = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result || ''));
      reader.onerror = () => reject(new Error('unreadable'));
      reader.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('undecodable'));
      el.src = raw;
    });
    const size = 256;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (!ctx) return raw.startsWith('data:image/') ? raw : null;
    const side = Math.min(img.width || 1, img.height || 1);
    ctx.drawImage(img, ((img.width || side) - side) / 2, ((img.height || side) - side) / 2, side, side, 0, 0, size, size);
    return canvas.toDataURL('image/jpeg', 0.82);
  } catch {
    return null;
  }
}

export function nameInitials(name: string | null): string {
  const parts = (name || '').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'V';
  return parts.slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('');
}

/** Tappable profile avatar: the uploaded photo, or initials on the brand gradient. */
export function ProfileAvatar({
  name,
  imageUrl,
  onPick,
}: {
  name: string | null;
  imageUrl: string | null;
  onPick: (file: File) => void;
}) {
  return (
    <label
      className="relative w-14 h-14 rounded-full flex items-center justify-center flex-shrink-0 cursor-pointer touch-manipulation overflow-hidden"
      style={{ background: BRAND_GRADIENT, color: ON_AMBER, boxShadow: '0 4px 14px rgba(0,87,255,0.35)' }}
      aria-label="Change profile photo"
      data-testid="button-profile-avatar"
    >
      {imageUrl ? (
        <img src={imageUrl} alt="Your profile" className="w-full h-full object-cover" />
      ) : (
        <span className="text-lg font-extrabold">{nameInitials(name)}</span>
      )}
      <span
        className="absolute bottom-0 inset-x-0 flex items-center justify-center py-0.5"
        style={{ background: 'rgba(4,7,16,0.55)', color: '#FFFFFF' }}
        aria-hidden="true"
      >
        <Camera className="w-3 h-3" />
      </span>
      <input
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) onPick(file);
        }}
        data-testid="input-profile-avatar"
      />
    </label>
  );
}
