/*
This file shows the plain user avatar: the first letter of the nickname on a color picked from the nickname.
Edit this file when avatar colors or sizes change. Users can never upload a profile picture.
Copy this file as a starting point when you add another tiny shared display component.
*/

const COLORS = ["bg-rose-400", "bg-amber-400", "bg-lime-500", "bg-emerald-500", "bg-sky-500", "bg-indigo-500", "bg-fuchsia-500", "bg-orange-500"];

const SIZES = {
  sm: "h-7 w-7 text-sm",
  md: "h-10 w-10 text-lg",
  lg: "h-20 w-20 text-4xl",
};

export function avatarColor(username: string): string {
  let hash = 0;
  for (const char of username.toLowerCase()) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return COLORS[hash % COLORS.length];
}

export function Avatar({ username, size = "md" }: { username: string; size?: keyof typeof SIZES }) {
  return (
    <span
      aria-hidden="true"
      className={`inline-flex shrink-0 items-center justify-center rounded-full border-2 border-stone-900 font-black text-white ${avatarColor(username)} ${SIZES[size]}`}
    >
      {username.slice(0, 1).toUpperCase()}
    </span>
  );
}
