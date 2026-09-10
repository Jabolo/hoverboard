export interface DialogData {
  email: string;
  firstFieldValue?: string;
  secondFieldValue?: string;
  consentGiven?: boolean;
}

export interface DialogForm {
  firstFieldLabel: string;
  firstFieldValue?: string;
  firstFieldName?: string;
  firstFieldAutocomplete?: string;
  secondFieldLabel: string;
  secondFieldValue?: string;
  secondFieldName?: string;
  secondFieldAutocomplete?: string;
  submitLabel: string;
  title: string;
  submit: (data: DialogData) => void;
}
