// সার্চে ইউজারের লেখা বিশেষ চিহ্ন নিরাপদ করা
export function escapeRegex(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}