export interface DialogData {
  email: string;
  firstFieldValue?: string;
  secondFieldValue?: string;
  consentGiven?: boolean;
}

export interface DialogForm {
  firstFieldLabel: string;
  firstFieldValue?: string;
  secondFieldLabel: string;
  secondFieldValue?: string;
  submitLabel: string;
  title: string;
  submit: (data: DialogData) => void;
}
