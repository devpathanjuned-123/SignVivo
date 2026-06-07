export type FieldType = "SIGNATURE" | "DATE" | "TEXT";

export interface EditorRecipient {
  id: string;
  name: string;
  email: string;
}

export interface EditorField {
  id: string;
  recipientId: string;
  type: FieldType;
  page: number;
  xPct: number;
  yPct: number;
  widthPct: number;
  heightPct: number;
}
