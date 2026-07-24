import { HighlightStyle } from '@codemirror/language';
import { tags } from '@lezer/highlight';

// VS Code Light+ JSON colors — the most widely recognized light palette.
export const jsonHighlightStyle = HighlightStyle.define([
  { tag: tags.propertyName, color: '#0451a5' },
  { tag: tags.string, color: '#a31515' },
  { tag: tags.number, color: '#098658' },
  { tag: [tags.bool, tags.null, tags.keyword], color: '#0000ff' },
  { tag: [tags.punctuation, tags.separator, tags.bracket], color: '#444444' },
]);
