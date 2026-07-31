import { HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// VS Code Light+ JSON colors — the most widely recognized light palette.
export const jsonHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--code-key)' },
  { tag: tags.string, color: 'var(--code-string)' },
  { tag: tags.number, color: 'var(--code-number)' },
  { tag: [tags.bool, tags.null, tags.keyword], color: 'var(--code-atom)' },
  { tag: [tags.punctuation, tags.separator, tags.bracket], color: 'var(--code-punct)' },
]);
